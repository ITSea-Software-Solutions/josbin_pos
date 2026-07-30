import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { INK, MARK, SERIES, axisDate, seriesColor, srd, srdShort } from './viz'

/**
 * The chart pieces the report screens are built from.
 *
 * Deliberately a small set. Five well-made forms used consistently read as one
 * designed product; a different chart per screen reads as several people who
 * never spoke. Every one of these ships a hover tooltip by default — an
 * on-screen chart IS interactive, and a figure a manager cannot read exactly is
 * half a chart.
 */

/* ─────────────────────────────────────────────── surface ───────────────── */

export function ChartCard({
  title, hint, right, children, height = 260,
}: {
  title: string
  hint?: string
  right?: React.ReactNode
  children: React.ReactNode
  height?: number
}) {
  return (
    <section style={{
      background: INK.surface, border: `1px solid ${INK.grid}`,
      borderRadius: 10, padding: '14px 16px 6px',
      display: 'flex', flexDirection: 'column', minWidth: 0,
    }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 2 }}>
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: INK.primary, letterSpacing: '-0.01em' }}>
          {title}
        </h3>
        {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
      </header>
      {hint && (
        <p style={{ margin: '0 0 8px', fontSize: 11.5, color: INK.muted, lineHeight: 1.4 }}>{hint}</p>
      )}
      <div style={{ height, minWidth: 0 }}>{children}</div>
    </section>
  )
}

/** Hero number. Not every question needs a plot — "what did we take today" is
 *  one figure, and a one-bar chart of it is decoration. */
export function StatTile({
  label, value, sub, tone,
}: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div style={{
      background: INK.surface, border: `1px solid ${INK.grid}`, borderRadius: 10,
      padding: '12px 14px', minWidth: 0,
    }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: INK.muted, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{
        fontSize: 23, fontWeight: 750, color: tone ?? INK.primary,
        marginTop: 3, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: INK.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

/* ─────────────────────────────────────────────── tooltip ───────────────── */

function Card({ rows, title }: { title: string; rows: Array<[string, string, string?]> }) {
  return (
    <div style={{
      background: INK.surface, border: `1px solid ${INK.grid}`, borderRadius: 8,
      padding: '8px 10px', boxShadow: '0 6px 20px rgba(15,30,46,.12)', fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, color: INK.primary, marginBottom: 4 }}>{title}</div>
      {rows.map(([k, v, c]) => (
        <div key={k} style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: INK.secondary }}>
            {c && <i style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />}
            {k}
          </span>
          {/* Values wear ink, never the series colour — the swatch carries identity. */}
          <span style={{ color: INK.primary, fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────── trend ─────────────────── */

export interface TrendPoint { date: string; sales: number; btw: number; txns: number; basket: number }

/**
 * Sales over time, with BTW underneath it.
 *
 * Two measures, ONE axis — both are SRD, so they share a scale honestly and the
 * BTW band reads as the slice of the bar it actually is. Transaction count is
 * deliberately NOT plotted here: it is a different unit, and a second y-axis is
 * the single most misleading thing a chart can do. It lives in its own tile.
 */
export function TrendChart({ data, labels, palette = SERIES }: {
  data: TrendPoint[]
  labels: { sales: string; btw: string; txns: string }
  palette?: readonly string[]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="jbSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette[0]} stopOpacity={0.26} />
            <stop offset="100%" stopColor={palette[0]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={INK.grid} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="date" tickFormatter={axisDate} tick={{ fontSize: 11, fill: INK.muted }}
               axisLine={false} tickLine={false} minTickGap={22} />
        <YAxis tickFormatter={srdShort} tick={{ fontSize: 11, fill: INK.muted }}
               axisLine={false} tickLine={false} width={52} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as TrendPoint
            return <Card title={String(label)} rows={[
              [labels.sales, srd(p.sales), palette[0]],
              [labels.btw, srd(p.btw), palette[1]],
              [labels.txns, String(p.txns), undefined],
            ]} />
          }}
          cursor={{ stroke: INK.muted, strokeDasharray: '3 3' }}
        />
        <Area type="monotone" dataKey="sales" stroke={palette[0]} strokeWidth={MARK.lineWidth}
              fill="url(#jbSales)" activeDot={{ r: 4, strokeWidth: 2, stroke: INK.surface }} />
        <Area type="monotone" dataKey="btw" stroke={palette[1]} strokeWidth={MARK.lineWidth}
              fill="none" strokeDasharray="4 3" activeDot={{ r: 4, strokeWidth: 2, stroke: INK.surface }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ─────────────────────────────────────────────── breakdown ─────────────── */

export interface Slice { key: string; label: string; value: number; sub?: string }

/**
 * Ranked magnitude — top products, cashiers, stores, payment mix.
 *
 * Horizontal, because the labels are words and a vertical bar chart turns them
 * into unreadable diagonal text. Rounded end only, anchored to zero: a bar
 * rounded at both ends lies about where it starts.
 *
 * `domain` is the FULL key list, so a colour belongs to the entity and does not
 * shuffle when the ranking changes.
 */
export function BreakdownBars({ data, domain, valueLabel, palette = SERIES }: {
  data: Slice[]
  domain: readonly string[]
  valueLabel: string
  palette?: readonly string[]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 2, right: 56, left: 4, bottom: 2 }}>
        <CartesianGrid stroke={INK.grid} strokeDasharray="2 4" horizontal={false} />
        <XAxis type="number" tickFormatter={srdShort} tick={{ fontSize: 11, fill: INK.muted }}
               axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={116} tick={{ fontSize: 11.5, fill: INK.secondary }}
               axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: 'rgba(30,92,158,.06)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const s = payload[0].payload as Slice
            return <Card title={s.label} rows={[
              [valueLabel, srd(s.value), seriesColor(s.key, domain, palette)],
              ...(s.sub ? [['', s.sub] as [string, string]] : []),
            ]} />
          }}
        />
        {/* minPointSize: a small-but-real value must still draw something.
            Without it a payment method taking SRD 5 beside a cash total of
            SRD 1,200 renders as a sub-pixel bar — indistinguishable from a
            category with no sales at all, which is a different fact entirely.
            Same failure as plotting a zero-able measure; this is the rounding
            version of it. */}
        <Bar dataKey="value" radius={[0, MARK.barRadius, MARK.barRadius, 0]} barSize={16}
             minPointSize={3}>
          {data.map((s) => (
            <Cell key={s.key} fill={seriesColor(s.key, domain, palette)}
                  stroke={INK.surface} strokeWidth={MARK.gap} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Legend. Present whenever there are two or more series, so identity is never
 *  colour alone — the skill's rule, and the reason a printed report still works. */
export function Legend({ items, domain, palette = SERIES }: {
  items: Array<{ key: string; label: string }>
  domain: readonly string[]
  palette?: readonly string[]
}) {
  if (items.length < 2) return null
  return (
    <ul style={{
      display: 'flex', flexWrap: 'wrap', gap: '4px 14px', listStyle: 'none',
      margin: '6px 0 0', padding: 0, fontSize: 11.5, color: INK.secondary,
    }}>
      {items.map((i) => (
        <li key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <i style={{ width: 9, height: 9, borderRadius: 2, background: seriesColor(i.key, domain, palette), display: 'inline-block' }} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/** Empty state. A chart area with nothing in it looks broken; say why. */
export function NoData({ message }: { message: string }) {
  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: INK.muted, fontSize: 12.5, textAlign: 'center', padding: 12,
    }}>{message}</div>
  )
}
