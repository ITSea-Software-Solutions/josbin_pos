<?php

namespace App\Services;

use App\Models\Sale;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

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

        // Build item rows — variant_name renders on its own line under the
        // product when present (e.g. "Bruine Bonen" then "1kg" indented).
        $items = $sale->items->map(fn ($item) => [
            'product_name' => $item->product_name_snapshot,
            'variant_name' => $item->variant_name_snapshot,
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
                // Per-store receipt BTW number overrides the organisation's.
                'btw_number'     => data_get($store->settings, 'receipt_btw_number')
                    ?: ($store->organisation?->btw_number ?? ''),
                'logo'           => $this->receiptLogoDataUri($store->receipt_logo_path),
            ],
            'sale' => [
                'sale_number'    => $sale->sale_number,
                'occurred_at'    => $occurredAt,
                'cashier_name'   => $sale->cashier?->name ?? '—',
                'customer_name'  => $sale->customer?->name ?? null,
                'subtotal'       => number_format((float) $sale->subtotal_srd, 2, '.', ','),
                'sale_discount'  => (float) $sale->discount_srd,
                'btw_total'      => number_format((float) $sale->btw_srd, 2, '.', ','),
                'btw_exempt_reason' => $sale->btw_exempt ? $sale->btw_exempt_reason : null,
                'total'          => number_format((float) $sale->total_srd, 2, '.', ','),
                'total_usd'      => $totalUsd,     // null if no rate on record
                'exchange_rate'  => $exchangeRate > 0 ? number_format($exchangeRate, 4, '.', '') : null,
                'payment_method' => $sale->payment_method,
                'cash_tendered'  => number_format((float) $cashTendered, 2, '.', ','),
                'change'         => number_format((float) $change, 2, '.', ','),
                // Card reconciliation — surfaced on the receipt so customer
                // can verify which card was charged and OA can later cross-
                // reference the bank settlement report by approval code.
                // All nullable; the template only renders rows that are set.
                'card_bank'          => $sale->card_bank,
                'card_approval_code' => $sale->card_approval_code,
                'card_terminal_ref'  => $sale->card_terminal_ref,
                'card_last_four'     => $sale->card_last_four,
                // Phase 2 — bank_transfer / mobile_transfer / foreign_cash.
                'payment_provider'      => $sale->payment_provider,
                'payment_reference'     => $sale->payment_reference,
                'payment_confirmed_at'  => $sale->payment_confirmed_at?->toIso8601String(),
                'foreign_currency'      => $sale->foreign_currency,
                'foreign_amount'        => $sale->foreign_amount,
                'foreign_rate_used'     => $sale->foreign_rate_used,
                'items'          => $items,
            ],
            'btw_items' => $btwItems ?: null,
            't'         => $this->translations($locale),
        ];
    }

    /**
     * Build a base64 data URI for the store's receipt logo so it embeds
     * directly in the PDF (DomPDF runs with remote loading disabled) and in
     * the HTML email. Returns null when no usable logo is configured.
     */
    private function receiptLogoDataUri(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        $disk = Storage::disk('public');

        if (! $disk->exists($path)) {
            return null;
        }

        $mime = $disk->mimeType($path) ?: 'image/png';

        return 'data:' . $mime . ';base64,' . base64_encode($disk->get($path));
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
     * Render the receipt as standalone HTML (same Blade as the PDF, so the
     * content is identical). Used by the POS browser-print fallback: printing
     * an HTML document in an iframe is reliable across browsers, whereas
     * printing a PDF blob in an iframe renders blank in Chrome.
     */
    public function generateHtml(Sale $sale, string $locale = 'nl', array $cashData = []): string
    {
        $data = $this->buildViewData($sale, $locale, $cashData);

        return view('receipts.receipt', $data)->render();
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
            'payment_methods' => ['cash' => 'Contant', 'card' => 'Pin/Kaart', 'mixed' => 'Gemengd', 'bank_transfer' => 'Overschrijving', 'mobile_transfer' => 'Mobiel bankieren', 'foreign_cash' => 'Vreemde valuta', 'qr_payment' => 'QR-wallet'],
            'paid_by'         => 'Betaald met',
            'auth_code'       => 'Auth-code',
            'terminal_ref'    => 'Term. ref.',
            'paid_via'        => 'Betaald via',
            'payment_ref'     => 'Ref.',
            'awaiting_confirmation' => 'Wacht op bankbevestiging',
            'paid_in_foreign' => 'Betaald in',
            'rate_used'       => 'Koers',
            'btw_breakdown'   => 'BTW-specificatie',
            'btw_exempt'      => 'BTW vrijgesteld',
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
            'payment_methods' => ['cash' => 'Cash', 'card' => 'Card/PIN', 'mixed' => 'Mixed', 'bank_transfer' => 'Bank transfer', 'mobile_transfer' => 'Mobile banking', 'foreign_cash' => 'Foreign cash', 'qr_payment' => 'QR wallet'],
            'paid_by'         => 'Paid by',
            'auth_code'       => 'Auth code',
            'terminal_ref'    => 'Term. ref',
            'paid_via'        => 'Paid via',
            'payment_ref'     => 'Ref.',
            'awaiting_confirmation' => 'Awaiting bank confirmation',
            'paid_in_foreign' => 'Paid',
            'rate_used'       => 'Rate',
            'btw_breakdown'   => 'VAT breakdown',
            'btw_exempt'      => 'BTW exempt',
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
