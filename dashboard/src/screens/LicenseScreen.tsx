import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import apiClient from '@/api/client'

// ─── Types ────────────────────────────────────────────────────────────────────
interface License {
  id: string
  organisation_id: string
  organisation_name: string
  tier: 'standard' | 'professional' | 'enterprise'
  max_stores: number
  max_terminals: number
  valid_from: string
  valid_until: string
  days_remaining: number
  is_active: boolean
  last_validated_at: string | null
  grace_period_ends_at: string | null
  renewal_status: string | null
  urgency: 'ok' | 'medium' | 'high' | 'critical'
}

async function getLicenses(): Promise<License[]> {
  const res = await apiClient.get<{ data: License[] }>('/licenses')
  return res.data.data
}

async function requestRenewal(id: string, notes: string): Promise<void> {
  await apiClient.post(`/licenses/${id}/renew`, { notes })
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const URGENCY_CFG = {
  ok:       { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e', label: { nl: 'Geldig',     en: 'Valid'    } },
  medium:   { bg: '#fffbeb', color: '#92400e', border: '#fde68a', dot: '#f59e0b', label: { nl: '30 dagen',   en: '30 days'  } },
  high:     { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa', dot: '#f97316', label: { nl: 'Vernieuwen', en: 'Renew'    } },
  critical: { bg: '#fef2f2', color: '#7f1d1d', border: '#fecaca', dot: '#ef4444', label: { nl: 'Kritiek',    en: 'Critical' } },
}

const TIER_CFG: Record<string, { bg: string; color: string }> = {
  standard:     { bg: '#eef2ff', color: '#4338ca' },
  professional: { bg: '#f3f0ff', color: '#6d28d9' },
  enterprise:   { bg: '#eff6ff', color: '#1d4ed8' },
}

function UrgencyBadge({ urgency, isNl }: { urgency: License['urgency']; isNl: boolean }) {
  const c = URGENCY_CFG[urgency]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
      {c.label[isNl ? 'nl' : 'en']}
    </span>
  )
}

function TierBadge({ tier }: { tier: string }) {
  const c = TIER_CFG[tier] ?? { bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800,
      background: c.bg, color: c.color, textTransform: 'capitalize' as const, letterSpacing: '0.3px',
    }}>
      {tier}
    </span>
  )
}

function DaysGauge({ days, isNl }: { days: number; isNl: boolean }) {
  const expired = days < 0
  const color = expired ? '#dc2626' : days <= 14 ? '#ea580c' : days <= 30 ? '#d97706' : '#16a34a'
  const bg    = expired ? '#fef2f2' : days <= 14 ? '#fff7ed' : days <= 30 ? '#fffbeb' : '#f0fdf4'
  return (
    <span style={{ fontWeight: 800, fontSize: 15, color, background: bg, padding: '3px 10px', borderRadius: 8, whiteSpace: 'nowrap' as const }}>
      {expired
        ? `−${Math.abs(days)} ${isNl ? 'dag.' : 'days'}`
        : `${days} ${isNl ? 'dag.' : 'days'}`}
    </span>
  )
}

function OrgAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const hue = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % 360
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
      background: `hsl(${hue},55%,88%)`, color: `hsl(${hue},55%,30%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 800,
    }}>
      {initials}
    </div>
  )
}

function RenewalModal({ license, isNl, onClose }: { license: License; isNl: boolean; onClose: () => void }) {
  const [notes, setNotes] = useState('')
  const [done, setDone]   = useState(false)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => requestRenewal(license.id, notes),
    onSuccess: () => {
      setDone(true)
      qc.invalidateQueries({ queryKey: ['licenses'] })
    },
  })

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,10,40,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
              background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#166534', marginBottom: 8 }}>
              {isNl ? 'Aanvraag ingediend' : 'Request submitted'}
            </p>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
              {isNl ? 'U wordt binnen 1 werkdag gecontacteerd.' : 'You will be contacted within 1 business day.'}
            </p>
            <button onClick={onClose} style={{ padding: '11px 32px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {isNl ? 'Sluiten' : 'Close'}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1c1c2e', marginBottom: 3 }}>
                  {isNl ? 'Licentie vernieuwen' : 'Renew license'}
                </h3>
                <p style={{ fontSize: 13, color: '#9090a0' }}>
                  {license.organisation_name} · <span style={{ textTransform: 'capitalize' }}>{license.tier}</span>
                </p>
              </div>
              <button onClick={onClose} style={{ background: '#f5f5fb', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#6b7280' }}>×</button>
            </div>

            {/* License info card */}
            <div style={{ background: '#f5f5fb', borderRadius: 12, padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 20 }}>
              {[
                { label: isNl ? 'Geldig tot' : 'Valid until', value: new Date(license.valid_until).toLocaleDateString(isNl ? 'nl-SR' : 'en-US') },
                { label: isNl ? 'Vestigingen' : 'Stores',    value: `${license.max_stores}` },
                { label: isNl ? 'Terminals' : 'Terminals',   value: `${license.max_terminals}` },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: 11, color: '#9090a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1c1c2e' }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                {isNl ? 'Opmerkingen (optioneel)' : 'Notes (optional)'}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isNl ? 'Bijv. verlenging voor 12 maanden, zelfde tier…' : 'E.g. renewal for 12 months, same tier…'}
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid #e0e0ed', borderRadius: 10, fontSize: 13, resize: 'none', outline: 'none', lineHeight: 1.5 }}
              />
            </div>

            {mutation.isError && (
              <p style={{ fontSize: 12.5, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8, marginBottom: 16 }}>
                {isNl ? 'Er is een fout opgetreden.' : 'An error occurred.'}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: '#f5f5fb', border: '1px solid #e0e0ed', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
                {isNl ? 'Annuleren' : 'Cancel'}
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                style={{ flex: 1, padding: '11px 0', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: mutation.isPending ? 0.6 : 1 }}
              >
                {mutation.isPending ? (isNl ? 'Versturen...' : 'Sending...') : (isNl ? 'Aanvraag versturen' : 'Submit request')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function LicenseScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const [renewTarget, setRenewTarget] = useState<License | null>(null)

  const { data: licenses, isLoading } = useQuery({
    queryKey: ['licenses'],
    queryFn: getLicenses,
  })

  const total         = licenses?.length ?? 0
  const activeCount   = licenses?.filter((l) => l.is_active).length ?? 0
  const criticalCount = licenses?.filter((l) => l.urgency === 'critical').length ?? 0
  const highCount     = licenses?.filter((l) => l.urgency === 'high').length ?? 0

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {isNl ? 'Licentiebeheer' : 'License Management'}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {isNl
            ? 'Beheer en verleng licenties voor alle organisaties op het platform.'
            : 'Manage and renew licenses for all organisations on the platform.'}
        </p>
      </div>

      {/* Stats row */}
      {!isLoading && licenses && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24, maxWidth: 720 }}>
          {[
            { label: isNl ? 'Totaal'    : 'Total',    value: total,         color: '#7c3aed' },
            { label: isNl ? 'Actief'    : 'Active',   value: activeCount,   color: '#16a34a' },
            { label: isNl ? 'Verlopen'  : 'Expiring', value: highCount,     color: '#d97706' },
            { label: isNl ? 'Kritiek'   : 'Critical', value: criticalCount, color: '#dc2626' },
          ].map((s) => (
            <div key={s.label} style={{
              background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14,
              padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
            }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#9090a0', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Alert banners */}
      {criticalCount > 0 && (
        <div style={{
          marginBottom: 14, padding: '14px 20px', borderRadius: 12,
          background: '#fef2f2', border: '1px solid #fecaca',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <p style={{ fontSize: 13.5, color: '#7f1d1d', fontWeight: 700 }}>
            {isNl
              ? `${criticalCount} licentie${criticalCount > 1 ? 's' : ''} vereisen onmiddellijke actie — verlopen of in noodperiode.`
              : `${criticalCount} license${criticalCount > 1 ? 's' : ''} require immediate action — expired or in grace period.`}
          </p>
        </div>
      )}
      {highCount > 0 && (
        <div style={{
          marginBottom: 20, padding: '14px 20px', borderRadius: 12,
          background: '#fff7ed', border: '1px solid #fed7aa',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p style={{ fontSize: 13.5, color: '#9a3412', fontWeight: 700 }}>
            {isNl
              ? `${highCount} licentie${highCount > 1 ? 's' : ''} verlopen binnen 14 dagen. Verleng zo snel mogelijk.`
              : `${highCount} license${highCount > 1 ? 's' : ''} expire within 14 days. Renew soon.`}
          </p>
        </div>
      )}

      {/* Table card */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)', marginBottom: 24 }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px', borderBottom: '1px solid #f3f3f8' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f0f0f8', flexShrink: 0 }} />
                <div style={{ flex: 1, height: 13, borderRadius: 7, background: '#f0f0f8', maxWidth: 200 }} />
                <div style={{ width: 70, height: 20, borderRadius: 6, background: '#f5f5fb' }} />
                <div style={{ width: 100, height: 12, borderRadius: 6, background: '#f5f5fb' }} />
                <div style={{ width: 60, height: 22, borderRadius: 11, background: '#f0f0f8' }} />
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(to right,#f8f7ff,#f5f5fb)', borderBottom: '1px solid #eeeef8' }}>
                {[
                  isNl ? 'Organisatie' : 'Organisation',
                  isNl ? 'Tier' : 'Tier',
                  isNl ? 'Limieten' : 'Limits',
                  isNl ? 'Geldig tot' : 'Valid until',
                  isNl ? 'Resterende dagen' : 'Days left',
                  isNl ? 'Laatste validatie' : 'Last validated',
                  isNl ? 'Status' : 'Status',
                  '',
                ].map((h) => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(licenses ?? []).map((lic, i) => {
                const expired = lic.days_remaining < 0
                return (
                  <tr
                    key={lic.id}
                    style={{ borderBottom: i < (licenses?.length ?? 0) - 1 ? '1px solid #f3f3f8' : 'none', transition: 'background .12s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,.025)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <OrgAvatar name={lic.organisation_name} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{lic.organisation_name}</div>
                          <div style={{ fontSize: 11, color: '#9090a0', marginTop: 1 }}>{lic.id.slice(0, 8)}…</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <TierBadge tier={lic.tier} />
                    </td>
                    <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 12.5, color: '#374151', fontWeight: 600 }}>
                        {lic.max_stores} {isNl ? 'vestig.' : 'stores'}
                      </div>
                      <div style={{ fontSize: 11, color: '#9090a0', marginTop: 1 }}>
                        {lic.max_terminals} {isNl ? 'terminals' : 'terminals'}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 13.5, fontWeight: expired ? 700 : 600, color: expired ? '#dc2626' : '#1c1c2e' }}>
                        {new Date(lic.valid_until).toLocaleDateString(isNl ? 'nl-SR' : 'en-US')}
                      </div>
                      {lic.grace_period_ends_at && (
                        <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2, fontWeight: 600 }}>
                          {isNl ? 'Noodperiode tot ' : 'Grace until '}
                          {new Date(lic.grace_period_ends_at).toLocaleDateString(isNl ? 'nl-SR' : 'en-US')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <DaysGauge days={lic.days_remaining} isNl={isNl} />
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: '#9090a0' }}>
                      {lic.last_validated_at
                        ? new Date(lic.last_validated_at).toLocaleString(isNl ? 'nl-SR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {lic.renewal_status === 'renewal_pending' ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                          background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }} />
                          {isNl ? 'In behandeling' : 'Pending'}
                        </span>
                      ) : (
                        <UrgencyBadge urgency={lic.urgency} isNl={isNl} />
                      )}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {lic.renewal_status !== 'renewal_pending' && lic.urgency !== 'ok' && (
                        <button
                          onClick={() => setRenewTarget(lic)}
                          style={{
                            padding: '6px 14px', borderRadius: 8,
                            background: lic.urgency === 'critical'
                              ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                              : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                            color: '#fff', border: 'none', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', whiteSpace: 'nowrap',
                            boxShadow: lic.urgency === 'critical'
                              ? '0 2px 8px rgba(220,38,38,.3)'
                              : '0 2px 8px rgba(124,58,237,.3)',
                          }}
                        >
                          {isNl ? 'Vernieuwen' : 'Renew'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {(licenses ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '60px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>
                      {isNl ? 'Geen licenties gevonden' : 'No licenses found'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Footer */}
        {!isLoading && total > 0 && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid #f3f3f8', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, color: '#9090a0' }}>
              {total} {isNl ? 'licenties in totaal' : 'licenses total'}
            </span>
          </div>
        )}
      </div>

      {/* Timeline legend */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e9e9ef', padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {isNl ? 'Verlooptijdlijn' : 'Expiry timeline'}
        </p>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { color: '#22c55e', label: isNl ? '> 30 dagen — volledig operationeel'                          : '> 30 days — fully operational' },
            { color: '#f59e0b', label: isNl ? '≤ 30 dagen — gele banner + dagelijkse e-mail'               : '≤ 30 days — yellow banner + daily email' },
            { color: '#ea580c', label: isNl ? '≤ 14 dagen — oranje banner, POS normaal'                    : '≤ 14 days — orange banner, POS unaffected' },
            { color: '#dc2626', label: isNl ? 'Verlopen + 14 dgn noodperiode — rode banner'                : 'Expired + 14-day grace period — red banner' },
            { color: '#7f1d1d', label: isNl ? 'Noodperiode +30 dgn — SOFT LOCK nieuw verkopen geblokkeerd' : 'Grace + 30 days — SOFT LOCK new sales blocked' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Renewal modal */}
      {renewTarget && (
        <RenewalModal license={renewTarget} isNl={isNl} onClose={() => setRenewTarget(null)} />
      )}
    </div>
  )
}
