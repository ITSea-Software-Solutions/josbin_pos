<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use OwenIt\Auditing\Contracts\Auditable;

/**
 * Platform-wide key/value setting.
 *
 * Changes are recorded in the immutable audit log — security-relevant
 * policy settings (e.g. two_factor_required_roles) must be traceable.
 */
class AppSetting extends Model implements Auditable
{
    use \OwenIt\Auditing\Auditable;

    protected $table = 'app_settings';

    protected $fillable = ['key', 'value'];

    protected $casts = [
        'value' => 'array',
    ];

    /** Retrieve a setting value, returning $default when it has never been set. */
    public static function get(string $key, mixed $default = null): mixed
    {
        $row = static::query()->where('key', $key)->first();

        return $row ? $row->value : $default;
    }

    /** Create or update a setting value. */
    public static function set(string $key, mixed $value): self
    {
        return static::query()->updateOrCreate(
            ['key' => $key],
            ['value' => $value],
        );
    }
}
