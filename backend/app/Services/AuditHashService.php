<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Cryptographic hash chain for the audit log.
 *
 * Every audit_log row stores:
 *   previous_row_hash — the row_hash of the previous row for this organisation
 *   row_hash          — SHA-256 of (own fields + previous_row_hash)
 *
 * This makes it impossible to silently delete or modify any row without
 * breaking the chain from that point forward.
 *
 * The chain can be fully verified with `php artisan audit:verify`.
 */
class AuditHashService
{
    /**
     * Compute the row_hash for a new audit log row.
     *
     * @param array  $row     The row data (must include organisation_id, event,
     *                        auditable_type, auditable_id, new_values, created_at)
     * @param string|null $previousHash  The row_hash of the last row for this org
     */
    public function computeHash(array $row, ?string $previousHash): string
    {
        $payload = implode('|', [
            $row['organisation_id'] ?? '',
            $row['event']           ?? '',
            $row['auditable_type']  ?? '',
            $row['auditable_id']    ?? '',
            $this->canonicalJson($row['new_values'] ?? ''),
            $this->canonicalTimestamp($row['created_at'] ?? ''),
            $previousHash           ?? 'GENESIS',
        ]);

        return hash('sha256', $payload);
    }

    /**
     * Normalise a timestamp to a representation-independent form so the hash
     * is identical whether it was computed at INSERT time (where created_at
     * is a Carbon → ISO8601 in AST) or at VERIFY time (where it's read back
     * as a raw DB string whose format/offset depends on the session TZ).
     * Using the Unix epoch second sidesteps every format/timezone difference.
     */
    private function canonicalTimestamp(mixed $value): string
    {
        if (empty($value)) {
            return '';
        }

        try {
            return (string) \Illuminate\Support\Carbon::parse($value)->getTimestamp();
        } catch (\Throwable) {
            return (string) $value;
        }
    }

    /**
     * Normalise a JSON-ish value to a canonical string so insert-time and
     * verify-time hashing agree regardless of how the array cast happened to
     * serialise it (key spacing, unicode/slash escaping, future Laravel flag
     * changes). decode → re-encode yields a stable byte sequence.
     */
    private function canonicalJson(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        // Arrays arrive at insert time; strings (raw DB JSON) at verify time.
        $decoded = is_array($value) ? $value : json_decode((string) $value, true);

        if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
            return (string) $value; // not JSON — hash the literal
        }

        // Defensively un-nest double-encoded payloads. Historically some call
        // sites pre-`json_encode`d the array before handing it to the
        // 'array'-cast `new_values` column, so Eloquent encoded it a SECOND
        // time and the DB held a JSON *string* ("{\"k\":...}") rather than a
        // JSON *object*. Decode until we reach the underlying structure so the
        // canonical form is identical whether the row was written by the old
        // (double-encoding) or new (single-encoding) path.
        while (is_string($decoded)) {
            $inner = json_decode($decoded, true);
            if ($inner === null && json_last_error() !== JSON_ERROR_NONE) {
                break; // genuine string payload — keep it
            }
            $decoded = $inner;
        }

        // Single canonical form for both insert and verify: no slash/unicode
        // escaping so the byte sequence is representation-independent.
        return json_encode($decoded, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Seal an already-inserted audit_logs row into its organisation's chain.
     *
     * Used for rows written OUTSIDE our AuditLog model — chiefly the OwenIt
     * model-audits (Product/User/Customer/… created/updated events), which land
     * in audit_logs with a NULL row_hash and (until now) were silently skipped
     * by the verifier. The Audited listener calls this immediately after OwenIt
     * persists, attributing the row to the auditable's organisation and linking
     * it onto that chain. No-op if the row is already hashed.
     */
    public function sealRow(int $id, ?string $organisationId): void
    {
        $row = DB::table('audit_logs')->where('id', $id)->first();
        if (! $row || $row->row_hash !== null) {
            return;
        }

        $prev = $this->getLastHash($organisationId);
        $hash = $this->computeHash([
            'organisation_id' => $organisationId ?? '',
            'event'           => $row->event ?? '',
            'auditable_type'  => $row->auditable_type ?? '',
            'auditable_id'    => $row->auditable_id ?? '',
            'new_values'      => $row->new_values,
            'created_at'      => $row->created_at,
        ], $prev);

        DB::table('audit_logs')->where('id', $id)->update([
            'organisation_id'   => $organisationId,
            'previous_row_hash' => $prev,
            'row_hash'          => $hash,
        ]);
    }

    /**
     * Get the most recent row_hash for the given organisation.
     * Returns null if no rows exist yet (genesis block).
     */
    public function getLastHash(?string $organisationId): ?string
    {
        return DB::table('audit_logs')
            // NULL organisation_id is the platform/system partition — it has
            // its own chain. `where(col, null)` becomes `= NULL` (never true),
            // so the null case MUST use whereNull or the platform chain silently
            // never links (every row hashes as a genesis block).
            ->where(fn ($q) => $organisationId === null
                ? $q->whereNull('organisation_id')
                : $q->where('organisation_id', $organisationId))
            ->whereNotNull('row_hash')
            ->orderByDesc('id')
            ->value('row_hash');
    }

    /**
     * Verify the entire hash chain for an organisation.
     *
     * Returns: ['valid' => bool, 'checked' => int, 'broken_at_id' => int|null]
     */
    public function verifyChain(?string $organisationId): array
    {
        // EVERY row in the partition is checked — including any with a NULL
        // row_hash. A NULL-hash row is unverifiable (it never joined the chain)
        // and is treated as a break, so the verifier can never report "intact"
        // while part of the log is silently unprotected (the vacuous-pass risk).
        $rows = DB::table('audit_logs')
            ->where(fn ($q) => $organisationId === null
                ? $q->whereNull('organisation_id')
                : $q->where('organisation_id', $organisationId))
            ->orderBy('id')
            ->select([
                'id', 'organisation_id', 'event', 'auditable_type',
                'auditable_id', 'new_values', 'created_at',
                'previous_row_hash', 'row_hash',
            ])
            ->cursor();

        $count    = 0;
        $prevHash = null;

        foreach ($rows as $row) {
            if ($row->row_hash === null) {
                return [
                    'valid'        => false,
                    'checked'      => $count,
                    'broken_at_id' => $row->id,
                    'message'      => "Unverifiable row ID {$row->id} (event '{$row->event}') has no hash — it never joined the chain. Run audit:rebaseline to seal it, then investigate why it was written hash-less.",
                ];
            }

            $expected = $this->computeHash((array) $row, $prevHash);

            if ($row->row_hash !== $expected) {
                return [
                    'valid'        => false,
                    'checked'      => $count,
                    'broken_at_id' => $row->id,
                    'message'      => "Hash mismatch at row ID {$row->id}. Chain broken — possible tampering.",
                ];
            }

            $prevHash = $row->row_hash;
            $count++;
        }

        return [
            'valid'        => true,
            'checked'      => $count,
            'broken_at_id' => null,
            'message'      => "Chain intact — {$count} rows verified.",
        ];
    }
}
