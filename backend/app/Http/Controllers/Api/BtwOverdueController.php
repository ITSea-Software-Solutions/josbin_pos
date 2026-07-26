<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\BtwFilingReminder;
use App\Models\BtwInspectionCase;
use App\Models\Store;
use App\Models\User;
use App\Notifications\BtwFilingOverdue;
use App\Notifications\BtwInspectionCaseOpened;
use App\Services\BtwOverdueService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * BTW late-filing oversight for the tax inspector (+ SA), feature BTW-FILING-16:
 *
 *   GET   /api/btw-submissions/overdue                  stores overdue on filing
 *   PATCH /api/btw-submissions/overdue/{store}/period   set a store's filing cadence
 *   POST  /api/btw-submissions/overdue/{store}/remind   remind the store (logged)
 *   POST  /api/btw-submissions/overdue/{store}/escalate open an inspection case (>=3 reminders)
 *
 * Inspector/SA only; every action is audit-logged.
 */
class BtwOverdueController extends Controller
{
    public const ESCALATION_THRESHOLD = 3;

    public function __construct(
        private readonly BtwOverdueService $service,
    ) {}

    /** GET /api/btw-submissions/overdue */
    public function index(Request $request): JsonResponse
    {
        $this->authorizeInspector($request);

        $rows = $this->service->overdueStores()
            ->map(fn (array $r) => [
                'store_id'               => $r['store']->id,
                'store_name'             => $r['store']->name,
                'organisation_id'        => $r['organisation']?->id,
                'organisation_name'      => $r['organisation']?->name,
                'period_days'            => $r['period_days'],
                'last_filing_period_end' => $r['last_filing_period_end'],
                'days_since_last_filing' => $r['days_since_last_filing'],
                'days_overdue'           => $r['days_overdue'],
                'reminder_count'         => $r['inspector_reminders'],
                'can_escalate'           => $r['inspector_reminders'] >= self::ESCALATION_THRESHOLD && ! $r['open_case'],
                'open_case_id'           => $r['open_case']?->id,
            ])
            ->sortByDesc('days_overdue')
            ->values();

        return response()->json([
            'data'                 => $rows,
            'escalation_threshold' => self::ESCALATION_THRESHOLD,
        ]);
    }

    /** PATCH /api/btw-submissions/overdue/{store}/period */
    public function setPeriod(Request $request, Store $store): JsonResponse
    {
        $this->authorizeInspector($request);

        $data = $request->validate([
            'btw_filing_period_days' => ['required', 'integer', 'min:1', 'max:365'],
        ]);

        $old = $store->btw_filing_period_days;
        $store->update(['btw_filing_period_days' => $data['btw_filing_period_days']]);

        $this->audit($request, $store, 'btw.filing_period_set', [
            'from' => $old,
            'to'   => $store->btw_filing_period_days,
        ]);

        return response()->json([
            'store_id'               => $store->id,
            'btw_filing_period_days' => $store->btw_filing_period_days,
        ]);
    }

    /** POST /api/btw-submissions/overdue/{store}/remind */
    public function remind(Request $request, Store $store): JsonResponse
    {
        $this->authorizeInspector($request);

        $data = $request->validate([
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $lastFiling  = $this->service->lastFilingFor($store);
        $daysOverdue = $this->daysOverdue($store, $lastFiling);

        BtwFilingReminder::create([
            'store_id'        => $store->id,
            'organisation_id' => $store->organisation_id,
            'source'          => BtwFilingReminder::SOURCE_INSPECTOR,
            'sent_by'         => $request->user()->id,
            'days_overdue'    => $daysOverdue,
            'note'            => $data['note'] ?? null,
        ]);

        $managers = $this->storeManagers($store);
        if ($managers->isNotEmpty()) {
            Notification::send($managers, new BtwFilingOverdue($store, $daysOverdue, BtwFilingReminder::SOURCE_INSPECTOR));
        }

        $count = $this->service->inspectorReminderCount($store, $lastFiling);

        $this->audit($request, $store, 'btw.reminded', [
            'days_overdue'   => $daysOverdue,
            'reminder_count' => $count,
        ]);

        return response()->json([
            'store_id'       => $store->id,
            'reminder_count' => $count,
            'can_escalate'   => $count >= self::ESCALATION_THRESHOLD,
        ]);
    }

    /** POST /api/btw-submissions/overdue/{store}/escalate */
    public function escalate(Request $request, Store $store): JsonResponse
    {
        $this->authorizeInspector($request);

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $lastFiling = $this->service->lastFilingFor($store);
        $count      = $this->service->inspectorReminderCount($store, $lastFiling);

        if ($count < self::ESCALATION_THRESHOLD) {
            throw ValidationException::withMessages([
                'store' => 'At least ' . self::ESCALATION_THRESHOLD . ' reminders are required before an inspection case can be opened.',
            ]);
        }

        if (BtwInspectionCase::where('store_id', $store->id)->where('status', BtwInspectionCase::STATUS_OPEN)->exists()) {
            throw ValidationException::withMessages([
                'store' => 'An inspection case is already open for this store.',
            ]);
        }

        $daysOverdue = $this->daysOverdue($store, $lastFiling);

        $case = BtwInspectionCase::create([
            'store_id'        => $store->id,
            'organisation_id' => $store->organisation_id,
            'opened_by'       => $request->user()->id,
            'days_overdue'    => $daysOverdue,
            'reminder_count'  => $count,
            'reason'          => $data['reason'] ?? null,
            'status'          => BtwInspectionCase::STATUS_OPEN,
        ]);

        // Notify the inspectors' enforcement queue (tax inspectors + SA).
        $inspectors = User::query()
            ->whereIn('role', [User::ROLE_TAX_INSPECTOR, User::ROLE_SUPER_ADMIN])
            ->where('is_active', true)
            ->get();
        if ($inspectors->isNotEmpty()) {
            Notification::send($inspectors, new BtwInspectionCaseOpened($case, $store->name));
        }

        $this->audit($request, $store, 'btw.inspection_opened', [
            'case_id'        => $case->id,
            'days_overdue'   => $daysOverdue,
            'reminder_count' => $count,
        ]);

        return response()->json(['data' => $case], 201);
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private function authorizeInspector(Request $request): void
    {
        abort_unless(
            in_array($request->user()->role, [User::ROLE_TAX_INSPECTOR, User::ROLE_SUPER_ADMIN], true),
            403,
            'Only tax inspectors can manage BTW late filings.'
        );
    }

    private function daysOverdue(Store $store, ?\App\Models\BtwSubmission $lastFiling): int
    {
        $period = $store->btw_filing_period_days ?: 30;

        return max(0, $this->service->daysSinceLastFiling($store, $lastFiling) - $period);
    }

    /** OA + SM (store-scoped) who should receive a store's reminder. */
    private function storeManagers(Store $store)
    {
        return User::query()
            ->where('organisation_id', $store->organisation_id)
            ->where('is_active', true)
            ->where(function ($q) use ($store) {
                $q->where('role', User::ROLE_ORGANISATION_ADMIN)
                  ->orWhere(function ($qq) use ($store) {
                      $qq->where('role', User::ROLE_STORE_MANAGER)
                         ->where(fn ($s) => $s->whereNull('store_id')->orWhere('store_id', $store->id));
                  });
            })
            ->get();
    }

    private function audit(Request $request, Store $store, string $event, array $newValues): void
    {
        AuditLog::create([
            'user_id'         => $request->user()->id,
            'organisation_id' => $store->organisation_id,
            'event'           => $event,
            'auditable_type'  => 'store',
            'auditable_id'    => $store->id,
            'old_values'      => null,
            'new_values'      => $newValues,
            'ip_address'      => $request->ip(),
            'created_at'      => now(),
        ]);
    }
}
