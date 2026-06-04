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

        return json_encode($decoded, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Get the most recent row_hash for the given organisation.
     * Returns null if no rows exist yet (genesis block).
     */
    public function getLastHash(string $organisationId): ?string
    {
        return DB::table('audit_logs')
            ->where('organisation_id', $organisationId)
            ->whereNotNull('row_hash')
            ->orderByDesc('id')
            ->value('row_hash');
    }

    /**
     * Verify the entire hash chain for an organisation.
     *
     * Returns: ['valid' => bool, 'checked' => int, 'broken_at_id' => int|null]
     */
    public function verifyChain(string $organisationId): array
    {
        $rows = DB::table('audit_logs')
            ->where('organisation_id', $organisationId)
            ->whereNotNull('row_hash')
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
