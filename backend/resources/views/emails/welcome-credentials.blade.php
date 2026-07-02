@php($nl = ($locale ?? 'nl') === 'nl')
<!DOCTYPE html>
<html lang="{{ $locale ?? 'nl' }}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#0e1a14;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:linear-gradient(135deg,#0c3a22,#0e4429);border-radius:14px 14px 0 0;padding:22px 26px;color:#fff;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#f4c430;text-transform:uppercase;">
        {{ $appName }}
      </div>
      <div style="font-size:22px;font-weight:bold;margin-top:4px;font-family:Georgia,serif;">
        {{ $nl ? 'Welkom bij ' . $appName : 'Welcome to ' . $appName }}
      </div>
    </div>

    <div style="background:#fff;border:1px solid #d8e2db;border-top:none;border-radius:0 0 14px 14px;padding:24px 26px;">
      <p style="font-size:14px;line-height:1.6;margin:0 0 14px;">
        {{ $nl ? "Beste {$name}," : "Hi {$name}," }}
      </p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#34433b;">
        {{ $nl
          ? ($orgName
              ? "Er is een account voor u aangemaakt bij {$orgName} in {$appName}. U kunt inloggen met het onderstaande e-mailadres."
              : "Er is een account voor u aangemaakt in {$appName}. U kunt inloggen met het onderstaande e-mailadres.")
          : ($orgName
              ? "An account has been created for you at {$orgName} in {$appName}. You can sign in with the email address below."
              : "An account has been created for you in {$appName}. You can sign in with the email address below.") }}
      </p>

      <div style="background:#eaf6ee;border:1px solid #bfe3cb;border-radius:10px;padding:12px 16px;margin-bottom:18px;">
        <table style="width:100%;border-collapse:collapse;font-size:13.5px;">
          <tr>
            <td style="padding:6px 0;color:#5b6b62;width:42%;">{{ $nl ? 'Inlog-e-mail' : 'Login email' }}</td>
            <td style="padding:6px 0;font-weight:bold;">{{ $email }}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#5b6b62;">{{ $nl ? 'Wachtwoord' : 'Password' }}</td>
            <td style="padding:6px 0;">
              {{ $nl
                ? 'Uw beheerder deelt uw wachtwoord veilig met u.'
                : 'Your administrator will share your password with you securely.' }}
            </td>
          </tr>
        </table>
      </div>

      <p style="font-size:13px;line-height:1.6;margin:0 0 18px;color:#5b6b62;">
        {{ $nl
          ? 'Om veiligheidsredenen versturen wij nooit een wachtwoord per e-mail. Wijzig uw wachtwoord na de eerste keer inloggen.'
          : 'For security reasons we never send a password by email. Please change your password after your first sign-in.' }}
      </p>

      <a href="{{ $dashboardUrl }}" style="display:inline-block;background:#1f6b3b;color:#fff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 22px;border-radius:10px;">
        {{ $nl ? 'Naar het dashboard' : 'Go to the dashboard' }} →
      </a>

      @if(!empty($supportEmail))
      <p style="font-size:12px;line-height:1.6;margin:20px 0 0;color:#9aa8a0;">
        {{ $nl ? 'Vragen? Neem contact op via' : 'Questions? Contact us at' }}
        <a href="mailto:{{ $supportEmail }}" style="color:#1f6b3b;">{{ $supportEmail }}</a>.
      </p>
      @endif
    </div>

    <p style="font-size:11px;color:#9aa8a0;text-align:center;margin:16px 0 0;">
      {{ $appName }} · {{ $nl ? 'Betrouwbaar kassasysteem voor Suriname' : 'Reliable POS for Suriname' }} · AST (UTC−3)
    </p>
  </div>
</body>
</html>
