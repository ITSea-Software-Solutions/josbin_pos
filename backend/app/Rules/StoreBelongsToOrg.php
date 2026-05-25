<?php

namespace App\Rules;

use App\Models\Store;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Auth;

/**
 * Validates that the supplied store_id exists AND belongs to the authenticated
 * user's organisation. Super Admin can reach any store across all orgs.
 *
 * Replaces the previous `exists:stores,id` rule which only checked existence,
 * letting one organisation's users pass another organisation's store_id and
 * read its sales / reports / registers (cross-org data leakage).
 *
 * Use:
 *   'store_id' => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
 *
 * Works with both `required` and `nullable` — Laravel skips rules when the
 * value is absent or explicitly null, so no extra handling needed.
 */
class StoreBelongsToOrg implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $user = Auth::user();

        if (! $user) {
            $fail('Unauthenticated.');
            return;
        }

        // Super Admin operates platform-wide.
        if ($user->role === 'super_admin') {
            if (! Store::where('id', $value)->exists()) {
                $fail('The selected store does not exist.');
            }
            return;
        }

        $belongs = Store::where('id', $value)
            ->where('organisation_id', $user->organisation_id)
            ->exists();

        if (! $belongs) {
            $fail('The selected store does not belong to your organisation.');
        }
    }
}
