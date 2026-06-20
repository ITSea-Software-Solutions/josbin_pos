@php($nl = ($locale ?? 'nl') === 'nl')
<!DOCTYPE html>
<html lang="{{ $locale ?? 'nl' }}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#0e1a14;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:linear-gradient(135deg,#0c3a22,#0e4429);border-radius:14px 14px 0 0;padding:22px 26px;color:#fff;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#f4c430;text-transform:uppercase;">
        {{ $nl ? 'Republiek Suriname · Belastingdienst' : 'Republic of Suriname · Tax Authority' }}
      </div>
      <div style="font-size:22px;font-weight:bold;margin-top:4px;font-family:Georgia,serif;">
        {{ $nl ? 'BTW-aangifte betwist' : 'BTW filing disputed' }}
      </div>
    </div>

    <div style="background:#fff;border:1px solid #d8e2db;border-top:none;border-radius:0 0 14px 14px;padding:24px 26px;">
      <p style="font-size:14px;line-height:1.6;margin:0 0 14px;">
        {{ $nl
          ? "Geachte {$orgName},"
          : "Dear {$orgName}," }}
      </p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#34433b;">
        {{ $nl
          ? 'De Belastingdienst heeft uw onderstaande BTW-aangifte betwist. Corrigeer de gegevens en dien de aangifte opnieuw in via het Josbin POS-beheerportaal.'
          : 'The Tax Authority has disputed your BTW filing below. Please correct the figures and resubmit it from the Josbin POS management portal.' }}
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:13.5px;margin-bottom:18px;">
        <tr><td style="padding:6px 0;color:#5b6b62;width:42%;">{{ $nl ? 'Referentie' : 'Reference' }}</td><td style="padding:6px 0;font-weight:bold;">{{ $reference }}</td></tr>
        <tr><td style="padding:6px 0;color:#5b6b62;">{{ $nl ? 'Periode' : 'Period' }}</td><td style="padding:6px 0;">{{ $period }}</td></tr>
        <tr><td style="padding:6px 0;color:#5b6b62;">{{ $nl ? 'BTW-bedrag' : 'BTW amount' }}</td><td style="padding:6px 0;font-weight:bold;">SRD {{ $btw }}</td></tr>
      </table>

      <div style="background:#fdecec;border:1px solid #f5c2c2;border-radius:10px;padding:12px 16px;margin-bottom:18px;">
        <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;color:#c8102e;margin-bottom:6px;">
          {{ $nl ? 'Reden van betwisting' : 'Reason for dispute' }}
        </div>
        <div style="font-size:14px;line-height:1.55;color:#0e1a14;white-space:pre-wrap;">{{ $reason }}</div>
      </div>

      <a href="{{ $portalUrl }}" style="display:inline-block;background:#1f6b3b;color:#fff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 22px;border-radius:10px;">
        {{ $nl ? 'Corrigeren & opnieuw indienen' : 'Correct & resubmit' }} →
      </a>

      <p style="font-size:12px;color:#9aa8a0;line-height:1.5;margin:20px 0 0;">
        {{ $nl
          ? 'Open het beheerportaal → BTW-aangiftes, kies deze aangifte en gebruik “Corrigeer / opnieuw indienen”. Een nieuwe aangifte met bijgewerkte totalen wordt dan opnieuw beoordeeld.'
          : 'Open the management portal → BTW Submissions, select this filing and use “Correct / Resubmit”. A fresh filing with updated totals will then be reviewed again.' }}
      </p>
    </div>

    <p style="font-size:11px;color:#9aa8a0;text-align:center;margin:16px 0 0;">
      Josbin POS · Belastingdienst Suriname · AST (UTC−3)
    </p>
  </div>
</body>
</html>
