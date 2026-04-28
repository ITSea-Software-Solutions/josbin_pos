<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;

class Customer extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'organisation_id',
        'name', 'phone', 'email', 'id_number',
        'name_hash', 'phone_hash',
        'total_spend_srd', 'visit_count', 'is_active',
    ];

    protected $casts = [
        'total_spend_srd' => 'decimal:2',
        'visit_count'     => 'integer',
        'is_active'       => 'boolean',
    ];

    /** WBP-S: personal data fields are always encrypted at rest. */
    protected array $encryptedFields = ['name', 'phone', 'email', 'id_number'];

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    // ── Encryption accessors / mutators ─────────────────────────────────────

    public function setNameAttribute(string $value): void
    {
        $this->attributes['name']      = Crypt::encryptString($value);
        $this->attributes['name_hash'] = hash_hmac('sha256', mb_strtolower($value), config('app.key'));
    }

    public function getNameAttribute(?string $value): ?string
    {
        return $value ? Crypt::decryptString($value) : null;
    }

    public function setPhoneAttribute(?string $value): void
    {
        $this->attributes['phone']      = $value ? Crypt::encryptString($value) : null;
        $this->attributes['phone_hash'] = $value
            ? hash_hmac('sha256', $value, config('app.key'))
            : null;
    }

    public function getPhoneAttribute(?string $value): ?string
    {
        return $value ? Crypt::decryptString($value) : null;
    }

    public function setEmailAttribute(?string $value): void
    {
        $this->attributes['email'] = $value ? Crypt::encryptString($value) : null;
    }

    public function getEmailAttribute(?string $value): ?string
    {
        return $value ? Crypt::decryptString($value) : null;
    }

    public function setIdNumberAttribute(?string $value): void
    {
        $this->attributes['id_number'] = $value ? Crypt::encryptString($value) : null;
    }

    public function getIdNumberAttribute(?string $value): ?string
    {
        return $value ? Crypt::decryptString($value) : null;
    }

    // ── Search scopes ────────────────────────────────────────────────────────

    public function scopeSearchByName($query, string $term)
    {
        $hash = hash_hmac('sha256', mb_strtolower($term), config('app.key'));

        return $query->where('name_hash', $hash);
    }

    public function scopeSearchByPhone($query, string $phone)
    {
        $hash = hash_hmac('sha256', $phone, config('app.key'));

        return $query->where('phone_hash', $hash);
    }
}
