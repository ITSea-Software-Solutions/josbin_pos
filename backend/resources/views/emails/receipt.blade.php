<!DOCTYPE html>
<html lang="{{ $locale }}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ $t['receipt_title'] }} {{ $sale['sale_number'] }}</title>
<style>
  body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; color: #333; }
  .wrapper { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
  .header { background: #1a5276; color: #fff; padding: 24px; text-align: center; }
  .header h1 { font-size: 22px; margin: 0; }
  .header p  { margin: 4px 0 0; opacity: .8; font-size: 13px; }
  .body { padding: 24px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .meta-item label { display: block; font-size: 11px; color: #888; text-transform: uppercase; }
  .meta-item span  { font-size: 14px; font-weight: 600; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table.items th { background: #eaf0fb; padding: 8px; font-size: 12px; text-align: left; }
  table.items td { padding: 8px; border-bottom: 1px solid #eee; font-size: 13px; }
  table.items td.right { text-align: right; }
  .totals { background: #f9f9f9; border-radius: 6px; padding: 16px; margin-bottom: 16px; }
  .totals table { width: 100%; }
  .totals td { padding: 4px 0; font-size: 14px; }
  .totals td.right { text-align: right; }
  .totals .grand td { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 8px; }
  .btw-box { background: #eaf0fb; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; font-size: 12px; }
  .btw-box h4 { margin: 0 0 8px; font-size: 13px; color: #1a5276; }
  .btw-box table td { padding: 3px 0; }
  .footer { text-align: center; padding: 20px 24px; background: #f5f5f5; font-size: 12px; color: #888; }
  .badge { display: inline-block; background: #27ae60; color: #fff; border-radius: 12px; padding: 2px 10px; font-size: 11px; }
  .badge.card { background: #2980b9; }
  .badge.mixed { background: #8e44ad; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    @if(!empty($store['logo']))
      <img src="{{ $store['logo'] }}" alt="logo" style="max-width:160px;max-height:64px;margin-bottom:8px;">
    @endif
    <h1>{{ $store['name'] }}</h1>
    <p>{{ $t['receipt_title'] }} · {{ $sale['sale_number'] }}</p>
  </div>

  <div class="body">
    <div class="meta-grid">
      <div class="meta-item">
        <label>{{ $t['date'] }}</label>
        <span>{{ $sale['occurred_at'] }}</span>
      </div>
      <div class="meta-item">
        <label>{{ $t['cashier'] }}</label>
        <span>{{ $sale['cashier_name'] }}</span>
      </div>
      @if(!empty($sale['customer_name']))
      <div class="meta-item">
        <label>{{ $t['customer'] }}</label>
        <span>{{ $sale['customer_name'] }}</span>
      </div>
      @endif
      <div class="meta-item">
        <label>{{ $t['payment'] }}</label>
        <span class="badge {{ $sale['payment_method'] }}">{{ $t['payment_methods'][$sale['payment_method']] ?? $sale['payment_method'] }}</span>
      </div>
    </div>

    {{-- Items table --}}
    <table class="items">
      <thead>
        <tr>
          <th>{{ $t['description'] }}</th>
          <th>{{ $t['qty'] }}</th>
          <th style="text-align:right">{{ $t['unit_price'] }}</th>
          <th style="text-align:right">{{ $t['amount'] }}</th>
        </tr>
      </thead>
      <tbody>
      @foreach($sale['items'] as $item)
        <tr>
          <td>
            {{ $item['product_name'] }}
            <br><small style="color:#888">
              @if($item['btw_exempt']) {{ $t['exempt'] }}
              @elseif($item['btw_rate'] > 0) BTW {{ $item['btw_rate'] }}%
              @else BTW 0%
              @endif
            </small>
          </td>
          <td>{{ rtrim(rtrim($item['quantity'], '0'), '.') }}</td>
          <td class="right">SRD {{ $item['unit_price'] }}</td>
          <td class="right">SRD {{ $item['line_total'] }}</td>
        </tr>
      @endforeach
      </tbody>
    </table>

    {{-- Totals --}}
    <div class="totals">
      <table>
        @if($sale['sale_discount'] > 0)
        <tr>
          <td>{{ $t['subtotal'] }}</td>
          <td class="right">SRD {{ $sale['subtotal'] }}</td>
        </tr>
        <tr style="color:#c0392b">
          <td>{{ $t['discount'] }}</td>
          <td class="right">-SRD {{ $sale['sale_discount'] }}</td>
        </tr>
        @endif
        <tr class="grand">
          <td>{{ $t['total'] }}</td>
          <td class="right">SRD {{ $sale['total'] }}</td>
        </tr>
        @if($sale['payment_method'] === 'cash')
        <tr style="font-size:12px; color:#666">
          <td>{{ $t['cash_tendered'] }}</td>
          <td class="right">SRD {{ $sale['cash_tendered'] }}</td>
        </tr>
        <tr style="font-size:12px; color:#666">
          <td>{{ $t['change'] }}</td>
          <td class="right">SRD {{ $sale['change'] }}</td>
        </tr>
        @endif
      </table>
    </div>

    {{-- BTW breakdown --}}
    @if(!empty($sale['btw_exempt_reason']))
  <p style="font-weight:bold; font-size:12px">{{ $t['btw_exempt'] ?? 'BTW vrijgesteld' }}: {{ $sale['btw_exempt_reason'] }}</p>
@endif
@if($btw_items)
    <div class="btw-box">
      <h4>{{ $t['btw_breakdown'] }}</h4>
      <table>
        @foreach($btw_items as $b)
        <tr>
          <td>BTW {{ $b['rate'] }}%</td>
          <td>{{ $t['base'] }}: SRD {{ $b['base'] }}</td>
          <td style="text-align:right">{{ $t['btw'] }}: SRD {{ $b['btw'] }}</td>
        </tr>
        @endforeach
        <tr style="font-weight:bold; border-top:1px solid #c0d3f0; margin-top:4px">
          <td>{{ $t['total_btw'] }}</td>
          <td></td>
          <td style="text-align:right">SRD {{ $sale['btw_total'] }}</td>
        </tr>
      </table>
      @if(!empty($store['btw_number']))
      <div style="margin-top:6px; color:#666">{{ $t['btw_number'] }}: {{ $store['btw_number'] }}</div>
      @endif
    </div>
    @endif
  </div>

  <div class="footer">
    @if(!empty($store['receipt_footer']))
    <p>{{ $store['receipt_footer'] }}</p>
    @endif
    <p>{{ $t['thank_you'] }}</p>
    <p style="margin-top:4px; font-size:11px; color:#bbb">{{ $t['powered_by'] }}</p>
  </div>
</div>
</body>
</html>
