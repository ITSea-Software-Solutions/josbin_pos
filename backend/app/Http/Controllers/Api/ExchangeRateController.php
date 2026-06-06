<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyRate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;

class ExchangeRateController extends Controller
{
    /** GET /api/rates — today's rate + 7-day history */
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('rates.view'), 403);

        $today = today()->toDateString();
        $rates = DailyRate::query()
            ->orderByDesc('date')
            ->take(30)
            ->get(['id', 'date', 'usd_to_srd', 'raw_rate', 'markup_pct', 'source', 'locked_at', 'locked_by']);

        $todayRate = $rates->first(fn ($r) => $r->date->toDateString() === $today);

        return response()->json([
            'data' => [
                'today'   => $todayRate,
                'history' => $rates,
            ],
        ]);
    }

    /** POST /api/rates/override — manual rate override */
    public function override(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('rates.override'), 403);

        $data = $request->validate([
            'rate_srd'    => ['required', 'numeric', 'min:0.01'],
            'markup_pct'  => ['nullable', 'numeric', 'min:0', 'max:50'],
        ]);

        $today = today()->toDateString();
        // Authorised manual override — deliberately allowed to overwrite an
        // already-locked rate (this is the human escape hatch the lock guard
        // points users toward).
        $rate = DailyRate::withoutLockGuard(fn () => DailyRate::updateOrCreate(
            ['date' => $today],
            [
                'usd_to_srd'  => number_format($data['rate_srd'], 4, '.', ''),
                'raw_rate'    => number_format($data['rate_srd'], 4, '.', ''),
                'markup_pct'  => number_format($data['markup_pct'] ?? 0, 2, '.', ''),
                'source'      => 'manual',
                'locked_by'   => $request->user()->id,
                'locked_at'   => now(),
            ]
        ));

        Cache::put('daily_rate:' . $today, $rate->usd_to_srd, 86400);

        return response()->json(['data' => $rate]);
    }

    /** POST /api/rates/fetch — trigger rate:lock command on demand */
    public function fetch(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('rates.lock'), 403);

        Artisan::call('rates:lock', ['--force' => $request->boolean('force')]);
        $output = Artisan::output();

        $today = today()->toDateString();
        $rate  = DailyRate::where('date', $today)->first();

        return response()->json([
            'message' => trim($output),
            'data'    => $rate,
        ]);
    }
}
