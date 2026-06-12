<?php

namespace App\Models;

use App\Services\AuditHashService;
use Illuminate\Database\Eloquent\Model;

/**
 * Thin Eloquent wrapper around audit_logs.
 *
 * The only reason this model exists is to hook into the `creating` event
 * and automatically compute + attach the SHA-256 hash chain fields
 * (previous_row_hash, row_hash) before every insert.
 *
 * All direct DB::table('audit_logs')->insert() calls in the codebase should
 * be converted to AuditLog::create([...]) so the chain is maintained.
 *
 * IMMUTABILITY: updating or deleting audit log rows is intentionally
 * prevented by returning false from the updating/deleting hooks.
 */
class AuditLog extends Model
{
    public $timestamps = false; // created_at is set manually to ensure AST

    protected $table = 'audit_logs';

    protected $fillable = [
        'user_id',
        'organisation_id',
        'event',
        'auditable_type',
        'auditable_id',
        'old_values',
        'new_values',
        'ip_address',
        'created_at',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        // ── Compute hash chain on every insert ───────────────────────────
        static::creating(function (AuditLog $log) {
            // Ensure created_at is always in AST
            if (! $log->created_at) {
                $log->created_at = now();
            }

            $hasher = app(AuditHashService::class);

            // Hash the SAME representation the verifier will read back from the
            // DB column. computeHash() runs new_values through canonicalJson(),
            // so we must hand it the value in the exact form it is stored —
            // otherwise insert-time and verify-time hashes diverge and the
            // chain breaks (see gotcha: double-encoded register.* / *_logout rows).
            //
            // Two failure modes this guards against:
            //   1. A caller pre-encodes the payload (json_encode($props)) and
            //      assigns the STRING to an 'array'-cast attribute. Eloquent then
            //      json_encodes it a SECOND time on save, so the DB holds a
            //      double-encoded JSON string. We normalise that here.
            //   2. JSON flag mismatch (escaped vs JSON_UNESCAPED_SLASHES/UNICODE)
            //      between insert and verify. canonicalJson() pins one form.
            $row = [
                'organisation_id' => $log->organisation_id ?? '',
                'event'           => $log->event ?? '',
                'auditable_type'  => $log->auditable_type ?? '',
                'auditable_id'    => $log->auditable_id ?? '',
                // Pass the array/value straight through. computeHash()
                // canonicalises it identically on both insert and verify.
                'new_values'      => $log->new_values,
                'created_at'      => $log->created_at->toIso8601String(),
            ];

            // getLastHash is null-org-safe (whereNull) so the platform/system
            // partition (organisation_id NULL — rate locks, licence events,
            // chain-rebaseline markers) is a real linked chain, not a pile of
            // independent genesis blocks.
            $prevHash = $hasher->getLastHash($log->organisation_id);

            $log->previous_row_hash = $prevHash;
            $log->row_hash          = $hasher->computeHash($row, $prevHash);
        });

        // ── Prevent any modification of existing rows ─────────────────────
        static::updating(function () {
            // Silently block — do not throw, audit log is append-only
            return false;
        });

        // ── Prevent deletion ──────────────────────────────────────────────
        static::deleting(function () {
            return false;
        });
    }
}
