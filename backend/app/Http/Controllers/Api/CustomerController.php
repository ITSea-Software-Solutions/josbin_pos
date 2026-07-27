<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Sale;
use App\Support\AstDates;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

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
            // Lightweight aggregate: newest sale timestamp as last_visit_at.
            // withMax = single correlated subselect — no N+1, no join fan-out.
            ->withMax('sales as last_visit_at', 'occurred_at')
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

        $customer->loadMax('sales as last_visit_at', 'occurred_at');

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

    /**
     * GET /api/customers/{customer}/history
     *
     * Paginated purchase history for one customer (dashboard detail view).
     * Org-scoped at the QUERY level: a customer outside the caller's
     * organisation is a 404 (indistinguishable from "does not exist" — the
     * P0-6 rule), never a 403 that would leak existence. Role gate mirrors
     * the customers index (customers.view via CustomerPolicy).
     */
    public function history(Request $request, string $customer): JsonResponse
    {
        $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page'     => ['nullable', 'integer', 'min:1'],
        ]);

        $c = $this->findScopedCustomer($request, $customer);
        $this->authorize('view', $c);

        // WBP-S access-log: viewing a person's purchase trail is a PII read.
        $this->auditPii('customer.accessed', $c);

        $sales = Sale::query()
            ->where('customer_id', $c->id)
            // Purchases only — held bills are unfinished carts, not history.
            // Voided sales stay visible (status column tells the story);
            // refunds are negative completed rows (see SaleRefundTest).
            ->whereIn('status', ['completed', 'voided'])
            ->with('store:id,name')
            ->orderByDesc('occurred_at')
            ->paginate($request->integer('per_page', 20));

        $sales->getCollection()->transform(fn (Sale $s) => [
            'id'             => $s->id,
            'sale_number'    => $s->sale_number,
            'occurred_at'    => $s->occurred_at?->toIso8601String(),
            'store_name'     => $s->store?->name,
            'total_srd'      => (string) $s->total_srd,
            'btw_srd'        => (string) $s->btw_srd,
            'discount_srd'   => (string) $s->discount_srd,
            'payment_method' => $s->payment_method,
            'status'         => $s->status,
            // Refund rows are completed sales with negative totals and a
            // "REFUND: …" void_reason (set by SaleController::refund).
            'is_refund'      => str_starts_with((string) $s->void_reason, 'REFUND:'),
        ]);

        return response()->json($sales);
    }

    /**
     * GET /api/customers/{customer}/statement?from=&to=&format=pdf|csv&locale=nl|en
     *
     * Downloadable statement for a date range (default: last 90 AST days).
     * Completed sales only — refund rows (negative) appear as lines and are
     * netted in the footer. Authenticated download (Sanctum bearer), same
     * org-scoping + role gate as history(). All money math is bcmath on
     * DECIMAL strings.
     */
    public function statement(Request $request, string $customer): \Symfony\Component\HttpFoundation\Response
    {
        $request->validate([
            'from'   => ['nullable', 'date_format:Y-m-d'],
            'to'     => ['nullable', 'date_format:Y-m-d'],
            'format' => ['nullable', Rule::in(['pdf', 'csv'])],
            'locale' => ['nullable', Rule::in(['nl', 'en'])],
        ]);

        $c = $this->findScopedCustomer($request, $customer);
        $this->authorize('view', $c);

        $to   = $request->input('to', Carbon::now(AstDates::TZ)->toDateString());
        $from = $request->input('from', Carbon::parse($to, AstDates::TZ)->subDays(90)->toDateString());
        if ($from > $to) {
            abort(422, 'from must be before or equal to to');
        }
        // A statement is a period document — cap it so one request can never
        // pull a customer's entire multi-year history into a single PDF.
        if (\Carbon\Carbon::parse($from)->diffInDays(\Carbon\Carbon::parse($to)) > 366) {
            abort(422, __('errors.export_range_too_large'));
        }

        $format = $request->input('format', 'pdf');
        $locale = $request->input('locale', 'nl');

        $sales = Sale::query()
            ->where('customer_id', $c->id)
            ->where('status', 'completed')
            ->where('occurred_at', '>=', AstDates::dayStart($from))
            ->where('occurred_at', '<', AstDates::dayAfter($to))
            ->with('store:id,name')
            ->orderBy('occurred_at')
            ->get();

        // ── Totals — bcmath on DECIMAL strings, never floats ──────────────
        $grossTotal  = '0.00'; // completed sales excl. refund rows
        $refundTotal = '0.00'; // refund rows (negative)
        $btwTotal    = '0.00'; // BTW incl. refund negatives
        $netTotal    = '0.00'; // refund-adjusted net (= gross + refunds)

        $rows = $sales->map(function (Sale $s) use (&$grossTotal, &$refundTotal, &$btwTotal, &$netTotal) {
            $total    = (string) $s->total_srd;
            $isRefund = str_starts_with((string) $s->void_reason, 'REFUND:');

            $netTotal = bcadd($netTotal, $total, 2);
            $btwTotal = bcadd($btwTotal, (string) $s->btw_srd, 2);
            if ($isRefund) {
                $refundTotal = bcadd($refundTotal, $total, 2);
            } else {
                $grossTotal = bcadd($grossTotal, $total, 2);
            }

            return [
                'occurred_at'    => $s->occurred_at?->setTimezone(AstDates::TZ)->format('d-m-Y H:i'),
                'sale_number'    => $s->sale_number,
                'store_name'     => $s->store?->name ?? '',
                'payment_method' => $s->payment_method,
                'btw_srd'        => (string) $s->btw_srd,
                'total_srd'      => $total,
                'is_refund'      => $isRefund,
            ];
        });

        $org = $c->organisation;

        $data = [
            'locale'        => $locale,
            'customer_name' => $c->name,
            'org_name'      => $org?->name ?? '',
            'btw_number'    => $org?->btw_number ?? '',
            'date_from'     => $from,
            'date_to'       => $to,
            'rows'          => $rows,
            'sale_count'    => $sales->count(),
            'gross_total'   => $grossTotal,
            'refund_total'  => $refundTotal,
            'btw_total'     => $btwTotal,
            'net_total'     => $netTotal,
        ];

        // WBP-S: exporting a person's purchase history is a PII disclosure.
        // (auditPii stores field NAMES only — the export params go in the
        // event name's companion columns via a keys-only convention.)
        $this->auditPii('customer.statement_exported', $c);

        $filename = 'customer-statement-' . $from . '-' . $to;

        if ($format === 'csv') {
            return $this->statementCsv($data, $filename . '.csv');
        }

        $pdf = Pdf::loadView('reports.customer_statement', $data)->setPaper('A4', 'portrait');

        return response($pdf->output(), 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '.pdf"',
        ]);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    /**
     * Stream the statement as CSV — same shape as the PDF: header block,
     * one line per sale, totals footer. UTF-8 BOM so Excel renders accents
     * (mirrors BtwSubmissionController::export).
     */
    private function statementCsv(array $data, string $filename): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $nl = $data['locale'] === 'nl';

        return response()->streamDownload(function () use ($data, $nl) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, [$nl ? 'Klantoverzicht' : 'Customer statement', $data['customer_name']]);
            fputcsv($out, [$nl ? 'Organisatie' : 'Organisation', $data['org_name']]);
            fputcsv($out, ['BTW', $data['btw_number']]);
            fputcsv($out, [$nl ? 'Periode' : 'Period', $data['date_from'] . ' - ' . $data['date_to']]);
            fputcsv($out, []);

            fputcsv($out, $nl
                ? ['Datum (AST)', 'Bonnummer', 'Vestiging', 'Betaalmethode', 'BTW (SRD)', 'Totaal (SRD)', 'Retour']
                : ['Date (AST)', 'Sale number', 'Store', 'Payment method', 'BTW (SRD)', 'Total (SRD)', 'Refund']);
            foreach ($data['rows'] as $r) {
                fputcsv($out, [
                    $r['occurred_at'],
                    $r['sale_number'],
                    $r['store_name'],
                    $r['payment_method'],
                    $r['btw_srd'],
                    $r['total_srd'],
                    $r['is_refund'] ? ($nl ? 'ja' : 'yes') : '',
                ]);
            }

            fputcsv($out, []);
            fputcsv($out, [$nl ? 'Aantal transacties' : 'Transaction count', $data['sale_count']]);
            fputcsv($out, [$nl ? 'Verkopen (SRD)' : 'Sales (SRD)', $data['gross_total']]);
            fputcsv($out, [$nl ? 'Retouren (SRD)' : 'Refunds (SRD)', $data['refund_total']]);
            fputcsv($out, [$nl ? 'Totaal BTW (SRD)' : 'Total BTW (SRD)', $data['btw_total']]);
            fputcsv($out, [$nl ? 'Netto totaal (SRD)' : 'Net total (SRD)', $data['net_total']]);
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Resolve a customer id scoped to the caller's organisation.
     *
     * Cross-org (or unknown, or non-uuid) ids are ALWAYS a 404 — never a 403
     * that would confirm the record exists (P0-6 pattern). Super Admin
     * (organisation_id === null) sees every org.
     */
    private function findScopedCustomer(Request $request, string $id): Customer
    {
        abort_unless(Str::isUuid($id), 404);

        $query = Customer::query();

        if ($request->user()->organisation_id !== null) {
            $query->where('organisation_id', $request->user()->organisation_id);
        }

        return $query->findOrFail($id);
    }

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
            // Present when the query added withMax/loadMax('sales as
            // last_visit_at'); raw timestamptz string → ISO-8601.
            'last_visit_at' => isset($c->last_visit_at)
                ? Carbon::parse($c->last_visit_at)->toIso8601String()
                : null,
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
