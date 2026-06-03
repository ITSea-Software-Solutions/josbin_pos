<!DOCTYPE html>
<html lang="{{ $locale }}">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  /* DomPDF doesn't reliably honor box-sizing on <body>, so we let the body
     fill the page (set in ReceiptService::setPaper to 80mm) and put the
     readable margin on an inner wrapper. Without this, an explicit
     width: 80mm + padding pushes content past the page edge → clipping. */
  body {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: #000;
  }
  .receipt { padding: 4mm; }
  .center  { text-align: center; }
  .right   { text-align: right; }
  .bold    { font-weight: bold; }
  .hr      { border-top: 1px dashed #000; margin: 4px 0; }
  .hr2     { border-top: 2px solid #000; margin: 4px 0; }
  table    { width: 100%; border-collapse: collapse; }
  td       { padding: 1px 0; vertical-align: top; }
  .qty-col { width: 35px; }
  .desc-col{ }
  .price-col{ width: 55px; text-align: right; }
  .label   { color: #444; }
  .total-row td { font-weight: bold; font-size: 12px; }
  .btw-table td { font-size: 10px; }
  .footer  { margin-top: 6px; font-size: 10px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="receipt">

{{-- Store header --}}
@if(!empty($store['logo']))
  <div class="center" style="margin-bottom:4px;">
    <img src="{{ $store['logo'] }}" alt="logo" style="max-width:160px;max-height:60px;">
  </div>
@endif
<div class="center bold">{{ $store['name'] }}</div>
@if(!empty($store['receipt_header']))
  <div class="center" style="font-size:10px;white-space:pre-wrap;">{{ $store['receipt_header'] }}</div>
@endif
<div class="hr2"></div>

{{-- Receipt info --}}
<table>
  <tr>
    <td class="label">{{ $t['receipt_no'] }}:</td>
    <td class="right">{{ $sale['sale_number'] }}</td>
  </tr>
  <tr>
    <td class="label">{{ $t['date'] }}:</td>
    <td class="right">{{ $sale['occurred_at'] }}</td>
  </tr>
  <tr>
    <td class="label">{{ $t['cashier'] }}:</td>
    <td class="right">{{ $sale['cashier_name'] }}</td>
  </tr>
  @if(!empty($sale['customer_name']))
  <tr>
    <td class="label">{{ $t['customer'] }}:</td>
    <td class="right">{{ $sale['customer_name'] }}</td>
  </tr>
  @endif
</table>
<div class="hr"></div>

{{-- Items --}}
<table>
  <thead>
    <tr>
      <td class="qty-col label">{{ $t['qty'] }}</td>
      <td class="desc-col label">{{ $t['description'] }}</td>
      <td class="price-col label">{{ $t['amount'] }}</td>
    </tr>
  </thead>
  <tbody>
  @foreach($sale['items'] as $item)
    <tr>
      <td class="qty-col">{{ rtrim(rtrim($item['quantity'], '0'), '.') }}×</td>
      <td class="desc-col">
        {{ $item['product_name'] }}
        @if(!empty($item['variant_name']))
          <span class="label">— {{ $item['variant_name'] }}</span>
        @endif
        @if(!$item['btw_exempt'] && $item['btw_rate'] > 0)
          <span class="label">({{ $item['btw_rate'] }}%)</span>
        @endif
        @if($item['btw_exempt'])
          <span class="label">({{ $t['exempt'] }})</span>
        @endif
      </td>
      <td class="price-col">SRD {{ $item['line_total'] }}</td>
    </tr>
    @if($item['discount'] > 0)
    <tr>
      <td></td>
      <td class="label" style="font-size:10px">  - {{ $t['discount'] }}</td>
      <td class="price-col label" style="font-size:10px">-{{ $item['discount'] }}</td>
    </tr>
    @endif
  @endforeach
  </tbody>
</table>
<div class="hr"></div>

{{-- Totals --}}
<table>
  @if($sale['sale_discount'] > 0)
  <tr>
    <td>{{ $t['subtotal'] }}</td>
    <td class="right">SRD {{ $sale['subtotal'] }}</td>
  </tr>
  <tr>
    <td>{{ $t['discount'] }}</td>
    <td class="right">-SRD {{ $sale['sale_discount'] }}</td>
  </tr>
  @endif
  <tr class="total-row">
    <td>{{ $t['total'] }}</td>
    <td class="right">SRD {{ $sale['total'] }}</td>
  </tr>
  @if($sale['payment_method'] === 'cash')
  <tr>
    <td class="label">{{ $t['cash_tendered'] }}</td>
    <td class="right">SRD {{ $sale['cash_tendered'] }}</td>
  </tr>
  <tr>
    <td class="label">{{ $t['change'] }}</td>
    <td class="right">SRD {{ $sale['change'] }}</td>
  </tr>
  @endif
  {{-- Card reconciliation — shows on the slip when the cashier filled the
       bank fields. Helps the customer verify the right card was charged and
       lets the OA cross-reference the bank's settlement report by approval
       code. PCI-safe: we only carry last 4, never the full PAN. --}}
  @if(in_array($sale['payment_method'], ['card', 'mixed']) && !empty($sale['card_bank']))
  <tr>
    <td class="label">{{ $t['paid_by'] ?? 'Paid by' }}</td>
    <td class="right">{{ $sale['card_bank'] }}@if(!empty($sale['card_last_four'])) ····{{ $sale['card_last_four'] }}@endif</td>
  </tr>
  @if(!empty($sale['card_approval_code']))
  <tr>
    <td class="label">{{ $t['auth_code'] ?? 'Auth' }}</td>
    <td class="right">{{ $sale['card_approval_code'] }}</td>
  </tr>
  @endif
  @if(!empty($sale['card_terminal_ref']))
  <tr>
    <td class="label">{{ $t['terminal_ref'] ?? 'Term. ref' }}</td>
    <td class="right" style="font-size:9px">{{ $sale['card_terminal_ref'] }}</td>
  </tr>
  @endif
  @endif
  {{-- Phase 2 — bank_transfer / mobile_transfer / foreign_cash --}}
  @if(in_array($sale['payment_method'], ['bank_transfer', 'mobile_transfer']) && !empty($sale['payment_provider']))
  <tr>
    <td class="label">{{ $t['paid_via'] ?? 'Paid via' }}</td>
    <td class="right">{{ $sale['payment_provider'] }}</td>
  </tr>
  @if(!empty($sale['payment_reference']))
  <tr>
    <td class="label">{{ $t['payment_ref'] ?? 'Ref.' }}</td>
    <td class="right" style="font-size:9px">{{ $sale['payment_reference'] }}</td>
  </tr>
  @endif
  @if(empty($sale['payment_confirmed_at']))
  <tr>
    <td colspan="2" class="right" style="font-size:9px; color:#b45309">⏳ {{ $t['awaiting_confirmation'] ?? 'Awaiting bank confirmation' }}</td>
  </tr>
  @endif
  @endif
  @if($sale['payment_method'] === 'foreign_cash' && !empty($sale['foreign_currency']))
  <tr>
    <td class="label">{{ $t['paid_in_foreign'] ?? 'Paid' }}</td>
    <td class="right">{{ $sale['foreign_currency'] }} {{ number_format((float) $sale['foreign_amount'], 2, '.', ',') }}</td>
  </tr>
  @if(!empty($sale['foreign_rate_used']))
  <tr>
    <td class="label" style="font-size:9px">{{ $t['rate_used'] ?? 'Rate' }}</td>
    <td class="right" style="font-size:9px">1 {{ $sale['foreign_currency'] }} = SRD {{ number_format((float) $sale['foreign_rate_used'], 4, '.', '') }}</td>
  </tr>
  @endif
  @endif
</table>
<div class="hr"></div>

{{-- BTW breakdown --}}
@if($btw_items)
<div style="font-size:10px">
  <div class="label bold">{{ $t['btw_breakdown'] }}</div>
  <table class="btw-table">
    @foreach($btw_items as $b)
    <tr>
      <td>BTW {{ $b['rate'] }}%</td>
      <td class="right">{{ $t['base'] }}: SRD {{ $b['base'] }}</td>
      <td class="right">BTW: SRD {{ $b['btw'] }}</td>
    </tr>
    @endforeach
    <tr>
      <td class="bold">{{ $t['total_btw'] }}</td>
      <td></td>
      <td class="right bold">SRD {{ $sale['btw_total'] }}</td>
    </tr>
  </table>
  @if(!empty($store['btw_number']))
  <div class="label" style="margin-top:3px">{{ $t['btw_number'] }}: {{ $store['btw_number'] }}</div>
  @endif
</div>
<div class="hr"></div>
@endif

{{-- USD equivalent line (informational — SRD is always the legally binding amount) --}}
@if(!empty($sale['total_usd']) && !empty($sale['exchange_rate']))
<div style="font-size:9px;color:#555;text-align:right;margin-top:2px;">
  ≈ USD {{ $sale['total_usd'] }} (@ {{ $t['rate'] ?? 'rate' }} {{ $sale['exchange_rate'] }} SRD/USD)
</div>
@endif

{{-- Payment method --}}
<div class="center label">
  {{ $t['payment'] }}: {{ $t['payment_methods'][$sale['payment_method']] ?? $sale['payment_method'] }}
</div>

{{-- Footer --}}
@if(!empty($store['receipt_footer']))
<div class="footer center" style="white-space:pre-wrap;">{{ $store['receipt_footer'] }}</div>
@endif
<div class="footer center">{{ $t['thank_you'] }}</div>
<div class="footer center label" style="font-size:9px">{{ $t['powered_by'] }}</div>

</div>
</body>
</html>
