<!DOCTYPE html>
<html lang="{{ $locale }}">
<head>
<meta charset="UTF-8">
<style>
  body  { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 30px; }
  h1    { font-size: 20px; color: #1a5276; margin-bottom: 4px; }
  h2    { font-size: 14px; color: #555; margin: 20px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th    { background: #1a5276; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
  td    { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .right  { text-align: right; }
  .total  { font-weight: bold; background: #eaf0fb; }
  .footer { margin-top: 30px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 8px; }
  .badge  { display: inline-block; background: #eaf0fb; color: #1a5276; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: bold; }
</style>
</head>
<body>

<h1>
  Josbin POS &mdash;
  @if($locale === 'nl')Geconsolideerd Rapport @else Consolidated Report @endif
</h1>
<p style="color:#888; font-size:11px">
  @if($locale === 'nl')Periode:@else Period:@endif
  {{ $data['date_from'] }} @if($locale === 'nl')t/m@else to@endif {{ $data['date_to'] }}
  &nbsp;|&nbsp;
  @if($locale === 'nl')Gegenereerd op:@else Generated:@endif
  {{ now()->setTimezone('America/Paramaribo')->format('d-m-Y H:i') }} AST
  &nbsp;|&nbsp;
  <span class="badge">@if($locale === 'nl')Alle vestigingen @else All stores @endif</span>
</p>

{{-- ── Summary ── --}}
<h2>@if($locale === 'nl')Samenvatting @else Summary @endif</h2>
<table>
  <tr>
    <td>@if($locale === 'nl')Transacties @else Transactions @endif</td>
    <td class="right">{{ number_format($data['transaction_count']) }}</td>
  </tr>
  <tr>
    <td>@if($locale === 'nl')Gemiddelde bon @else Avg basket @endif</td>
    <td class="right">SRD {{ $data['avg_basket'] }}</td>
  </tr>
  <tr>
    <td>@if($locale === 'nl')Totale korting @else Total discounts @endif</td>
    <td class="right">SRD {{ $data['total_discounts'] }}</td>
  </tr>
  <tr>
    <td>@if($locale === 'nl')Totaal BTW @else Total VAT (BTW) @endif</td>
    <td class="right">SRD {{ $data['total_btw'] }}</td>
  </tr>
  <tr class="total">
    <td>@if($locale === 'nl')TOTALE OMZET @else TOTAL REVENUE @endif</td>
    <td class="right">SRD {{ $data['total_sales'] }}</td>
  </tr>
</table>

{{-- ── Payment breakdown ── --}}
<h2>@if($locale === 'nl')Betaalmethode @else Payment methods @endif</h2>
<table>
  <tr>
    <th>@if($locale === 'nl')Methode @else Method @endif</th>
    <th class="right">SRD</th>
  </tr>
  <tr>
    <td>@if($locale === 'nl')Contant @else Cash @endif</td>
    <td class="right">{{ $data['payment_breakdown']['cash'] }}</td>
  </tr>
  <tr>
    <td>@if($locale === 'nl')PIN / Kaart @else Card / PIN @endif</td>
    <td class="right">{{ $data['payment_breakdown']['card'] }}</td>
  </tr>
  <tr>
    <td>@if($locale === 'nl')Gemengd @else Mixed @endif</td>
    <td class="right">{{ $data['payment_breakdown']['mixed'] }}</td>
  </tr>
</table>

{{-- ── Per-store breakdown ── --}}
@if(!empty($data['per_store']) && count($data['per_store']) > 0)
<h2>@if($locale === 'nl')Overzicht per vestiging @else Per-store breakdown @endif</h2>
<table>
  <tr>
    <th>@if($locale === 'nl')Vestiging @else Store @endif</th>
    <th>@if($locale === 'nl')Stad @else City @endif</th>
    <th class="right">@if($locale === 'nl')Transacties @else Transactions @endif</th>
    <th class="right">@if($locale === 'nl')BTW @else VAT @endif</th>
    <th class="right">@if($locale === 'nl')Omzet @else Revenue @endif</th>
  </tr>
  @foreach($data['per_store'] as $store)
  <tr>
    <td>{{ $store['store_name'] }}</td>
    <td>{{ $store['city'] ?? '—' }}</td>
    <td class="right">{{ number_format($store['transaction_count']) }}</td>
    <td class="right">SRD {{ $store['total_btw'] }}</td>
    <td class="right">SRD {{ $store['total_sales'] }}</td>
  </tr>
  @endforeach
</table>
@endif

<div class="footer">
  Josbin POS &copy; {{ date('Y') }} &nbsp;&middot;&nbsp;
  @if($locale === 'nl')Betrouwbaar kassasysteem voor Suriname @else Reliable POS for Suriname @endif
  &nbsp;&middot;&nbsp; AST (UTC&minus;3)
</div>
</body>
</html>
