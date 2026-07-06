<!DOCTYPE html>
<html lang="{{ $locale }}">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 30px; }
  h1   { font-size: 20px; color: #1a5276; margin-bottom: 4px; }
  h2   { font-size: 14px; color: #555; margin: 20px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #1a5276; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .right { text-align: right; }
  .total { font-weight: bold; background: #eaf0fb; }
  .footer { margin-top: 30px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 8px; }
</style>
</head>
<body>
<h1>Josbin POS @if($locale === 'nl')Rapportage @else Report @endif</h1>
<p style="color:#888; font-size:11px">
  @if($locale === 'nl')Periode:@else Period:@endif
  {{ $data['date_from'] }} @if($locale === 'nl')t/m@else to@endif {{ $data['date_to'] }}
  &nbsp;|&nbsp;
  @if($locale === 'nl')Gegenereerd op:@else Generated:@endif {{ now()->setTimezone('America/Paramaribo')->format('d-m-Y H:i') }} AST
</p>

{{-- Keys below match ReportController::buildRangeSummary exactly — the
     original draft of this blade read total_sales / payment_breakdown /
     top_5_products, none of which the builder ever produced, so the export
     rendered blanks. Fixed alongside the qr-wallet release. --}}
<h2>@if($locale === 'nl')Samenvatting @else Summary @endif</h2>
<table>
  <tr>
    <td>@if($locale === 'nl')Transacties @else Transactions @endif</td>
    <td class="right">{{ $data['transaction_count'] }}</td>
  </tr>
  <tr>
    <td>@if($locale === 'nl')Geannuleerd @else Voided @endif</td>
    <td class="right">{{ $data['void_count'] ?? 0 }}</td>
  </tr>
  <tr>
    <td>@if($locale === 'nl')Gemiddeld kassabon @else Avg basket @endif</td>
    <td class="right">SRD {{ $data['avg_basket_srd'] }}</td>
  </tr>
  <tr>
    <td>@if($locale === 'nl')Totale korting @else Total discounts @endif</td>
    <td class="right">SRD {{ $data['total_discount_srd'] }}</td>
  </tr>
  <tr>
    <td>@if($locale === 'nl')Totaal BTW @else Total VAT @endif</td>
    <td class="right">SRD {{ $data['total_btw_srd'] }}</td>
  </tr>
  <tr class="total">
    <td>@if($locale === 'nl')TOTALE OMZET @else TOTAL REVENUE @endif</td>
    <td class="right">SRD {{ $data['total_sales_srd'] }}</td>
  </tr>
</table>

<h2>@if($locale === 'nl')Betaalmethode @else Payment methods @endif</h2>
<table>
  <tr><th>@if($locale === 'nl')Methode @else Method @endif</th><th class="right">SRD</th></tr>
  <tr><td>@if($locale === 'nl')Contant @else Cash @endif</td><td class="right">{{ $data['cash_total_srd'] }}</td></tr>
  <tr><td>@if($locale === 'nl')Pin/Kaart @else Card/PIN @endif</td><td class="right">{{ $data['card_total_srd'] }}</td></tr>
  <tr><td>@if($locale === 'nl')Gemengd @else Mixed @endif</td><td class="right">{{ $data['mixed_total_srd'] }}</td></tr>
  {{-- Phase 2/3 methods — only when used (non-zero incl. refund-negative). --}}
  @if((float) ($data['bank_transfer_total_srd'] ?? 0) != 0.0)
  <tr><td>@if($locale === 'nl')Overschrijving @else Bank transfer @endif</td><td class="right">{{ $data['bank_transfer_total_srd'] }}</td></tr>
  @endif
  @if((float) ($data['mobile_transfer_total_srd'] ?? 0) != 0.0)
  <tr><td>@if($locale === 'nl')Mobiel bankieren @else Mobile banking @endif</td><td class="right">{{ $data['mobile_transfer_total_srd'] }}</td></tr>
  @endif
  @if((float) ($data['foreign_cash_total_srd'] ?? 0) != 0.0)
  <tr><td>@if($locale === 'nl')Vreemde valuta @else Foreign cash @endif</td><td class="right">{{ $data['foreign_cash_total_srd'] }}</td></tr>
  @endif
  @if((float) ($data['qr_payment_total_srd'] ?? 0) != 0.0)
  <tr><td>@if($locale === 'nl')QR-wallet (Mopé / Uni5Pay+) @else QR wallet (Mopé / Uni5Pay+) @endif</td><td class="right">{{ $data['qr_payment_total_srd'] }}</td></tr>
  @endif
</table>

@if(!empty($data['top_products']))
<h2>@if($locale === 'nl')Top 5 producten @else Top 5 products @endif</h2>
<table>
  <tr>
    <th>@if($locale === 'nl')Product @else Product @endif</th>
    <th class="right">@if($locale === 'nl')Stuks @else Units @endif</th>
    <th class="right">@if($locale === 'nl')Omzet @else Revenue @endif</th>
  </tr>
  @foreach($data['top_products'] as $p)
  <tr>
    <td>{{ $p['product_name'] }}</td>
    <td class="right">{{ number_format((float) $p['quantity'], 1) }}</td>
    <td class="right">SRD {{ number_format((float) $p['revenue_srd'], 2) }}</td>
  </tr>
  @endforeach
</table>
@endif

<div class="footer">
  Josbin POS · @if($locale === 'nl')Betrouwbaar kassasysteem voor Suriname @else Reliable POS for Suriname @endif
</div>
</body>
</html>
