<?php

namespace App\Services;

use App\Models\Sale;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;

class ReceiptService
{
    /**
     * Build the view data array for a receipt (both PDF and email templates).
     *
     * @param  Sale   $sale
     * @param  string $locale  'nl' or 'en'
     * @param  array  $extraCashData  ['cash_tendered' => X, 'change' => Y] for POS cash payments
     */
    public function buildViewData(Sale $sale, string $locale = 'nl', array $extraCashData = []): array
    {
        $sale->loadMissing(['items', 'cashier', 'customer', 'store.organisation']);

        $store  = $sale->store;
        $locale = in_array($locale, ['nl', 'en']) ? $locale : 'nl';

        // Date in DD-MM-YYYY HH:MM AST (Dutch default) or MM/DD/YYYY (English)
        $dateFormat = $locale === 'nl' ? 'd-m-Y H:i' : 'm/d/Y H:i';
        $occurredAt = Carbon::parse($sale->occurred_at)
            ->setTimezone('America/Paramaribo')
            ->format($dateFormat);

        // Build item rows
        $items = $sale->items->map(fn ($item) => [
            'product_name' => $item->product_name_snapshot,
            'quantity'     => rtrim(rtrim(number_format((float) $item->quantity, 3, '.', ''), '0'), '.'),
            'unit_price'   => number_format((float) $item->unit_price_srd, 2, '.', ','),
            'line_total'   => number_format((float) $item->line_total_srd, 2, '.', ','),
            'discount'     => number_format((float) $item->discount_srd, 2, '.', ','),
            'btw_rate'     => $item->btw_rate,
            'btw_exempt'   => $item->btw_exempt,
        ])->toArray();

        // BTW breakdown by rate
        $btwItems = $sale->items
            ->where('btw_exempt', false)
            ->where('btw_rate', '>', 0)
            ->groupBy('btw_rate')
            ->map(fn ($group, $rate) => [
                'rate' => number_format((float) $rate, 2, '.', ''),
                'base' => number_format($group->sum(fn ($i) => (float) $i->line_total_srd - (float) $i->btw_srd), 2, '.', ','),
                'btw'  => number_format($group->sum(fn ($i) => (float) $i->btw_srd), 2, '.', ','),
            ])
            ->values()
            ->toArray();

        $cashTendered = $extraCashData['cash_tendered'] ?? 0;
        $change       = $extraCashData['change'] ?? 0;

        // Multi-currency: show USD equivalent if exchange rate is available
        $exchangeRate = (float) ($sale->exchange_rate_used ?? 0);
        $totalUsd     = null;
        if ($exchangeRate > 0) {
            $totalUsd = number_format(
                (float) $sale->total_srd / $exchangeRate,
                2, '.', ','
            );
        }

        return [
            'locale' => $locale,
            'store'  => [
                'name'           => $store->name,
                'receipt_header' => $store->receipt_header ?? '',
                'receipt_footer' => $store->receipt_footer ?? '',
                'btw_number'     => $store->organisation?->btw_number ?? '',
            ],
            'sale' => [
                'sale_number'    => $sale->sale_number,
                'occurred_at'    => $occurredAt,
                'cashier_name'   => $sale->cashier?->name ?? '—',
                'customer_name'  => $sale->customer?->name ?? null,
                'subtotal'       => number_format((float) $sale->subtotal_srd, 2, '.', ','),
                'sale_discount'  => (float) $sale->discount_srd,
                'btw_total'      => number_format((float) $sale->btw_srd, 2, '.', ','),
                'total'          => number_format((float) $sale->total_srd, 2, '.', ','),
                'total_usd'      => $totalUsd,     // null if no rate on record
                'exchange_rate'  => $exchangeRate > 0 ? number_format($exchangeRate, 4, '.', '') : null,
                'payment_method' => $sale->payment_method,
                'cash_tendered'  => number_format((float) $cashTendered, 2, '.', ','),
                'change'         => number_format((float) $change, 2, '.', ','),
                'items'          => $items,
            ],
            'btw_items' => $btwItems ?: null,
            't'         => $this->translations($locale),
        ];
    }

    /**
     * Generate a PDF receipt and return the raw PDF string.
     */
    public function generatePdf(Sale $sale, string $locale = 'nl', array $cashData = []): string
    {
        $data = $this->buildViewData($sale, $locale, $cashData);

        $pdf = Pdf::loadView('receipts.receipt', $data)
            ->setPaper([0, 0, 226.77, 999], 'portrait') // 80mm width
            ->setOption('isHtml5ParserEnabled', true)
            ->setOption('isRemoteEnabled', false);

        return $pdf->output();
    }

    /**
     * Send an email receipt.
     */
    public function sendEmail(Sale $sale, string $to, string $locale = 'nl'): void
    {
        $data = $this->buildViewData($sale, $locale);

        Mail::html(
            view('emails.receipt', $data)->render(),
            function ($message) use ($to, $data, $sale) {
                $message->to($to)
                    ->subject($data['t']['receipt_title'] . ' ' . $sale->sale_number . ' — ' . $data['store']['name']);
            }
        );
    }

    // ─── Translations ─────────────────────────────────────────────────────

    private function translations(string $locale): array
    {
        $nl = [
            'receipt_title'   => 'Kassabon',
            'receipt_no'      => 'Bon nr.',
            'date'            => 'Datum',
            'cashier'         => 'Kassamedewerker',
            'customer'        => 'Klant',
            'description'     => 'Omschrijving',
            'qty'             => 'Aant.',
            'unit_price'      => 'Stukprijs',
            'amount'          => 'Bedrag',
            'subtotal'        => 'Subtotaal',
            'discount'        => 'Korting',
            'total'           => 'Totaal',
            'total_btw'       => 'Totaal BTW',
            'cash_tendered'   => 'Contant ontvangen',
            'change'          => 'Wisselgeld',
            'payment'         => 'Betaalwijze',
            'payment_methods' => ['cash' => 'Contant', 'card' => 'Pin/Kaart', 'mixed' => 'Gemengd'],
            'btw_breakdown'   => 'BTW-specificatie',
            'btw_number'      => 'BTW-nummer',
            'base'            => 'Grondslag',
            'btw'             => 'BTW',
            'exempt'          => 'BTW-vrij',
            'rate'            => 'koers',
            'thank_you'       => 'Bedankt voor uw aankoop!',
            'powered_by'      => 'Josbin POS · Betrouwbaar kassasysteem voor Suriname',
        ];

        $en = [
            'receipt_title'   => 'Receipt',
            'receipt_no'      => 'Receipt no.',
            'date'            => 'Date',
            'cashier'         => 'Cashier',
            'customer'        => 'Customer',
            'description'     => 'Description',
            'qty'             => 'Qty',
            'unit_price'      => 'Unit price',
            'amount'          => 'Amount',
            'subtotal'        => 'Subtotal',
            'discount'        => 'Discount',
            'total'           => 'Total',
            'total_btw'       => 'Total VAT',
            'cash_tendered'   => 'Cash tendered',
            'change'          => 'Change',
            'payment'         => 'Payment method',
            'payment_methods' => ['cash' => 'Cash', 'card' => 'Card/PIN', 'mixed' => 'Mixed'],
            'btw_breakdown'   => 'VAT breakdown',
            'btw_number'      => 'VAT number',
            'base'            => 'Base',
            'btw'             => 'VAT',
            'exempt'          => 'VAT-exempt',
            'rate'            => 'rate',
            'thank_you'       => 'Thank you for your purchase!',
            'powered_by'      => 'Josbin POS · Reliable POS for Suriname',
        ];

        return $locale === 'en' ? $en : $nl;
    }
}
