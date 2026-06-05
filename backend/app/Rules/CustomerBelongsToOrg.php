<?php

namespace App\Rules;

use App\Models\Customer;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Auth;

/**
 * Validates that the supplied customer_id exists AND belongs to the
 * authenticated user's organisation. Super Admin can reach any customer.
 *
 * Replaces the previous `exists:customers,id` rule which only checked
 * existence — a cashier in Org A could attach a guessed Customer UUID from
 * Org B to a sale, and the receipt would then decrypt and print that
 * customer's WBP-S-protected name / phone / email (cross-tenant PII leak).
 *
 * Use:
 *   'customer_id' => ['nullable', 'uuid', new \App\Rules\CustomerBelongsToOrg],
 *
 * Works with both `required` and `nullable` — Laravel skips rules when the
 * value is absent or explicitly null.
 */
class CustomerBelongsToOrg implements ValidationRule
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
            if (! Customer::where('id', $value)->exists()) {
                $fail('The selected customer does not exist.');
            }
            return;
        }

        $belongs = Customer::where('id', $value)
            ->where('organisation_id', $user->organisation_id)
            ->exists();

        if (! $belongs) {
            $fail('The selected customer does not belong to your organisation.');
        }
    }
}
