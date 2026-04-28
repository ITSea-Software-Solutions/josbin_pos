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

            // Resolve cast values back to strings for hashing (consistent serialisation)
            $row = [
                'organisation_id' => $log->organisation_id ?? '',
                'event'           => $log->event ?? '',
                'auditable_type'  => $log->auditable_type ?? '',
                'auditable_id'    => $log->auditable_id ?? '',
                'new_values'      => is_array($log->new_values)
                    ? json_encode($log->new_values)
                    : ($log->getRawOriginal('new_values') ?? ''),
                'created_at'      => $log->created_at->toIso8601String(),
            ];

            $prevHash = $log->organisation_id
                ? $hasher->getLastHash($log->organisation_id)
                : null;

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
