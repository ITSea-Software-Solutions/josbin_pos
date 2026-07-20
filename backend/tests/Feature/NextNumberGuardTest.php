<?php

namespace Tests\Feature;

use App\Models\Sale;
use Tests\TestCase;

/**
 * P1-D1: Sale::nextNumber() relies on a pg_advisory_XACT_lock, which is
 * scopeless outside a transaction — two concurrent first-sales could mint
 * the same number. The guard must refuse loudly instead.
 *
 * Deliberately does NOT use RefreshDatabase: that trait wraps every test in
 * a transaction, which is exactly the condition we need absent here. No
 * rows are written — the guard throws before any query runs.
 */
class NextNumberGuardTest extends TestCase
{
    public function test_next_number_outside_a_transaction_throws(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/inside a DB transaction/');

        Sale::nextNumber('00000000-0000-0000-0000-000000000000');
    }
}
