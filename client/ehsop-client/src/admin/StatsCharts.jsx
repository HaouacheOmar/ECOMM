import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatPrice } from '../products/formatPrice.js'
import { formatMonth, formatMonthShort } from './statsApi.js'

// One fixed colour per measure (tokens validated for colour-blind separation), never per rank.
const SERIES = [
  { key: 'revenue', label: 'Revenue', color: 'var(--es-chart-revenue)' },
  { key: 'spent', label: 'Spent', color: 'var(--es-chart-spent)' },
  { key: 'gross_profit', label: 'Gross profit', color: 'var(--es-chart-profit)' },
]

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const AXIS = { axisLine: false, tickLine: false, tick: { fill: 'var(--es-muted)', fontSize: 12 } }

function Legend({ mark }) {
  return (
    <ul className="chart-legend" aria-label="Legend">
      {SERIES.map((s) => (
        <li key={s.key}><span className={`chart-key chart-key-${mark}`} style={{ background: s.color }} aria-hidden />{s.label}</li>
      ))}
    </ul>
  )
}

// Values lead, series names follow; every series at that point, keyed with a short line.
function Readout({ active, payload, label, title }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="small text-body-secondary mb-1">{title(label)}</div>
      {SERIES.map((s) => {
        const row = payload.find((p) => p.dataKey === s.key)
        return row && (
          <div key={s.key} className="chart-tooltip-row">
            <span className="chart-key chart-key-line" style={{ background: s.color }} aria-hidden />
            <strong>{formatPrice(row.value)}</strong>
            <span className="text-body-secondary">{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function DataTable({ rows, periodLabel, caption }) {
  return (
    <table className="table table-sm align-middle mb-0 chart-table">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr><th scope="col">{periodLabel}</th>{SERIES.map((s) => <th key={s.key} scope="col" className="text-end">{s.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.period}>
            <th scope="row" className="fw-normal">{row.label}</th>
            {SERIES.map((s) => <td key={s.key} className="text-end">{formatPrice(row[s.key])}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ChartCard({ id, title, mark, table, children }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section className="card p-3" aria-labelledby={id}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <h2 id={id} className="h6 mb-0 me-auto">{title}</h2>
        {!asTable && <Legend mark={mark} />}
        <button type="button" className="btn btn-outline-secondary btn-sm" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
          {asTable ? 'Show chart' : 'Show table'}
        </button>
      </div>
      {asTable ? table : <div className="chart-plot">{children}</div>}
    </section>
  )
}

const toNumbers = (point) => ({ ...point, revenue: Number(point.revenue), spent: Number(point.spent), gross_profit: Number(point.gross_profit) })

export function MonthsChart({ months }) {
  const data = months.map(toNumbers)
  const rows = data.map((p) => ({ ...p, label: formatMonth(p.period) }))
  return (
    <ChartCard id="chart-months" title="Last 12 months" mark="line"
      table={<DataTable rows={rows} periodLabel="Month" caption="Revenue, Spent and Gross profit for the last 12 months" />}>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--es-hairline)" />
          <XAxis dataKey="period" tickFormatter={formatMonthShort} {...AXIS} />
          <YAxis tickFormatter={(v) => compact.format(v)} width={44} {...AXIS} />
          <Tooltip content={<Readout title={formatMonth} />} cursor={{ stroke: 'var(--es-muted)', strokeWidth: 1 }} />
          {SERIES.map((s) => (
            <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} type="linear" dot={false}
              activeDot={{ r: 4, fill: s.color, stroke: 'var(--es-surface)', strokeWidth: 2 }} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function YearsChart({ years }) {
  const data = years.map(toNumbers)
  const rows = data.map((p) => ({ ...p, label: p.period }))
  return (
    <ChartCard id="chart-years" title="By year" mark="bar"
      table={<DataTable rows={rows} periodLabel="Year" caption="Revenue, Spent and Gross profit per year" />}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={2} barCategoryGap="30%" accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--es-hairline)" />
          <XAxis dataKey="period" {...AXIS} />
          <YAxis tickFormatter={(v) => compact.format(v)} width={44} {...AXIS} />
          <Tooltip content={<Readout title={(year) => year} />} cursor={{ fill: 'var(--es-hairline)', opacity: 0.6 }} />
          {SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
