<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    /**
     * GET /api/customers
     * Search by name or phone (HMAC hash lookup — WBP-S compliant).
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Customer::class);

        $request->validate([
            'search'   => ['nullable', 'string', 'min:2', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $search = $request->input('search');

        $query = Customer::query()
            ->where('organisation_id', $request->user()->organisation_id);

        if ($search) {
            // Customer data is field-encrypted (WBP-S). Lookup uses HMAC-SHA256 hashes.
            // Exact full-name or exact phone matches only — partial matches are not possible
            // without decrypting all records (which would be a WBP-S compliance violation).
            $query->where(function ($q) use ($search) {
                $q->searchByName($search)
                  ->orWhere(function ($q2) use ($search) {
                      $q2->searchByPhone($search);
                  });
            });
        }

        $customers = $query
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 20));

        // Decrypt fields for response
        $customers->getCollection()->transform(fn (Customer $c) => $this->safePayload($c));

        return response()->json($customers);
    }

    /**
     * POST /api/customers
     * On-the-fly customer creation from POS (name + phone minimum).
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Customer::class);

        $data = $request->validate([
            'name'      => ['required', 'string', 'max:200'],
            'phone'     => ['nullable', 'string', 'max:30'],
            'email'     => ['nullable', 'email', 'max:200'],
            'id_number' => ['nullable', 'string', 'max:50'], // WBP-S: government ID
        ]);

        $customer = Customer::create([
            'organisation_id' => $request->user()->organisation_id,
            'name'            => $data['name'],
            'phone'           => $data['phone'] ?? null,
            'email'           => $data['email'] ?? null,
            'id_number'       => $data['id_number'] ?? null,
        ]);

        // WBP-S: PII writes must be traceable. Record which fields were set
        // (keys only — never the plaintext) in the hash-chained audit_logs.
        $this->auditPii('customer.created', $customer, array_keys($data));

        return response()->json(['data' => $this->safePayload($customer)], 201);
    }

    /**
     * GET /api/customers/{customer}
     */
    public function show(Request $request, Customer $customer): JsonResponse
    {
        $this->authorize('view', $customer);
        $this->ensureSameOrg($request, $customer->organisation_id);

        // WBP-S access-log: every individual PII read is traceable (who, when).
        $this->auditPii('customer.accessed', $customer);

        return response()->json(['data' => $this->safePayload($customer)]);
    }

    /**
     * PUT /api/customers/{customer}
     */
    public function update(Request $request, Customer $customer): JsonResponse
    {
        $this->authorize('update', $customer);
        $this->ensureSameOrg($request, $customer->organisation_id);

        $data = $request->validate([
            'name'      => ['sometimes', 'string', 'max:200'],
            'phone'     => ['nullable', 'string', 'max:30'],
            'email'     => ['nullable', 'email', 'max:200'],
            'id_number' => ['nullable', 'string', 'max:50'],
        ]);

        $customer->update($data);

        // Record which PII fields were edited (keys only, no plaintext).
        $this->auditPii('customer.updated', $customer, array_keys($data));

        return response()->json(['data' => $this->safePayload($customer->fresh())]);
    }

    /**
     * DELETE /api/customers/{customer}
     *
     * WBP-S "right to erasure / rectification". Redacts all personal data
     * (name tombstoned, phone/email/id_number + search hashes nulled) but
     * KEEPS the row and its aggregate counters so historical sales (which FK
     * to customer_id) and reports stay intact. Writes a customer.redacted
     * row to the hash-chained audit log. OA + Super Admin only.
     */
    public function destroy(Request $request, Customer $customer): JsonResponse
    {
        $this->authorize('delete', $customer);
        $this->ensureSameOrg($request, $customer->organisation_id);

        // name is NOT NULL → tombstone it (encrypted via the mutator) so reads
        // still decrypt; the recomputed name_hash is then nulled below so the
        // tombstone isn't searchable.
        $customer->name = '[verwijderd — WBP-S]';
        $customer->saveQuietly();

        // Null the remaining (nullable) PII + search hashes via a raw update so
        // the encryption mutators aren't invoked on null. Counters untouched.
        Customer::where('id', $customer->id)->update([
            'phone'      => null,
            'email'      => null,
            'id_number'  => null,
            'name_hash'  => null,
            'phone_hash' => null,
            'is_active'  => false,
        ]);

        $this->auditPii('customer.redacted', $customer);

        return response()->json([
            'message' => __('errors.customer_redacted'),
        ]);
    }

    /**
     * POST /api/customers/import
     * Bulk import customers from CSV. WBP-S compliant — all PII encrypted on write.
     *
     * Expected CSV columns (header row required):
     *   name, phone, email, id_number
     *
     * Returns: created, updated (matched on phone), skipped (missing name), errors[]
     */
    public function import(Request $request): JsonResponse
    {
        $this->authorize('create', Customer::class);

        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'], // 5 MB max
        ]);

        $orgId = $request->user()->organisation_id;

        $file    = $request->file('file');
        $handle  = fopen($file->getPathname(), 'r');
        $headers = array_map('trim', fgetcsv($handle) ?: []);

        $required = ['name'];
        $missing  = array_diff($required, $headers);
        if ($missing) {
            fclose($handle);
            return response()->json([
                'message' => 'CSV missing required columns: ' . implode(', ', $missing),
            ], 422);
        }

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $errors  = [];
        $row     = 1; // 1 = header

        \Illuminate\Support\Facades\DB::beginTransaction();
        try {
            while (($rawRow = fgetcsv($handle)) !== false) {
                $row++;

                if (count($rawRow) !== count($headers)) {
                    $errors[] = "Row {$row}: column count mismatch";
                    $skipped++;
                    continue;
                }

                $data = array_combine($headers, array_map('trim', $rawRow));
                $name = $data['name'] ?? '';

                if (! $name) {
                    $skipped++;
                    continue;
                }

                $attrs = [
                    'organisation_id' => $orgId,
                    'name'            => $name,
                    'phone'           => $data['phone'] ?? null ?: null,
                    'email'           => $data['email'] ?? null ?: null,
                    'id_number'       => $data['id_number'] ?? null ?: null,
                ];

                // Match on phone if provided (encrypted — need to create or find by hash search)
                $phone = $attrs['phone'];
                $existing = null;

                if ($phone) {
                    // Customer model uses HMAC hash for phone search (WBP-S)
                    $existing = Customer::where('organisation_id', $orgId)
                        ->searchByPhone($phone)
                        ->first();
                }

                if ($existing) {
                    $existing->update($attrs);
                    $updated++;
                } else {
                    Customer::create($attrs);
                    $created++;
                }
            }

            \Illuminate\Support\Facades\DB::commit();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            fclose($handle);
            return response()->json(['message' => 'Import failed: ' . $e->getMessage()], 422);
        }

        fclose($handle);

        return response()->json([
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors'  => $errors,
        ]);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    /**
     * Return a safe, decrypted payload — never expose raw encrypted DB values.
     */
    private function safePayload(Customer $c): array
    {
        return [
            'id'            => $c->id,
            'name'          => $c->name,
            'phone'         => $c->phone,
            'email'         => $c->email,
            'total_spend_srd'=> (string) $c->total_spend_srd,
            'visit_count'   => $c->visit_count,
            'created_at'    => $c->created_at?->toIso8601String(),
        ];
    }

    private function ensureSameOrg(Request $request, string $orgId): void
    {
        if ($request->user()->organisation_id && $request->user()->organisation_id !== $orgId) {
            abort(403);
        }
    }

    /**
     * Write a WBP-S PII event to the hash-chained audit_logs table.
     * Stores only the affected field NAMES (never plaintext values), the
     * actor, org, customer id, IP and timestamp — enough for the Rekenkamer
     * trace requirement without re-exposing the data the encryption protects.
     */
    private function auditPii(string $event, Customer $customer, array $fields = []): void
    {
        AuditLog::create([
            'user_id'         => request()->user()?->id,
            'organisation_id' => $customer->organisation_id,
            'event'           => $event,
            'auditable_type'  => 'customer',
            'auditable_id'    => $customer->id,
            'old_values'      => null,
            'new_values'      => $fields ? ['fields' => array_values($fields)] : null,
            'ip_address'      => request()->ip(),
            'created_at'      => now(),
        ]);
    }
}
