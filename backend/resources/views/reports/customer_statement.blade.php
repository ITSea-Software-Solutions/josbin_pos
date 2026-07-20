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
  .refund { color: #b03a2e; }
  .footer { margin-top: 30px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 8px; }
</style>
</head>
<body>
<h1>@if($locale === 'nl')Klantoverzicht @else Customer Statement @endif</h1>
<p style="color:#888; font-size:11px">
  {{ $org_name }}@if($btw_number) &nbsp;|&nbsp; BTW: {{ $btw_number }}@endif
  &nbsp;|&nbsp;
  @if($locale === 'nl')Periode:@else Period:@endif
  {{ $date_from }} @if($locale === 'nl') t/m @else to @endif {{ $date_to }}
  &nbsp;|&nbsp;
  @if($locale === 'nl')Gegenereerd op:@else Generated:@endif {{ now()->setTimezone('America/Paramaribo')->format('d-m-Y H:i') }} AST
</p>

<h2>@if($locale === 'nl')Klant @else Customer @endif</h2>
<table>
  <tr>
    <td>@if($locale === 'nl')Naam @else Name @endif</td>
    <td class="right">{{ $customer_name }}</td>
  </tr>
</table>

<h2>@if($locale === 'nl')Aankopen @else Purchases @endif</h2>
<table>
  <tr>
    <th>@if($locale === 'nl')Datum (AST) @else Date (AST) @endif</th>
    <th>@if($locale === 'nl')Bonnummer @else Sale number @endif</th>
    <th>@if($locale === 'nl')Vestiging @else Store @endif</th>
    <th>@if($locale === 'nl')Betaalmethode @else Payment method @endif</th>
    <th class="right">BTW (SRD)</th>
    <th class="right">@if($locale === 'nl')Totaal (SRD) @else Total (SRD) @endif</th>
  </tr>
  @forelse($rows as $r)
  <tr @if($r['is_refund']) class="refund" @endif>
    <td>{{ $r['occurred_at'] }}</td>
    <td>{{ $r['sale_number'] }}@if($r['is_refund']) (@if($locale === 'nl')retour @else refund @endif)@endif</td>
    <td>{{ $r['store_name'] }}</td>
    <td>{{ $r['payment_method'] }}</td>
    <td class="right">{{ $r['btw_srd'] }}</td>
    <td class="right">{{ $r['total_srd'] }}</td>
  </tr>
  @empty
  <tr>
    <td colspan="6" style="color:#888">
      @if($locale === 'nl')Geen aankopen in deze periode. @else No purchases in this period. @endif
    </td>
  </tr>
  @endforelse
</table>

<h2>@if($locale === 'nl')Totalen @else Totals @endif</h2>
<table>
  <tr>
    <td>@if($locale === 'nl')Aantal transacties @else Transaction count @endif</td>
    <td class="right">{{ $sale_count }}</td>
  </tr>
  <tr>
    <td>@if($locale === 'nl')Verkopen @else Sales @endif</td>
    <td class="right">SRD {{ $gross_total }}</td>
  </tr>
  <tr>
    <td>@if($locale === 'nl')Retouren @else Refunds @endif</td>
    <td class="right">SRD {{ $refund_total }}</td>
  </tr>
  <tr>
    <td>@if($locale === 'nl')Totaal BTW @else Total BTW @endif</td>
    <td class="right">SRD {{ $btw_total }}</td>
  </tr>
  <tr class="total">
    <td>@if($locale === 'nl')NETTO TOTAAL @else NET TOTAL @endif</td>
    <td class="right">SRD {{ $net_total }}</td>
  </tr>
</table>

<div class="footer">
  Josbin POS · @if($locale === 'nl')Betrouwbaar kassasysteem voor Suriname @else Reliable POS for Suriname @endif
</div>
</body>
</html>
