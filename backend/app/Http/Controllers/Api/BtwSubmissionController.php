<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BtwSubmission;
use App\Models\Organisation;
use App\Services\BtwSubmissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * REST endpoints for BTW submissions to Belastingdienst Suriname.
 *
 *   GET    /api/btw-submissions              list (scoped per role)
 *   POST   /api/btw-submissions/preview      dry-run totals before submitting
 *   POST   /api/btw-submissions              file a new submission
 *   GET    /api/btw-submissions/{id}         single submission detail
 *   POST   /api/btw-submissions/{id}/accept  tax inspector marks accepted
 *   POST   /api/btw-submissions/{id}/dispute tax inspector marks disputed
 */
class BtwSubmissionController extends Controller
{
    public function __construct(
        private readonly BtwSubmissionService $service,
    ) {}

    /** GET /api/btw-submissions */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', BtwSubmission::class);

        $query = BtwSubmission::query()
            ->with('organisation:id,name', 'store:id,name', 'submitter:id,name', 'reviewer:id,name');

        $this->applyListFilters($query, $request);
        $this->applyListSort($query, $request);

        return response()->json($query->paginate($request->integer('per_page', 25)));
    }

    /**
     * Scope + filters shared by index() and export() so the CSV always matches
     * exactly what the inspector sees on screen.
     */
    private function applyListFilters($query, Request $request): void
    {
        $user = $request->user();

        // Scope: cross-org roles see everything; everyone else only their own org.
        if (! $user->isCrossOrgRole()) {
            $query->where('organisation_id', $user->organisation_id);
        }
        // A Store Manager only ever sees their own store's filings — same store
        // scoping as Reports / Stock / Z-Report.
        if ($user->isStoreBound()) {
            $query->where('store_id', $user->store_id);
        }
        if ($request->filled('organisation_id') && $user->isCrossOrgRole()) {
            $query->where('organisation_id', $request->input('organisation_id'));
        }
        if ($request->filled('store_id') && ! $user->isStoreBound()) {
            $query->where('store_id', $request->input('store_id'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('period_type')) {
            $query->where('period_type', $request->input('period_type'));
        }
        if ($request->filled('from')) {
            $query->where('period_end', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->where('period_start', '<=', $request->input('to'));
        }
        // Filing year — matches the tax period, not the submission timestamp.
        if ($request->filled('year')) {
            $query->whereYear('period_start', (int) $request->input('year'));
        }
        // BTW amount band (on the headline total_btw_srd).
        if ($request->filled('min_amount')) {
            $query->where('total_btw_srd', '>=', (float) $request->input('min_amount'));
        }
        if ($request->filled('max_amount')) {
            $query->where('total_btw_srd', '<=', (float) $request->input('max_amount'));
        }
        // Source POS — 'pos' = Josbin native; 'api' = third-party via Layer-3.
        if ($request->filled('source')) {
            $source = $request->input('source');
            $query->whereExists(function ($q) use ($source) {
                $q->select(\DB::raw(1))
                    ->from('sales')
                    ->whereColumn('sales.id', \DB::raw("ANY(SELECT jsonb_array_elements_text(btw_submissions.sale_ids))"))
                    ->where('sales.source', $source);
            });
        }
        if ($request->filled('search')) {
            $term = '%' . $request->input('search') . '%';
            $query->where(fn ($q) => $q->where('reference', 'ilike', $term)
                ->orWhereHas('organisation', fn ($o) => $o->where('name', 'ilike', $term)));
        }
    }

    private function applyListSort($query, Request $request): void
    {
        // Default newest-filed first (the inspector's working order).
        match ($request->input('sort')) {
            'oldest'      => $query->orderBy('submitted_at'),
            'amount_desc' => $query->orderByDesc('total_btw_srd')->orderByDesc('submitted_at'),
            'amount_asc'  => $query->orderBy('total_btw_srd')->orderByDesc('submitted_at'),
            default       => $query->orderByDesc('submitted_at'),
        };
    }

    /**
     * GET /api/btw-submissions/export
     *
     * Streams the FILTERED submission list as CSV (SRD, AST timestamps) for the
     * inspector's records / Rekenkamer filing. Same scope + filters as index,
     * no pagination — every matching row.
     */
    public function export(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $this->authorize('viewAny', BtwSubmission::class);

        $query = BtwSubmission::query()->with('organisation:id,name', 'submitter:id,name', 'reviewer:id,name');
        $this->applyListFilters($query, $request);
        $this->applyListSort($query, $request);

        $statusLabel = [
            'filed' => 'Filed', 'accepted' => 'Accepted', 'disputed' => 'Disputed', 'superseded' => 'Superseded',
        ];
        $filename = 'btw-submissions-' . now()->setTimezone('America/Paramaribo')->format('Y-m-d_His') . '.csv';

        return response()->streamDownload(function () use ($query, $statusLabel) {
            $out = fopen('php://output', 'w');
            // UTF-8 BOM so Excel renders accents (Café, Nickerie) correctly.
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, [
                'Reference', 'Organisation', 'BTW number', 'Period type', 'Period start', 'Period end',
                'Sales count', 'Total sales (SRD)', 'Taxable (SRD)', 'Exempt (SRD)', 'BTW due (SRD)',
                'Status', 'Submitted at (AST)', 'Submitted by', 'Reviewed at (AST)', 'Reviewed by',
            ]);
            $query->chunk(500, function ($rows) use ($out, $statusLabel) {
                foreach ($rows as $s) {
                    fputcsv($out, [
                        $s->reference,
                        $s->organisation?->name ?? '',
                        $s->organisation?->btw_number ?? '',
                        $s->period_type,
                        $s->period_start,
                        $s->period_end,
                        $s->sales_count,
                        $s->total_sales_srd,
                        $s->btw_taxable_srd,
                        $s->btw_exempt_srd,
                        $s->total_btw_srd,
                        $statusLabel[$s->status] ?? $s->status,
                        optional($s->submitted_at)?->setTimezone('America/Paramaribo')->format('Y-m-d H:i'),
                        $s->submitter?->name ?? '',
                        optional($s->reviewed_at)?->setTimezone('America/Paramaribo')->format('Y-m-d H:i') ?? '',
                        $s->reviewer?->name ?? '',
                    ]);
                }
            });
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * GET /api/btw-submissions/inspector-dashboard
     *
     * KPI snapshot for the tax_inspector landing screen. Network-wide totals
     * across all organisations on the platform. Same gate as index (viewAny);
     * for tax_inspector + SA returns the full picture, for an OA returns the
     * same shape scoped to their own org (so they get a useful "my filing
     * health" tile too).
     */
    public function inspectorDashboard(Request $request): JsonResponse
    {
        $this->authorize('viewAny', BtwSubmission::class);

        $user = $request->user();
        $tz = config('josbin_pos.timezone', 'America/Paramaribo');
        $now = \Illuminate\Support\Carbon::now($tz);
        $monthStart    = $now->copy()->startOfMonth();
        $lastMonthStart = $now->copy()->subMonthNoOverflow()->startOfMonth();
        $lastMonthEnd  = $now->copy()->subMonthNoOverflow()->endOfMonth();

        $base = BtwSubmission::query();
        if (! $user->isCrossOrgRole()) {
            $base->where('organisation_id', $user->organisation_id);
        }
        // A Store Manager's dashboard is scoped to their own store.
        if ($user->isStoreBound()) {
            $base->where('store_id', $user->store_id);
        }

        // ── Headline KPIs ────────────────────────────────────────────────────
        $thisMonthBtw = (clone $base)
            ->where('status', '!=', BtwSubmission::STATUS_SUPERSEDED)
            ->whereDate('period_start', '>=', $monthStart->toDateString())
            ->sum('total_btw_srd');
        $lastMonthBtw = (clone $base)
            ->where('status', '!=', BtwSubmission::STATUS_SUPERSEDED)
            ->whereDate('period_start', '>=', $lastMonthStart->toDateString())
            ->whereDate('period_end',   '<=', $lastMonthEnd->toDateString())
            ->sum('total_btw_srd');

        $statusCounts = (clone $base)
            ->whereDate('submitted_at', '>=', $monthStart->toDateString())
            ->selectRaw('status, COUNT(*) as c')
            ->groupBy('status')
            ->pluck('c', 'status')
            ->toArray();

        $pendingCount  = (clone $base)->where('status', BtwSubmission::STATUS_FILED)->count();
        $disputedCount = (clone $base)->where('status', BtwSubmission::STATUS_DISPUTED)->count();

        // ── 30-day daily BTW trend (for the spark-line chart) ────────────────
        $trend = (clone $base)
            ->where('status', '!=', BtwSubmission::STATUS_SUPERSEDED)
            ->whereDate('period_end', '>=', $now->copy()->subDays(30)->toDateString())
            ->selectRaw('period_end::date as d, SUM(total_btw_srd) as btw')
            ->groupBy('d')
            ->orderBy('d')
            ->get()
            ->map(fn ($r) => ['date' => $r->d, 'btw_srd' => number_format((float) $r->btw, 2, '.', '')]);

        // ── Top orgs by BTW this month (inspector view; for OA = themselves) ─
        $topOrgs = (clone $base)
            ->where('status', '!=', BtwSubmission::STATUS_SUPERSEDED)
            ->whereDate('period_start', '>=', $monthStart->toDateString())
            ->selectRaw('organisation_id, SUM(total_btw_srd) as btw, COUNT(*) as filings')
            ->groupBy('organisation_id')
            ->orderByDesc('btw')
            ->limit(10)
            ->with('organisation:id,name')
            ->get()
            ->map(fn ($r) => [
                'organisation_id' => $r->organisation_id,
                'organisation_name' => $r->organisation->name ?? '—',
                'total_btw_srd' => number_format((float) $r->btw, 2, '.', ''),
                'filings'       => (int) $r->filings,
            ]);

        // ── Late-filing alert — orgs that haven't filed in >7 days ────────────
        // Cross-org only — surfaces orgs going dark to the inspector.
        $lateFilings = [];
        if ($user->isCrossOrgRole()) {
            $sevenDaysAgo = $now->copy()->subDays(7)->toDateString();
            $lateFilings = \DB::table('organisations as o')
                ->leftJoin('btw_submissions as b', function ($j) {
                    $j->on('o.id', '=', 'b.organisation_id')
                      ->whereNotIn('b.status', [BtwSubmission::STATUS_SUPERSEDED]);
                })
                ->where('o.is_active', true)
                ->groupBy('o.id', 'o.name')
                ->havingRaw('COALESCE(MAX(b.submitted_at)::date, ?) < ?', [
                    $now->copy()->subDays(365)->toDateString(), $sevenDaysAgo,
                ])
                ->orderByRaw('MAX(b.submitted_at) NULLS FIRST')
                ->limit(15)
                ->selectRaw('o.id, o.name, MAX(b.submitted_at) as last_submission_at')
                ->get()
                ->map(fn ($r) => [
                    'organisation_id' => $r->id,
                    'organisation_name' => $r->name,
                    'last_submission_at' => $r->last_submission_at,
                    'days_since' => $r->last_submission_at
                        ? (int) $now->diffInDays(\Illuminate\Support\Carbon::parse($r->last_submission_at))
                        : null,
                ])
                ->toArray();
        }

        return response()->json([
            'data' => [
                'generated_at'   => $now->toIso8601String(),
                'scope'          => $user->isCrossOrgRole() ? 'platform' : 'own_org',
                'totals' => [
                    'btw_this_month_srd' => number_format((float) $thisMonthBtw, 2, '.', ''),
                    'btw_last_month_srd' => number_format((float) $lastMonthBtw, 2, '.', ''),
                    'pending_review'     => $pendingCount,
                    'disputed_open'      => $disputedCount,
                    'this_month_by_status' => $statusCounts,
                ],
                'trend_30d'      => $trend,
                'top_orgs_month' => $topOrgs,
                'late_filings'   => $lateFilings,
            ],
        ]);
    }

    /**
     * GET /api/btw-submissions/{btwSubmission}/detail
     *
     * Enriched detail for one filing: per-store breakdown, per-payment-method
     * split, source-POS attribution (Josbin native vs third-party API), and
     * the audit-log timeline of the filing's events.
     */
    public function detail(Request $request, BtwSubmission $btwSubmission): JsonResponse
    {
        $this->authorize('view', $btwSubmission);

        $saleIds = is_array($btwSubmission->sale_ids) ? $btwSubmission->sale_ids : [];

        // Per-store breakdown (relevant when the filing is org-wide and spans
        // multiple stores). Each row: store + count + sales + BTW + exempt.
        $perStore = empty($saleIds) ? [] : \DB::table('sales as s')
            ->join('stores as st', 's.store_id', '=', 'st.id')
            ->whereIn('s.id', $saleIds)
            ->groupBy('st.id', 'st.name')
            ->selectRaw('
                st.id as store_id, st.name as store_name,
                COUNT(*) as tx_count,
                SUM(s.total_srd) as total_sales,
                SUM(s.btw_srd) as total_btw,
                SUM(CASE WHEN s.btw_srd = 0 THEN s.total_srd ELSE 0 END) as btw_exempt
            ')
            ->orderByDesc('total_btw')
            ->get()
            ->map(fn ($r) => [
                'store_id'       => $r->store_id,
                'store_name'     => $r->store_name,
                'tx_count'       => (int) $r->tx_count,
                'total_sales_srd'=> number_format((float) $r->total_sales, 2, '.', ''),
                'total_btw_srd'  => number_format((float) $r->total_btw,   2, '.', ''),
                'btw_exempt_srd' => number_format((float) $r->btw_exempt,  2, '.', ''),
            ]);

        // Source POS — 'pos' = Josbin native, 'api' = third-party via Layer 3.
        // Makes it visible whose POS contributed to the filing — important
        // when an org runs both our terminals AND a partner POS via the API.
        $perSource = empty($saleIds) ? [] : \DB::table('sales')
            ->whereIn('id', $saleIds)
            ->groupBy('source')
            ->selectRaw('source, COUNT(*) as c, SUM(total_srd) as t, SUM(btw_srd) as b')
            ->get()
            ->map(fn ($r) => [
                'source'         => $r->source,
                'source_label'   => match ($r->source) {
                    'pos'    => 'Josbin POS',
                    'api'    => 'External POS (Layer 3 API)',
                    'import' => 'Historical import',
                    default  => $r->source,
                },
                'tx_count'       => (int) $r->c,
                'total_sales_srd'=> number_format((float) $r->t, 2, '.', ''),
                'total_btw_srd'  => number_format((float) $r->b, 2, '.', ''),
            ])
            ->toArray();

        // Per payment method
        $perPaymentMethod = empty($saleIds) ? [] : \DB::table('sales')
            ->whereIn('id', $saleIds)
            ->groupBy('payment_method')
            ->selectRaw('payment_method, COUNT(*) as c, SUM(total_srd) as t')
            ->orderByDesc('t')
            ->get()
            ->map(fn ($r) => [
                'method'         => $r->payment_method,
                'tx_count'       => (int) $r->c,
                'total_srd'      => number_format((float) $r->t, 2, '.', ''),
            ])
            ->toArray();

        // Per BTW rate
        $perRate = empty($saleIds) ? [] : \DB::table('sale_items as si')
            ->join('sales as s', 'si.sale_id', '=', 's.id')
            ->whereIn('s.id', $saleIds)
            ->groupBy('si.btw_rate', 'si.btw_exempt')
            ->selectRaw('si.btw_rate, si.btw_exempt, SUM(si.btw_srd) as btw, SUM(si.line_total_srd) - SUM(si.btw_srd) as base')
            ->orderByDesc('btw')
            ->get()
            ->map(fn ($r) => [
                'rate'    => (string) $r->btw_rate,
                'exempt'  => (bool) $r->btw_exempt,
                'base_srd'=> number_format((float) $r->base, 2, '.', ''),
                'btw_srd' => number_format((float) $r->btw, 2, '.', ''),
            ])
            ->toArray();

        // Sale-level exemptions inside this filing period — the inspector's
        // answer to "why is there vrijgestelde omzet, and who granted it?".
        // Reason + forgone BTW are stamped on each sale at the till.
        $exemptSales = \App\Models\Sale::query()
            ->with(['store:id,name'])
            ->where('btw_exempt', true)
            ->whereHas('store', fn ($q) => $q->where('organisation_id', $btwSubmission->organisation_id))
            ->when($btwSubmission->store_id, fn ($q) => $q->where('store_id', $btwSubmission->store_id))
            ->where('occurred_at', '>=', \App\Support\AstDates::dayStart($btwSubmission->period_start->toDateString()))
            ->where('occurred_at', '<',  \App\Support\AstDates::dayAfter($btwSubmission->period_end->toDateString()))
            ->orderByDesc('occurred_at')
            ->limit(500)
            ->get();

        $exemptions = [
            'count'               => $exemptSales->count(),
            'exempt_turnover_srd' => number_format($exemptSales->sum(fn ($s) => (float) $s->total_srd), 2, '.', ''),
            'btw_forgone_srd'     => number_format($exemptSales->sum(fn ($s) => (float) ($s->btw_exempt_forgone_srd ?? 0)), 2, '.', ''),
            'rows'                => $exemptSales->map(fn ($s) => [
                'sale_number'     => $s->sale_number,
                'occurred_at'     => $s->occurred_at?->toIso8601String(),
                'store'           => $s->store?->name,
                'reason'          => $s->btw_exempt_reason,
                'total_srd'       => (string) $s->total_srd,
                'btw_forgone_srd' => $s->btw_exempt_forgone_srd !== null ? (string) $s->btw_exempt_forgone_srd : null,
            ]),
        ];

        // Timeline of audit-log events touching this submission
        $timeline = \DB::table('audit_logs')
            ->where('auditable_type', 'btw_submission')
            ->where('auditable_id',   $btwSubmission->id)
            ->orderBy('created_at')
            ->get(['id', 'event', 'user_id', 'new_values', 'created_at'])
            ->map(fn ($r) => [
                'id'         => $r->id,
                'event'      => $r->event,
                'user_id'    => $r->user_id,
                'new_values' => $r->new_values ? json_decode($r->new_values, true) : null,
                'created_at' => $r->created_at,
            ]);

        return response()->json([
            'data' => [
                'submission' => $btwSubmission->load(
                    'organisation:id,name,btw_number',
                    'store:id,name',
                    'submitter:id,name,email',
                    'reviewer:id,name,email',
                ),
                'breakdown' => [
                    'per_store'          => $perStore,
                    'per_source'         => $perSource,
                    'per_payment_method' => $perPaymentMethod,
                    'per_btw_rate'       => $perRate,
                ],
                'exemptions' => $exemptions,
                'timeline'  => $timeline,
            ],
        ]);
    }

    /**
     * POST /api/btw-submissions/preview
     * Dry-run totals — does NOT save anything. Lets OA confirm the numbers
     * before clicking Submit.
     */
    public function preview(Request $request): JsonResponse
    {
        $this->authorize('create', BtwSubmission::class);

        $data = $this->validatePayload($request, isPreview: true);
        $orgId = $request->user()->organisation_id;

        $totals = $this->service->computeTotals(
            $orgId,
            $data['store_id'] ?? null,
            Carbon::parse($data['period_start']),
            Carbon::parse($data['period_end']),
        );

        // Check whether this period has already been filed (warns the OA so
        // they know they're about to supersede an existing filing).
        $existing = BtwSubmission::query()
            ->where('organisation_id', $orgId)
            ->where('period_type', $data['period_type'])
            ->where('period_start', $data['period_start'])
            ->where('period_end', $data['period_end'])
            ->where(fn ($q) => empty($data['store_id'])
                ? $q->whereNull('store_id')
                : $q->where('store_id', $data['store_id']))
            ->whereIn('status', [BtwSubmission::STATUS_FILED, BtwSubmission::STATUS_ACCEPTED])
            ->first(['id', 'reference', 'status', 'submitted_at']);

        return response()->json([
            'period_type'    => $data['period_type'],
            'period_start'   => $data['period_start'],
            'period_end'     => $data['period_end'],
            'store_id'       => $data['store_id'] ?? null,
            'totals'         => array_diff_key($totals, ['sale_ids' => true]),
            'sale_count'     => $totals['sales_count'],
            'existing'       => $existing,
        ]);
    }

    /** POST /api/btw-submissions — file the submission for real */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', BtwSubmission::class);

        $data = $this->validatePayload($request, isPreview: false);
        $user = $request->user();
        $orgId = $user->organisation_id;

        $start = Carbon::parse($data['period_start']);
        $end   = Carbon::parse($data['period_end']);

        // Idempotency: a filing already exists for (org, period_type, range).
        // If it's filed/accepted, reject with 409 — OA must explicitly
        // supersede via PUT (future). If superseded/disputed, allow new filing.
        $blocking = BtwSubmission::query()
            ->where('organisation_id', $orgId)
            ->where('period_type', $data['period_type'])
            ->where('period_start', $data['period_start'])
            ->where('period_end', $data['period_end'])
            ->where(fn ($q) => empty($data['store_id'])
                ? $q->whereNull('store_id')
                : $q->where('store_id', $data['store_id']))
            ->whereIn('status', [BtwSubmission::STATUS_FILED, BtwSubmission::STATUS_ACCEPTED])
            ->first();

        if ($blocking) {
            return response()->json([
                'message' => 'A BTW submission already exists for this period. Mark the existing one disputed first if you need to resubmit.',
                'code'    => 'BTW_ALREADY_FILED',
                'existing' => [
                    'id'        => $blocking->id,
                    'reference' => $blocking->reference,
                    'status'    => $blocking->status,
                ],
            ], 409);
        }

        $submission = DB::transaction(function () use ($data, $orgId, $start, $end, $user) {
            $totals = $this->service->computeTotals($orgId, $data['store_id'] ?? null, $start, $end);

            $reference = $this->service->nextReference($orgId, $data['period_type'], $start);

            // Canonical row for the hash chain.
            $canonical = [
                'organisation_id' => $orgId,
                'store_id'        => $data['store_id'] ?? null,
                'period_type'     => $data['period_type'],
                'period_start'    => $start->toDateString(),
                'period_end'      => $end->toDateString(),
                'sales_count'     => $totals['sales_count'],
                'total_sales_srd' => $totals['total_sales_srd'],
                'btw_exempt_srd'  => $totals['btw_exempt_srd'],
                'btw_taxable_srd' => $totals['btw_taxable_srd'],
                'total_btw_srd'   => $totals['total_btw_srd'],
                'submitted_at'    => now()->toIso8601String(),
                'submitted_by'    => $user->id,
                'reference'       => $reference,
            ];
            $hash = $this->service->hashChain($canonical['organisation_id'], $canonical);

            $submission = BtwSubmission::create([
                'organisation_id' => $orgId,
                'store_id'        => $data['store_id'] ?? null,
                'period_type'     => $data['period_type'],
                'period_start'    => $start->toDateString(),
                'period_end'      => $end->toDateString(),
                'sales_count'     => $totals['sales_count'],
                'total_sales_srd' => $totals['total_sales_srd'],
                'btw_exempt_srd'  => $totals['btw_exempt_srd'],
                'btw_taxable_srd' => $totals['btw_taxable_srd'],
                'total_btw_srd'   => $totals['total_btw_srd'],
                'status'          => BtwSubmission::STATUS_FILED,
                'submitted_at'    => now(),
                'submitted_by'    => $user->id,
                'reference'       => $reference,
                'submitter_note'  => $data['submitter_note'] ?? null,
                'sale_ids'        => $totals['sale_ids'],
                'prev_hash'       => $hash['prev_hash'],
                'current_hash'    => $hash['current_hash'],
            ]);

            \App\Models\AuditLog::create([
                'user_id'         => $user->id,
                'organisation_id' => $orgId,
                'event'           => 'btw.submitted',
                'auditable_type'  => 'btw_submission',
                'auditable_id'    => $submission->id,
                'old_values'      => null,
                'new_values'      => [
                    'reference'    => $reference,
                    'period'       => "{$start->toDateString()}→{$end->toDateString()}",
                    'period_type'  => $data['period_type'],
                    'total_sales'  => $totals['total_sales_srd'],
                    'total_btw'    => $totals['total_btw_srd'],
                ],
                'ip_address'      => request()->ip(),
                'created_at'      => now(),
            ]);

            return $submission;
        });

        // Ping the Belastingdienst inspectors only for the FORMAL MONTHLY
        // filing — that's the legal return that needs review. Daily/weekly are
        // interim and just sit in the inspector's list/queue, so a shop that
        // files daily doesn't spam the inspector's bell. (Resubmits always
        // ping, regardless of period — they follow a dispute the inspector
        // raised.) Best-effort; never blocks the filing.
        if ($submission->period_type === BtwSubmission::PERIOD_MONTHLY) {
            $this->notifyInspectors($submission, new \App\Notifications\BtwFilingSubmitted($submission));
        }

        return response()->json([
            'data' => $submission->fresh()->load('organisation:id,name', 'store:id,name', 'submitter:id,name'),
        ], 201);
    }

    /** GET /api/btw-submissions/{submission} */
    public function show(Request $request, BtwSubmission $btwSubmission): JsonResponse
    {
        $this->authorize('view', $btwSubmission);

        return response()->json([
            'data' => $btwSubmission->load(
                'organisation:id,name,btw_number',
                'store:id,name',
                'submitter:id,name,email',
                'reviewer:id,name,email',
            ),
        ]);
    }

    /** POST /api/btw-submissions/{submission}/accept */
    /**
     * POST /api/btw-submissions/bulk-accept
     *
     * Inspector marks many FILED submissions reviewed & accepted in one action.
     * Each is authorised individually (cross-org inspector passes; a non-review
     * role is skipped, not errored) and only 'filed' rows transition — anything
     * already accepted/disputed/superseded is skipped. Every accept still writes
     * its own btw.accepted audit row.
     */
    public function bulkAccept(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids'            => ['required', 'array', 'min:1', 'max:200'],
            'ids.*'          => ['uuid'],
            'inspector_note' => ['nullable', 'string', 'max:2000'],
        ]);

        $accepted = 0;
        $skipped  = 0;
        $acceptedSubs = [];

        \DB::transaction(function () use ($data, $request, &$accepted, &$skipped, &$acceptedSubs) {
            $subs = BtwSubmission::whereIn('id', $data['ids'])->lockForUpdate()->get();
            foreach ($subs as $sub) {
                if (! $request->user()->can('review', $sub) || $sub->status !== BtwSubmission::STATUS_FILED) {
                    $skipped++;
                    continue;
                }
                $sub->update([
                    'status'         => BtwSubmission::STATUS_ACCEPTED,
                    'reviewed_at'    => now(),
                    'reviewed_by'    => $request->user()->id,
                    'inspector_note' => $data['inspector_note'] ?? $sub->inspector_note,
                ]);
                \App\Models\AuditLog::create([
                    'user_id'         => $request->user()->id,
                    'organisation_id' => $sub->organisation_id,
                    'event'           => 'btw.accepted',
                    'auditable_type'  => 'btw_submission',
                    'auditable_id'    => $sub->id,
                    'old_values'      => ['status' => BtwSubmission::STATUS_FILED],
                    'new_values'      => ['status' => BtwSubmission::STATUS_ACCEPTED, 'bulk' => true, 'note' => $data['inspector_note'] ?? null],
                    'ip_address'      => $request->ip(),
                    'created_at'      => now(),
                ]);
                $accepted++;
                $acceptedSubs[] = $sub;
            }
        });

        // Notify each taxpayer after the transaction commits (queued).
        foreach ($acceptedSubs as $sub) {
            $this->notifyAccepted($sub);
        }

        return response()->json(['accepted' => $accepted, 'skipped' => $skipped]);
    }

    public function accept(Request $request, BtwSubmission $btwSubmission): JsonResponse
    {
        $this->authorize('review', $btwSubmission);

        $request->validate([
            'inspector_note' => ['nullable', 'string', 'max:2000'],
        ]);

        $btwSubmission->update([
            'status'         => BtwSubmission::STATUS_ACCEPTED,
            'reviewed_at'    => now(),
            'reviewed_by'    => $request->user()->id,
            'inspector_note' => $request->input('inspector_note'),
        ]);

        \App\Models\AuditLog::create([
            'user_id'         => $request->user()->id,
            'organisation_id' => $btwSubmission->organisation_id,
            'event'           => 'btw.accepted',
            'auditable_type'  => 'btw_submission',
            'auditable_id'    => $btwSubmission->id,
            'old_values'      => ['status' => BtwSubmission::STATUS_FILED],
            'new_values'      => ['status' => BtwSubmission::STATUS_ACCEPTED, 'note' => $request->input('inspector_note')],
            'ip_address'      => $request->ip(),
            'created_at'      => now(),
        ]);

        // Closure confirmation to the taxpayer (in-app bell + email).
        $this->notifyAccepted($btwSubmission);

        return response()->json(['data' => $btwSubmission->fresh()->load('reviewer:id,name')]);
    }

    /** POST /api/btw-submissions/{submission}/dispute */
    public function dispute(Request $request, BtwSubmission $btwSubmission): JsonResponse
    {
        $this->authorize('review', $btwSubmission);

        $data = $request->validate([
            'inspector_note' => ['required', 'string', 'min:5', 'max:2000'],
        ]);

        $btwSubmission->update([
            'status'         => BtwSubmission::STATUS_DISPUTED,
            'reviewed_at'    => now(),
            'reviewed_by'    => $request->user()->id,
            'inspector_note' => $data['inspector_note'],
        ]);

        \App\Models\AuditLog::create([
            'user_id'         => $request->user()->id,
            'organisation_id' => $btwSubmission->organisation_id,
            'event'           => 'btw.disputed',
            'auditable_type'  => 'btw_submission',
            'auditable_id'    => $btwSubmission->id,
            'old_values'      => ['status' => BtwSubmission::STATUS_FILED],
            'new_values'      => ['status' => BtwSubmission::STATUS_DISPUTED, 'note' => $data['inspector_note']],
            'ip_address'      => $request->ip(),
            'created_at'      => now(),
        ]);

        // Push notification to the taxpayer (org admins + the original submitter)
        // so they actually know to act — best-effort, never blocks the dispute.
        $this->notifyDisputed($btwSubmission, $data['inspector_note']);

        return response()->json(['data' => $btwSubmission->fresh()->load('reviewer:id,name')]);
    }

    private function notifyDisputed(BtwSubmission $s, string $reason): void
    {
        $this->notifyTaxpayer($s, new \App\Notifications\BtwFilingDisputed($s, $reason));
    }

    private function notifyAccepted(BtwSubmission $s): void
    {
        $this->notifyTaxpayer($s, new \App\Notifications\BtwFilingAccepted($s));
    }

    /**
     * Notify the taxpayer (org admins + the filing's submitter) via both the
     * in-app bell (database channel) and email. The notifications are queued,
     * so a mail/queue hiccup can never break the inspector's action — and a
     * failed mail job can't suppress the in-app notification for anyone.
     */
    private function notifyTaxpayer(BtwSubmission $s, \Illuminate\Notifications\Notification $notification): void
    {
        try {
            $recipients = \App\Models\User::query()
                ->where('organisation_id', $s->organisation_id)
                ->where('is_active', true)
                ->where(fn ($q) => $q->where('role', \App\Models\User::ROLE_ORGANISATION_ADMIN)
                    ->orWhere('id', $s->submitted_by))
                ->get();

            if ($recipients->isEmpty()) {
                return;
            }

            \Illuminate\Support\Facades\Notification::send($recipients, $notification);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('[BTW] taxpayer notification failed', [
                'submission'   => $s->id,
                'notification' => $notification::class,
                'error'        => $e->getMessage(),
            ]);
        }
    }

    /**
     * POST /api/btw-submissions/{btwSubmission}/supersede
     *
     * Marks the original submission as 'superseded' and creates a brand-new
     * 'filed' row for the same period, with totals recomputed from current
     * sales (so any voids/refunds since the original filing are reflected).
     *
     * Both rows survive in the audit trail. The Belastingdienst inspector
     * sees the new filing in their queue; the old reference number stays
     * looked-up-able with status='superseded' and a link to the replacement
     * via inspector_note.
     */
    public function supersede(Request $request, BtwSubmission $btwSubmission): JsonResponse
    {
        $this->authorize('supersede', $btwSubmission);

        $note = $request->validate([
            'submitter_note' => ['nullable', 'string', 'max:2000'],
        ])['submitter_note'] ?? null;

        $newSubmission = DB::transaction(function () use ($btwSubmission, $note, $request) {
            // 1. Recompute totals for the same period — picks up post-filing
            //    voids/refunds, so the corrected filing is current.
            $totals = $this->service->computeTotals(
                $btwSubmission->organisation_id,
                $btwSubmission->store_id,
                Carbon::parse($btwSubmission->period_start),
                Carbon::parse($btwSubmission->period_end),
            );

            $reference = $this->service->nextReference(
                $btwSubmission->organisation_id,
                $btwSubmission->period_type,
                Carbon::parse($btwSubmission->period_start),
            );

            $canonical = [
                'organisation_id' => $btwSubmission->organisation_id,
                'store_id'        => $btwSubmission->store_id,
                'period_type'     => $btwSubmission->period_type,
                'period_start'    => $btwSubmission->period_start->toDateString(),
                'period_end'      => $btwSubmission->period_end->toDateString(),
                'sales_count'     => $totals['sales_count'],
                'total_sales_srd' => $totals['total_sales_srd'],
                'btw_exempt_srd'  => $totals['btw_exempt_srd'],
                'btw_taxable_srd' => $totals['btw_taxable_srd'],
                'total_btw_srd'   => $totals['total_btw_srd'],
                'submitted_at'    => now()->toIso8601String(),
                'submitted_by'    => $request->user()->id,
                'reference'       => $reference,
                'supersedes'      => $btwSubmission->reference,
            ];
            $hash = $this->service->hashChain($canonical['organisation_id'], $canonical);

            // 2. Mark the old filing superseded BEFORE inserting the new one,
            //    because the (org, period_type, period_start, period_end)
            //    unique constraint allows only one non-superseded filing per
            //    period at a time. Same reason we update status first.
            $btwSubmission->update([
                'status'         => BtwSubmission::STATUS_SUPERSEDED,
                'inspector_note' => trim(($btwSubmission->inspector_note ?? '') . "\n[Superseded by " . $reference . " on " . now()->toIso8601String() . "]"),
            ]);

            // The partial unique index `btw_subs_active_period_unique` covers
            // (org, period_type, period_start, period_end) WHERE status <>
            // 'superseded' (see 2026_05_26_070001_btw_submissions_partial_unique).
            // Moving the original to 'superseded' above therefore frees the
            // period, so the new 'filed' row below inserts cleanly — and a
            // period can be resubmitted any number of times.

            $newSubmission = BtwSubmission::create([
                'organisation_id' => $btwSubmission->organisation_id,
                'store_id'        => $btwSubmission->store_id,
                'period_type'     => $btwSubmission->period_type,
                'period_start'    => $btwSubmission->period_start,
                'period_end'      => $btwSubmission->period_end,
                'sales_count'     => $totals['sales_count'],
                'total_sales_srd' => $totals['total_sales_srd'],
                'btw_exempt_srd'  => $totals['btw_exempt_srd'],
                'btw_taxable_srd' => $totals['btw_taxable_srd'],
                'total_btw_srd'   => $totals['total_btw_srd'],
                'status'          => BtwSubmission::STATUS_FILED,
                'submitted_at'    => now(),
                'submitted_by'    => $request->user()->id,
                'reference'       => $reference,
                'submitter_note'  => $note,
                'sale_ids'        => $totals['sale_ids'],
                'prev_hash'       => $hash['prev_hash'],
                'current_hash'    => $hash['current_hash'],
            ]);

            \App\Models\AuditLog::create([
                'user_id'         => $request->user()->id,
                'organisation_id' => $btwSubmission->organisation_id,
                'event'           => 'btw.superseded',
                'auditable_type'  => 'btw_submission',
                'auditable_id'    => $btwSubmission->id,
                'old_values'      => ['status' => $btwSubmission->getOriginal('status')],
                'new_values'      => [
                    'status'             => BtwSubmission::STATUS_SUPERSEDED,
                    'replacement_ref'    => $reference,
                    'replacement_id'     => $newSubmission->id,
                    'submitter_note'     => $note,
                ],
                'ip_address'      => $request->ip(),
                'created_at'      => now(),
            ]);

            return $newSubmission;
        });

        // Tell the Belastingdienst inspectors a corrected filing is waiting.
        $this->notifyInspectors($newSubmission, new \App\Notifications\BtwFilingResubmitted($newSubmission));

        return response()->json([
            'data' => $newSubmission->fresh()->load('organisation:id,name', 'store:id,name', 'submitter:id,name'),
        ], 201);
    }

    /** Notify all active Belastingdienst inspectors (in-app + email), best-effort. */
    private function notifyInspectors(BtwSubmission $s, \Illuminate\Notifications\Notification $notification): void
    {
        try {
            $inspectors = \App\Models\User::query()
                ->where('role', \App\Models\User::ROLE_TAX_INSPECTOR)
                ->where('is_active', true)
                ->get();

            if ($inspectors->isEmpty()) {
                return;
            }

            \Illuminate\Support\Facades\Notification::send($inspectors, $notification);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('[BTW] inspector notification failed', [
                'submission'   => $s->id,
                'notification' => $notification::class,
                'error'        => $e->getMessage(),
            ]);
        }
    }

    /**
     * Shared validation for preview + store. Preview doesn't require the
     * submitter_note (since it's a dry-run); store accepts it but it's optional.
     */
    private function validatePayload(Request $request, bool $isPreview): array
    {
        $rules = [
            'period_type'    => ['required', Rule::in(BtwSubmission::PERIOD_TYPES)],
            'period_start'   => ['required', 'date', 'before_or_equal:today'],
            'period_end'     => ['required', 'date', 'after_or_equal:period_start', 'before_or_equal:today'],
            'store_id'       => ['nullable', 'uuid', 'exists:stores,id'],
            'submitter_note' => ['nullable', 'string', 'max:2000'],
        ];

        $data = $request->validate($rules);

        // Period-type ↔ date-range consistency. Daily = single day.
        // Monthly = exactly one calendar month (start = 1st, end = last day).
        $start = Carbon::parse($data['period_start']);
        $end   = Carbon::parse($data['period_end']);

        if ($data['period_type'] === BtwSubmission::PERIOD_DAILY && ! $start->isSameDay($end)) {
            throw ValidationException::withMessages([
                'period_end' => 'For daily submissions, period_start and period_end must be the same day.',
            ]);
        }
        if ($data['period_type'] === BtwSubmission::PERIOD_MONTHLY && (
            ! $start->isStartOfMonth() || ! $end->isSameDay($start->copy()->endOfMonth())
        )) {
            throw ValidationException::withMessages([
                'period_start' => 'For monthly submissions, period_start must be the first day and period_end the last day of the same month.',
            ]);
        }

        // Store scope.
        $user = $request->user();
        if ($user->isStoreBound()) {
            // A Store Manager files ONLY for their own store — force it,
            // ignoring any store_id the client sent. BTW is legally an
            // organisation-level return, so the consolidated org-wide filing
            // stays the Org Admin's job; an SM's filing is their store's slice.
            if (! $user->store_id) {
                throw ValidationException::withMessages([
                    'store_id' => 'No store is assigned to your account. Ask your manager to assign one before filing BTW.',
                ]);
            }
            $data['store_id'] = $user->store_id;
        } elseif (! empty($data['store_id'])) {
            // Org Admin (or SA) naming a specific store: it must be reachable
            // within their organisation.
            if (! $user->canAccessStore($data['store_id'])) {
                throw ValidationException::withMessages([
                    'store_id' => 'Store does not belong to your organisation.',
                ]);
            }
        }
        // else: Org Admin org-wide filing (store_id null) — the formal
        // consolidated Belastingdienst return covering every store.

        return $data;
    }
}
