import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getReportSeries } from '@/api/reports'
import { BreakdownBars, ChartCard, Legend, NoData, StatTile, TrendChart } from './Charts'
import { INK, srd } from './viz'

/**
 * The graphs, shared by every role that gets them.
 *
 * One component rather than one per role, because the difference between a
 * manager's view and an organisation admin's is *scope*, not layout — and scope
 * is decided by the server from the caller's identity, not by a prop here. Pass
 * a storeId for one store, omit it for the whole organisation; a tax inspector
 * gets every organisation and may narrow with organisationId.
 *
 * The store-comparison chart appears only when the window actually spans more
 * than one store, so a single-shop manager is not shown a bar chart with one bar.
 */
export default function AnalyticsPanel({
  storeId, organisationId, dateFrom, dateTo,
}: {
  storeId?: string
  organisationId?: string
  dateFrom: string
  dateTo: string
}) {
  const { t, i18n } = useTranslation()
  const isNl = i18n.language === 'nl'

  const { data, isLoading, isError } = useQuery({
    queryKey: ['report-series', storeId ?? 'org', organisationId ?? '-', dateFrom, dateTo],
    queryFn: () => getReportSeries({
      store_id: storeId || undefined,
      organisation_id: organisationId || undefined,
      date_from: dateFrom,
      date_to: dateTo,
    }),
    staleTime: 60_000,
  })

  const L = {
    sales:    isNl ? 'Omzet' : 'Revenue',
    btw:      'BTW',
    txns:     isNl ? 'Transacties' : 'Transactions',
    basket:   isNl ? 'Gem. mandje' : 'Avg basket',
    trend:    isNl ? 'Omzet en BTW per dag' : 'Revenue and BTW by day',
    trendHint: isNl
      ? 'Beide in SRD op dezelfde as. De streepjeslijn is de BTW binnen die omzet.'
      : 'Both in SRD on one axis. The dashed line is the BTW inside that revenue.',
    products: isNl ? 'Bestverkochte producten' : 'Top products',
    cashiers: isNl ? 'Per kassamedewerker' : 'By cashier',
    stores:   isNl ? 'Per vestiging' : 'By store',
    payments: isNl ? 'Betaalwijze' : 'Payment method',
    btwRate:  isNl ? 'BTW per tarief' : 'BTW by rate',
    btwHint:  isNl
      ? 'Balklengte is de omzet bij dat tarief; het BTW-bedrag staat erbij. Vrijgestelde regels staan op 0% — apart van het standaardtarief, zoals de Belastingdienst ze wil zien.'
      : 'Bar length is the turnover at that rate, with the BTW amount beside it. Exempt lines sit at 0% — separate from the standard rate, the way the Belastingdienst wants them.',
    empty:    isNl ? 'Geen verkopen in deze periode.' : 'No sales in this period.',
    revenue:  isNl ? 'Omzet' : 'Revenue',
    turnover: isNl ? 'Omzet bij dit tarief' : 'Turnover at this rate',
  }

  if (isLoading) {
    return <p style={{ color: INK.muted, fontSize: 13 }}>{isNl ? 'Laden…' : 'Loading…'}</p>
  }
  if (isError || !data) {
    return <p style={{ color: INK.muted, fontSize: 13 }}>{t('common.error', { defaultValue: 'Could not load the report.' })}</p>
  }

  const totalSales = data.trend.reduce((s, d) => s + d.sales, 0)
  const totalBtw   = data.trend.reduce((s, d) => s + d.btw, 0)
  const totalTxns  = data.trend.reduce((s, d) => s + d.txns, 0)
  const basket     = totalTxns > 0 ? totalSales / totalTxns : 0
  const nothing    = totalTxns === 0

  // Domains are the FULL key lists, so a colour belongs to the entity and does
  // not shuffle when the ranking changes or a filter narrows the set.
  const payDomain   = data.payments.map((p) => p.method)
  const prodDomain  = data.products.map((p) => p.name)
  const cashDomain  = data.cashiers.map((c) => c.name)
  const storeDomain = data.stores.map((s) => s.name)
  const btwDomain   = data.btw.map((b) => b.rate)

  const payLabel = (m: string) => ({
    cash:            isNl ? 'Contant' : 'Cash',
    card:            isNl ? 'Pin/kaart' : 'Card',
    mixed:           isNl ? 'Gemengd' : 'Mixed',
    bank_transfer:   isNl ? 'Bankoverboeking' : 'Bank transfer',
    mobile_transfer: isNl ? 'Mobiel' : 'Mobile',
    foreign_cash:    isNl ? 'Valuta' : 'Foreign cash',
    qr_payment:      'QR',
  } as Record<string, string>)[m] ?? m

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Summary before detail — the four figures a manager wants before any chart. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <StatTile label={L.sales}  value={srd(totalSales)} sub={`${data.date_from} → ${data.date_to}`} />
        <StatTile label={L.btw}    value={srd(totalBtw)} />
        <StatTile label={L.txns}   value={totalTxns.toLocaleString('nl-SR')} />
        <StatTile label={L.basket} value={srd(basket)} />
      </div>

      <ChartCard title={L.trend} hint={L.trendHint} height={250}
        right={<Legend items={[{ key: 'sales', label: L.sales }, { key: 'btw', label: L.btw }]}
                       domain={['sales', 'btw']} />}>
        {nothing ? <NoData message={L.empty} />
                 : <TrendChart data={data.trend} labels={{ sales: L.sales, btw: L.btw, txns: L.txns }} />}
      </ChartCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 14 }}>
        <ChartCard title={L.products} height={230}>
          {data.products.length === 0 ? <NoData message={L.empty} /> : (
            <BreakdownBars valueLabel={L.revenue} domain={prodDomain}
              data={data.products.map((p) => ({
                key: p.name, label: p.name.length > 22 ? p.name.slice(0, 21) + '…' : p.name,
                value: p.revenue, sub: `${p.qty} × `,
              }))} />
          )}
        </ChartCard>

        <ChartCard title={L.payments} height={230}>
          {data.payments.length === 0 ? <NoData message={L.empty} /> : (
            <BreakdownBars valueLabel={L.revenue} domain={payDomain}
              data={data.payments.map((p) => ({
                key: p.method, label: payLabel(p.method), value: p.total,
                sub: `${p.txns} ${L.txns.toLowerCase()}`,
              }))} />
          )}
        </ChartCard>

        <ChartCard title={L.btwRate} hint={L.btwHint} height={230}>
          {/* Bar length is TURNOVER at that rate, not the BTW amount. Plotting
              the BTW made the 0% exempt row a zero-length bar — invisible — and
              that row is the whole point of this chart to a tax inspector:
              nearly half a Suriname shop's trade is exempt staples, and it
              rendered as nothing at all. Turnover is non-zero for every rate, so
              every rate shows up; the BTW figure rides along as the sub-label
              and in the tooltip. */}
          {data.btw.length === 0 ? <NoData message={L.empty} /> : (
            <BreakdownBars valueLabel={L.turnover} domain={btwDomain}
              data={data.btw.map((b) => ({
                key: b.rate, label: b.rate, value: b.base,
                sub: `BTW ${srd(b.btw)}`,
              }))} />
          )}
        </ChartCard>

        <ChartCard title={L.cashiers} height={230}>
          {data.cashiers.length === 0 ? <NoData message={L.empty} /> : (
            <BreakdownBars valueLabel={L.revenue} domain={cashDomain}
              data={data.cashiers.map((c) => ({
                key: c.name, label: c.name, value: c.total,
                sub: `${c.txns} × · ${srd(c.basket ?? 0)}`,
              }))} />
          )}
        </ChartCard>

        {/* Only when there is more than one store to compare. A single-shop
            manager does not need a bar chart with one bar in it. */}
        {data.stores.length > 1 && (
          <ChartCard title={L.stores} height={230}>
            <BreakdownBars valueLabel={L.revenue} domain={storeDomain}
              data={data.stores.map((s) => ({
                key: s.name, label: s.name, value: s.total,
                sub: `${s.txns} × · BTW ${srd(s.btw ?? 0)}`,
              }))} />
          </ChartCard>
        )}
      </div>
    </div>
  )
}
