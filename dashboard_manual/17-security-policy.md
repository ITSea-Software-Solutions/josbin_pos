# Chapter 17 — Security Policy: Two-Factor Authentication per Role

**Who needs this:** Super Admin only. The 2FA-per-role policy is a platform-wide control — no one else on the platform can read or change it.

**When to use it:** at install time (set the defaults for the customer's risk appetite), when onboarding a new role of users (decide if cashiers will be 2FA'd), and any time a security incident or audit recommendation prompts a tightening.

**What it prevents:** the slow drift of letting password-only logins into roles that have meaningful access. Once a Cashier or Auditor account is compromised, the blast radius is real — Cashier can take payments, Auditor can read every BTW figure. 2FA is the cheapest mitigation that exists.

> _Screenshot placeholder: `dashboard_manual/screenshots/17-2fa-policy-panel.png`._

---

## 17.1 The hierarchy: always-required, government-required, configurable

Three categories of accounts, by 2FA requirement:

| Category | Roles in it | Can the Super Admin disable 2FA? |
|---|---|---|
| **Always required** | Super Admin | **No.** Hard-coded in `User::TWO_FACTOR_ALWAYS_ROLES`. Removing it requires a code change + a redeploy. |
| **Government always required** | *Any* user belonging to an organisation flagged `is_government = true`, regardless of role | **No.** Required by WBP-S and Rekenkamer rules. Auto-enforced as soon as the org's `is_government` flag is set. |
| **Configurable per-role** | Organisation Admin, Store Manager, Cashier, Auditor | **Yes.** Super Admin toggles individually via this screen. |

API Integration accounts don't appear at all — they authenticate via `X-API-Key`, not TOTP. The whole concept of "2FA for an API key" is a different problem (key rotation + IP allowlisting), covered in [Chapter 12](12-api-integrations-and-webhooks.md).

```
Super Admin                ─── 2FA hard-coded ON, cannot be turned off
Government org users       ─── 2FA forced ON for every role in the org
                               (set at organisation level, see Chapter 2)
Organisation Admin         ─── Configurable per platform policy
Store Manager              ─── Configurable per platform policy
Cashier                    ─── Configurable per platform policy
Auditor                    ─── Configurable per platform policy
API Integration            ─── Not applicable (machine account, API-key auth)
```

The interaction is **OR**, not AND. A user has 2FA required if:

```
required = is in TWO_FACTOR_ALWAYS_ROLES
        OR belongs to a government organisation
        OR their role is in two_factor_required_roles policy setting
```

---

## 17.2 Where the policy lives

The policy is stored under one key in the `app_settings` table:

| Key | Type | Example |
|---|---|---|
| `two_factor_required_roles` | JSON array of role strings | `["organisation_admin", "store_manager"]` |

Reading it:
- API: `GET /api/settings/two-factor-policy` (Super Admin only — returns 403 otherwise)
- Backend: `AppSetting::get('two_factor_required_roles', [])`

Writing it:
- API: `PUT /api/settings/two-factor-policy` with `{ "two_factor_required_roles": ["…"] }` (Super Admin only)
- Validation drops any role not in the configurable set, so the API won't accept `["super_admin"]` (already mandatory) or `["api_integration"]` (not applicable)
- Every change is recorded in the immutable audit log via the `AppSetting` model's `Auditable` trait — old value, new value, who changed it, when, from where

There is **no per-organisation** 2FA policy. It's platform-wide. The granularity is: "in the whole platform, which roles must use 2FA?" The two carve-outs (always-required, government-always-required) are layered on top.

---

## 17.3 Opening the panel

**Path:** Dashboard → **Gebruikers / Users** → scroll to the **🔐 Tweestapsverificatie per rol / Two-factor authentication per role** panel near the top of the page.

The panel is collapsed by default. Click the header to expand.

When expanded you see:

1. An explainer line: *"Super Admins en alle accounts van overheidsorganisaties zijn altijd verplicht — dit kan niet worden uitgeschakeld."*
2. A list of **always-required** roles, each with a purple pill: *"🔒 Altijd verplicht / Always required"*. No toggle — these are read-only and never deactivatable.
3. A list of **configurable** roles, each with a switch. Purple = on, grey = off.
4. **Beleid opslaan / Save policy** button (active only when there are unsaved changes).
5. A **Herstellen / Reset** button to discard unsaved changes.
6. Status confirmation when saved: *"✓ Beleid opgeslagen / Policy saved"*.

> _Screenshot placeholder: `dashboard_manual/screenshots/17-2fa-policy-panel.png`._

If you're not Super Admin, the entire panel is hidden (the API call returns 403 before the panel renders).

---

## 17.4 The role-by-role decision table

This is what most Super Admins want to know: "for which roles should I tick the box?" Some honest defaults:

| Role | Default ON? | Reasoning |
|---|:-:|---|
| **Super Admin** | mandatory | Compromising this account = compromising every customer's data. Non-negotiable. |
| **Organisation Admin** | **ON** | Owns the master catalogue, hires + fires staff, sees every store's revenue. Same blast radius as a CFO leak. |
| **Store Manager** | **ON** | Can void/refund sales, run Z-Reports, see customer PII. Worth the friction. |
| **Cashier** | **OFF** (default) for retail; **ON** for government departments | Cashiers log in/out many times a day on shared till hardware. TOTP on every login slows the queue. Trade-off worth making for high-trust environments only. |
| **Auditor** | **ON** for govt audits; **OFF** for casual external accountants | Read-only doesn't mean low-risk — an auditor account leaks every BTW figure, every customer name (encrypted but identifiable in aggregate), every Rekenkamer-relevant detail. |
| **Government users (any role)** | always ON | Hard-coded — see §17.5. |
| **API Integration** | n/a | Authenticates via `X-API-Key`. See [Chapter 12](12-api-integrations-and-webhooks.md). |

For a **brand-new install** the recommendation is: turn on Organisation Admin + Store Manager + Auditor. Leave Cashier off unless the customer specifically asks. Revisit after the first 30 days based on what staff are actually doing at the till.

---

## 17.5 Government organisations — the automatic carve-out

When an organisation is created with `is_government = true` (see Chapter 2 — Organisation & store setup), **every user belonging to that organisation is forced into 2FA, regardless of the platform policy.**

This includes:

- Organisation Admin → mandatory
- Store Manager → mandatory
- Cashier → mandatory (yes, even on the till)
- Auditor → mandatory (especially for Rekenkamer compliance officers)

The Super Admin **cannot** override this. The `is_government` flag is checked first in `User::requires2FA()` and short-circuits the policy lookup:

```
if (always_role || is_government_user) {
    return true;          // 2FA required, no escape
}
// only then consult the policy
```

The reason: WBP-S (Wet Bescherming Persoonsgegevens Suriname) and the Verwerkersovereenkomst we sign for government clients explicitly require **mandatory non-bypassable 2FA** on every account that can access government data. Building the bypass would breach contract.

Cross-link: see Chapter 1 §1.5 for the wider government-org compliance package (single-device enforcement option, geo-alerts, isolated database, etc.).

---

## 17.6 What happens to users when the policy changes

### Adding a role to the required list

1. Super Admin ticks "Cashier" (for example), saves.
2. The audit log records the change.
3. **No existing cashier is forcibly logged out.** Their current session stays valid.
4. The **next time** any cashier logs in, the login flow detects they don't yet have 2FA enrolled and presents the **2FA enrollment screen** before they can finish login:
   - Show QR code
   - Cashier scans it with Google Authenticator / Microsoft Authenticator / Authy
   - Cashier enters the 6-digit code to confirm
   - 2FA is now bound to their account
5. From that login onward, every login (including session refresh after timeout) demands the TOTP code.

### Removing a role from the required list

1. Super Admin un-ticks "Cashier", saves.
2. Existing cashiers who already enrolled in 2FA **keep** their 2FA setup — the policy change makes it optional, not removed.
3. They can disable it themselves from My Account → Profile (Chapter 18), or leave it on.
4. New cashiers created after the change do not get the 2FA enrollment prompt.

The asymmetry is deliberate: relaxing policy never silently weakens an existing account.

### Resetting a single user's 2FA (lost phone scenario)

The policy panel does not reset individual users. To reset one user's 2FA token (e.g. they lost their phone and the recovery codes), go to **Users → row → Reset 2FA** button. That re-issues the enrollment QR on next login. Audit-logged with the requester's identity.

---

## 17.7 What 2FA actually requires of users

End-user side, with 2FA enabled, the login flow is:

1. **Login screen** — email + password (as today).
2. **2FA challenge** — *"Voer de 6-cijferige code in uit uw authenticator-app"*.
3. User opens Google Authenticator / Microsoft Authenticator / Authy / 1Password, finds the *Josbin POS* entry, reads the 6-digit code, types it.
4. Login completes.

Recovery codes (10 single-use 8-character codes) are shown **once** at enrollment. The user must save them somewhere safe — when they lose the phone, these are how they get back in without help-desk involvement.

Passkeys (FIDO2 / WebAuthn) are also supported for Super Admin and government accounts via Laravel Fortify. The 2FA-per-role policy doesn't currently distinguish "TOTP" from "passkey" — both count as the second factor. See the developer doc on Laravel Fortify for the passkey flow.

---

## 17.8 Auditing — who changed what

Every change to the 2FA policy is written to the immutable audit log. Look there to answer questions like:

- *"When did we turn 2FA on for cashiers?"*
- *"Who reduced auditor security last quarter?"*
- *"Did anyone change the policy during the incident window?"*

In the dashboard: **Audit log → filter by `auditable_type = "AppSetting"`** (Chapter 13 — coming soon). Each row shows:

- The user who clicked Save
- IP address
- Old `value` (e.g. `["organisation_admin"]`)
- New `value` (e.g. `["organisation_admin", "store_manager"]`)
- Timestamp in AST

Because the audit log is append-only with database-level write protection, no Super Admin (not even the one who made the change) can edit or delete the entry.

---

## 17.9 Common policy patterns

| Customer type | Recommended policy |
|---|---|
| **Single-shop owner, one Org Admin + one Cashier account, no audits** | Org Admin ON, Cashier OFF, Auditor OFF, Store Manager OFF (if not used). The owner gets the friction; the till stays fast. |
| **Mid-size supermarket chain, 5+ stores, 50+ cashiers** | Org Admin ON, Store Manager ON, Auditor ON, Cashier OFF. Manager-level controls are what matter; cashier 2FA is operationally painful at scale. |
| **Government ministry** | Whatever you set, it's *all ON* automatically. Just check the `is_government` flag is set correctly on the organisation; the policy panel doesn't need touching for govt-only deployments. |
| **Mixed commercial + government tenant** | Government org's users auto-2FA. For the commercial orgs, decide per platform policy (recommend Org Admin + Store Manager ON). |
| **Belastingdienst auditor parachuting in for a quarterly review** | Auditor ON. The account exists for a few days; one TOTP enrollment is a small price for read-only access to BTW data. |

---

## 17.10 What this panel does NOT do

To save time:

- **Per-organisation 2FA policy** — not supported. The platform policy applies to all non-government orgs equally. Government orgs are forced ON; non-government orgs follow the platform policy.
- **Per-user 2FA override** — not supported. If you need *this one* cashier to use 2FA when the policy is OFF for cashiers, the user can enable it voluntarily from My Account → Profile. There's no admin "force on for this user" toggle.
- **Time-based 2FA exemptions** — not supported. No "skip 2FA during opening hours" or "skip 2FA on this IP range". 2FA is either required for the role or not.
- **Geographic 2FA** — not supported. (Geo-alert on login from outside Suriname *is* a government-org feature, but it's an alert, not a step-up auth challenge.)
- **Adaptive risk-based 2FA** — not supported. No "only prompt for 2FA on unfamiliar devices". Either the role requires it always, or never.
- **WebAuthn-only policy** — not supported. Passkeys count as 2FA, but the policy can't say "TOTP no longer acceptable, only passkeys". On the roadmap.

These are deliberate simplifications. Every "smart" 2FA control adds a way for an attacker to social-engineer a bypass.

---

## 17.11 Quick reference

```
OPEN PANEL          Dashboard → Users → 🔐 Tweestapsverificatie per rol
                    (Super Admin only — hidden otherwise)

ALWAYS ON           Super Admin (hard-coded)
                    All users of any is_government = true org

CONFIGURABLE        Org Admin, Store Manager, Cashier, Auditor
                    (each with an independent toggle)

CHANGE POLICY       Toggle role(s) → Beleid opslaan / Save policy
                    Audit-logged. Existing sessions keep working until
                    next login, then 2FA enrollment is enforced.

API ENDPOINTS       GET /api/settings/two-factor-policy   (read)
                    PUT /api/settings/two-factor-policy   (update)

RESET ONE USER      Users → row → Reset 2FA → next login prompts re-enrollment
                    (use when a user loses their phone)

WHERE STORED        app_settings.value = JSON array of role strings
                    Key: two_factor_required_roles
```

For per-user 2FA setup, recovery codes, and how to disable your own 2FA when it's optional for your role, see [Chapter 18 — My Account](18-my-account.md). For the wider security architecture (bcrypt cost factor, geo-alerts, single-device enforcement, encrypted PII), see the project proposal §13 "Security Architecture".

---

→ Next: [Chapter 18 — My Account](18-my-account.md)
