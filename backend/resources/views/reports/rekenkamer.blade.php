<!DOCTYPE html>
<html lang="{{ $locale }}">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a2e; background: #fff; margin: 28px; }

  /* Header */
  .header { border-bottom: 3px solid #1a5276; padding-bottom: 12px; margin-bottom: 18px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .org-name { font-size: 20px; font-weight: 700; color: #1a5276; }
  .report-title { font-size: 14px; font-weight: 700; color: #444; margin-top: 2px; }
  .header-meta { font-size: 10px; color: #666; text-align: right; line-height: 1.7; }
  .seal { display: inline-block; border: 2px solid #1a5276; padding: 4px 12px; font-size: 10px; font-weight: 700; color: #1a5276; letter-spacing: 1px; text-transform: uppercase; margin-top: 6px; }

  /* Section headers */
  h2 { font-size: 12px; font-weight: 700; color: #1a5276; background: #eaf2fb; padding: 5px 8px; border-left: 4px solid #1a5276; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10.5px; }
  th { background: #1a5276; color: #fff; padding: 5px 7px; text-align: left; font-size: 10px; font-weight: 600; }
  td { padding: 4px 7px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr:nth-child(even) td { background: #f7f9fc; }
  .num { text-align: right; font-family: 'Courier New', monospace; }
  .total-row td { font-weight: 700; background: #dbeafe; border-top: 2px solid #1a5276; }
  .voided { color: #c0392b; }
  .refunded { color: #e67e22; }

  /* Summary grid */
  .summary-grid { display: table; width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .summary-row { display: table-row; }
  .summary-label { display: table-cell; padding: 4px 8px; color: #555; width: 220px; }
  .summary-value { display: table-cell; padding: 4px 8px; font-weight: 600; color: #1a1a2e; }

  /* BTW table */
  .btw-table { width: auto; min-width: 360px; }

  /* Signature box */
  .signature-box { border: 1px solid #bbb; padding: 12px 14px; margin-top: 20px; font-size: 10px; }
  .signature-title { font-weight: 700; font-size: 11px; margin-bottom: 6px; color: #1a5276; text-transform: uppercase; }
  .signature-hash { font-family: 'Courier New', monospace; font-size: 9px; color: #555; word-break: break-all; background: #f5f5f5; padding: 4px 6px; margin-top: 4px; }
  .signature-row { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 6px; }
  .signature-field { flex: 1; min-width: 180px; }
  .signature-field label { display: block; font-size: 9px; color: #888; text-transform: uppercase; margin-bottom: 2px; }
  .signature-field span { font-weight: 600; }

  .footer { margin-top: 22px; border-top: 1px solid #ddd; padding-top: 8px; font-size: 9px; color: #999; text-align: center; }
  .page-break { page-break-before: always; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
  .badge-completed { background: #dcfce7; color: #15803d; }
  .badge-voided    { background: #fee2e2; color: #dc2626; }
  .badge-refunded  { background: #fff7ed; color: #c2410c; }
</style>
</head>
<body>

{{-- ═══ HEADER ═══════════════════════════════════════════════════════════════ --}}
<div class="header">
  <div class="header-top">
    <div>
      <div class="org-name">{{ $organisation->name }}</div>
      <div class="report-title">
        @if($locale === 'nl')Rekenkamer Auditrapport — Volledige Transactiegeschiedenis
        @else Rekenkamer Audit Report — Full Transaction History @endif
      </div>
      <div style="font-size:10px; color:#777; margin-top:4px;">
        BTW-nummer: {{ $organisation->btw_number ?? '—' }}
        &nbsp;|&nbsp;
        @if($locale === 'nl')Periode:@else Period:@endif {{ $fromDate }} — {{ $toDate }}
      </div>
    </div>
    <div class="header-meta">
      @if($locale === 'nl')Gegenereerd op@else Generated@endif<br>
      {{ $generatedAt }}<br>
      @if($locale === 'nl')door@else by@endif <strong>{{ $generatedBy }}</strong><br>
      <span class="seal">Josbin POS Rekenkamer Export</span>
    </div>
  </div>
</div>

{{-- ═══ EXECUTIVE SUMMARY ═══════════════════════════════════════════════════ --}}
<h2>@if($locale === 'nl')Samenvatting @else Executive Summary @endif</h2>
<div class="summary-grid">
  @foreach($summaryRows as $row)
  <div class="summary-row">
    <div class="summary-label">{{ $row[0] }}</div>
    <div class="summary-value">{{ $row[1] }}</div>
  </div>
  @endforeach
</div>

{{-- ═══ BTW BREAKDOWN ════════════════════════════════════════════════════════ --}}
<h2>@if($locale === 'nl')BTW-uitsplitsing @else VAT (BTW) Breakdown @endif</h2>
<table class="btw-table">
  <thead>
    <tr>
      <th>@if($locale === 'nl')BTW-tarief@else VAT Rate@endif</th>
      <th>@if($locale === 'nl')Vrijgesteld@else Exempt@endif</th>
      <th class="num">@if($locale === 'nl')Nettobasis@else Net Base@endif</th>
      <th class="num">@if($locale === 'nl')BTW-bedrag@else VAT Amount@endif</th>
    </tr>
  </thead>
  <tbody>
    @foreach($btwBreakdown as $row)
    <tr>
      <td>{{ number_format((float) $row->btw_rate, 1) }}%</td>
      <td>{{ $row->btw_exempt ? ($locale === 'nl' ? 'Ja' : 'Yes') : ($locale === 'nl' ? 'Nee' : 'No') }}</td>
      <td class="num">SRD {{ number_format((float) $row->net_base, 2, '.', ',') }}</td>
      <td class="num">SRD {{ number_format((float) $row->btw_total, 2, '.', ',') }}</td>
    </tr>
    @endforeach
    <tr class="total-row">
      <td colspan="2">@if($locale === 'nl')Totaal@else Total@endif</td>
      <td class="num">SRD {{ number_format($totalNetBase, 2, '.', ',') }}</td>
      <td class="num">SRD {{ number_format($totalBtw, 2, '.', ',') }}</td>
    </tr>
  </tbody>
</table>

{{-- ═══ PAYMENT METHOD BREAKDOWN ════════════════════════════════════════════ --}}
<h2>@if($locale === 'nl')Betaalmethoden@else Payment Methods@endif</h2>
<table class="btw-table">
  <thead>
    <tr>
      <th>@if($locale === 'nl')Methode@else Method@endif</th>
      <th class="num">@if($locale === 'nl')Transacties@else Transactions@endif</th>
      <th class="num">@if($locale === 'nl')Bedrag@else Amount@endif</th>
    </tr>
  </thead>
  <tbody>
    @foreach($paymentBreakdown as $row)
    <tr>
      <td>{{ ucfirst($row->payment_method) }}</td>
      <td class="num">{{ $row->count }}</td>
      <td class="num">SRD {{ number_format((float) $row->total, 2, '.', ',') }}</td>
    </tr>
    @endforeach
  </tbody>
</table>

{{-- ═══ COMPLETE TRANSACTION LIST ═══════════════════════════════════════════ --}}
<div class="page-break"></div>
<h2>@if($locale === 'nl')Volledige Transactielijst@else Complete Transaction List@endif</h2>
<table>
  <thead>
    <tr>
      <th>@if($locale === 'nl')Bon-nr.@else Sale#@endif</th>
      <th>@if($locale === 'nl')Datum/Tijd (AST)@else Date/Time (AST)@endif</th>
      <th>@if($locale === 'nl')Kassa@else Cashier@endif</th>
      <th>@if($locale === 'nl')Vestiging@else Store@endif</th>
      <th class="num">@if($locale === 'nl')Subtotaal@else Subtotal@endif</th>
      <th class="num">@if($locale === 'nl')Korting@else Discount@endif</th>
      <th class="num">BTW</th>
      <th class="num">@if($locale === 'nl')Totaal@else Total@endif</th>
      <th>@if($locale === 'nl')Betaling@else Payment@endif</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    @foreach($sales as $sale)
    <tr class="{{ $sale->status === 'voided' ? 'voided' : '' }}">
      <td style="font-family: monospace; font-size:9.5px;">{{ $sale->sale_number }}</td>
      <td style="white-space:nowrap;">{{ \Carbon\Carbon::parse($sale->occurred_at)->setTimezone('America/Paramaribo')->format('d-m-Y H:i') }}</td>
      <td>{{ $sale->cashier?->name ?? '—' }}</td>
      <td>{{ $sale->store?->name ?? '—' }}</td>
      <td class="num">{{ number_format((float) $sale->subtotal_srd, 2, '.', ',') }}</td>
      <td class="num">{{ $sale->discount_srd > 0 ? number_format((float) $sale->discount_srd, 2, '.', ',') : '—' }}</td>
      <td class="num">{{ number_format((float) $sale->btw_srd, 2, '.', ',') }}</td>
      <td class="num" style="font-weight:600;">{{ number_format((float) $sale->total_srd, 2, '.', ',') }}</td>
      <td>{{ ucfirst($sale->payment_method) }}</td>
      <td>
        <span class="badge badge-{{ $sale->status }}">{{ $sale->status }}</span>
      </td>
    </tr>
    @if($sale->status === 'voided')
    <tr>
      <td colspan="10" style="background:#fef2f2; color:#7f1d1d; font-size:9.5px; padding:3px 12px;">
        @if($locale === 'nl')Geannuleerd op@else Voided@endif
        {{ $sale->voided_at ? \Carbon\Carbon::parse($sale->voided_at)->setTimezone('America/Paramaribo')->format('d-m-Y H:i') . ' AST' : '—' }}
        @if($locale === 'nl')door@else by@endif {{ $sale->voidedBy?->name ?? '—' }}
        @if($sale->void_reason) &nbsp;|&nbsp; {{ $sale->void_reason }} @endif
      </td>
    </tr>
    @endif
    @endforeach
  </tbody>
  <tfoot>
    <tr class="total-row">
      <td colspan="7">@if($locale === 'nl')TOTAAL ({{ count($sales) }} transacties)@else TOTAL ({{ count($sales) }} transactions)@endif</td>
      <td class="num">SRD {{ number_format($grandTotal, 2, '.', ',') }}</td>
      <td colspan="2"></td>
    </tr>
  </tfoot>
</table>

{{-- ═══ VOID LOG ════════════════════════════════════════════════════════════ --}}
@if($voidedSales->isNotEmpty())
<div class="page-break"></div>
<h2>@if($locale === 'nl')Annuleringslogboek@else Void Log@endif</h2>
<table>
  <thead>
    <tr>
      <th>@if($locale === 'nl')Bon-nr.@else Sale#@endif</th>
      <th>@if($locale === 'nl')Originele Datum@else Original Date@endif</th>
      <th>@if($locale === 'nl')Geannuleerd op@else Voided At@endif</th>
      <th>@if($locale === 'nl')Kassa (origineel)@else Cashier@endif</th>
      <th>@if($locale === 'nl')Geannuleerd door@else Voided By@endif</th>
      <th class="num">@if($locale === 'nl')Bedrag@else Amount@endif</th>
      <th>@if($locale === 'nl')Reden@else Reason@endif</th>
    </tr>
  </thead>
  <tbody>
    @foreach($voidedSales as $sale)
    <tr>
      <td style="font-family:monospace; font-size:9.5px;">{{ $sale->sale_number }}</td>
      <td>{{ \Carbon\Carbon::parse($sale->occurred_at)->setTimezone('America/Paramaribo')->format('d-m-Y H:i') }}</td>
      <td>{{ $sale->voided_at ? \Carbon\Carbon::parse($sale->voided_at)->setTimezone('America/Paramaribo')->format('d-m-Y H:i') : '—' }}</td>
      <td>{{ $sale->cashier?->name ?? '—' }}</td>
      <td>{{ $sale->voidedBy?->name ?? '—' }}</td>
      <td class="num">SRD {{ number_format((float) $sale->total_srd, 2, '.', ',') }}</td>
      <td>{{ $sale->void_reason ?? '—' }}</td>
    </tr>
    @endforeach
  </tbody>
</table>
@endif

{{-- ═══ AUDIT SIGNATURE ════════════════════════════════════════════════════ --}}
<div class="signature-box">
  <div class="signature-title">
    @if($locale === 'nl')Digitale Handtekening — Rekenkamer van Suriname
    @else Digital Signature — Rekenkamer van Suriname @endif
  </div>
  <div class="signature-hash">SHA-256: {{ $documentHash }}</div>
  <div class="signature-row">
    <div class="signature-field">
      <label>@if($locale === 'nl')Organisatie@else Organisation@endif</label>
      <span>{{ $organisation->name }}</span>
    </div>
    <div class="signature-field">
      <label>@if($locale === 'nl')Gegenereerd door@else Generated by@endif</label>
      <span>{{ $generatedBy }}</span>
    </div>
    <div class="signature-field">
      <label>@if($locale === 'nl')Tijdstempel (AST)@else Timestamp (AST)@endif</label>
      <span>{{ $generatedAt }}</span>
    </div>
    <div class="signature-field">
      <label>@if($locale === 'nl')Transacties@else Transactions@endif</label>
      <span>{{ count($sales) }}</span>
    </div>
    <div class="signature-field">
      <label>@if($locale === 'nl')Softwareversie@else Software Version@endif</label>
      <span>Josbin POS v1.0 — Laravel 13</span>
    </div>
  </div>
</div>

<div class="footer">
  Josbin POS — {{ $organisation->name }} — @if($locale === 'nl')Gegenereerd op@else Generated@endif {{ $generatedAt }} AST
  &nbsp;|&nbsp; @if($locale === 'nl')Dit document is uitsluitend bestemd voor Rekenkamer van Suriname auditdoeleinden.
  @else This document is exclusively for Rekenkamer van Suriname audit purposes. @endif
</div>

</body>
</html>
