import { PackagePlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../products/formatPrice.js'
import StatTile from './StatTile.jsx'
import { MonthsChart, YearsChart } from './StatsCharts.jsx'
import {
  change,
  formatMonth,
  shopMonth,
  useLowStockQuery,
  useStatsHistoryQuery,
  useStatsMonthQuery,
  useStatsProductsQuery,
} from './statsApi.js'

const FIGURES = [
  { key: 'revenue', label: 'Revenue', money: true, upIsGood: true, help: 'Orders delivered this month' },
  { key: 'spent', label: 'Spent', money: true, upIsGood: false, help: 'Restocks dated this month' },
  { key: 'gross_profit', label: 'Gross profit', money: true, upIsGood: true, help: 'Revenue minus the cost of what was sold' },
  { key: 'delivered_orders', label: 'Delivered orders', money: false, upIsGood: true },
]

function MonthFigures({ data }) {
  const { current, previous } = data
  return (
    <>
      <div className="row g-3 mb-3">
        {FIGURES.map((f) => (
          <div key={f.key} className="col-6 col-lg-3">
            <StatTile
              label={f.label}
              value={f.money ? formatPrice(current[f.key]) : current[f.key]}
              delta={change(current[f.key], previous[f.key], f.upIsGood)}
              previousLabel={formatMonth(previous.month)}
              help={f.help}
              flag={f.key === 'gross_profit' && current.profit_incomplete ? 'Incomplete' : null}
            />
          </div>
        ))}
      </div>
      {current.profit_incomplete && (
        <div role="note" className="card p-3 mb-3">
          <p className="mb-1"><strong>Gross profit is incomplete.</strong> These products were sold without a cost price; fill it in to complete the figure:</p>
          <p className="mb-0">
            {current.cost_missing_products.map((p, i) => (
              <span key={p.id}>{i > 0 && ', '}<Link to={`/admin/products/${p.id}`}>{p.name}</Link></span>
            ))}
          </p>
        </div>
      )}
    </>
  )
}

function Ranking({ id, title, rows, value, empty = 'Nothing delivered this month.' }) {
  return (
    <section className="card p-3 h-100" aria-labelledby={id}>
      <h2 id={id} className="h6">{title}</h2>
      {rows.length === 0 ? <p className="small text-body-secondary mb-0">{empty}</p> : (
        <ol className="stat-list mb-0">
          {rows.map((row) => (
            <li key={row.id}>
              <Link to={`/admin/products/${row.id}`} className="text-truncate">{row.name}</Link>
              <span className="ms-auto stat-num">{value(row)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Products({ month }) {
  const { data } = useStatsProductsQuery(month)
  if (!data) return null
  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-md-6 col-xl-3"><Ranking id="top-units" title="Top sellers" rows={data.top_units} value={(r) => `${r.units} sold`} /></div>
        <div className="col-md-6 col-xl-3"><Ranking id="top-revenue" title="Top revenue" rows={data.top_revenue} value={(r) => formatPrice(r.revenue)} /></div>
        <div className="col-md-6 col-xl-3"><Ranking id="top-profit" title="Most profitable" rows={data.top_profit} value={(r) => formatPrice(r.gross_profit)} /></div>
        <div className="col-md-6 col-xl-3">
          <Ranking id="slow" title="Slow sellers" rows={data.slow} value={(r) => `${r.units} sold · ${r.stock} left`} empty="Every product in stock is selling." />
        </div>
      </div>
      <section className="card p-3 mb-3" aria-labelledby="categories">
        <h2 id="categories" className="h6">By category</h2>
        {data.categories.length === 0 ? <p className="small text-body-secondary mb-0">Nothing delivered this month.</p> : (
          <table className="table table-sm align-middle mb-0">
            <thead><tr><th scope="col">Category</th><th scope="col" className="text-end">Units</th><th scope="col" className="text-end">Revenue</th><th scope="col" className="text-end">Gross profit</th></tr></thead>
            <tbody>
              {data.categories.map((c) => (
                <tr key={c.id}>
                  <th scope="row" className="fw-normal">{c.name}</th>
                  <td className="text-end stat-num">{c.units}</td>
                  <td className="text-end stat-num">{formatPrice(c.revenue)}</td>
                  <td className="text-end stat-num">{formatPrice(c.gross_profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

function LowStock() {
  const { data } = useLowStockQuery()
  if (!data) return null
  return (
    <section className="card p-3 mb-3" aria-labelledby="low-stock">
      <h2 id="low-stock" className="h6">Low stock <span className="small text-body-secondary fw-normal">({data.length})</span></h2>
      {data.length === 0 ? <p className="small text-body-secondary mb-0">Every product is above its reorder level.</p> : (
        <table className="table table-sm align-middle mb-0">
          <thead><tr><th scope="col">Product</th><th scope="col" className="text-end">Left</th><th scope="col" className="text-end">Reorder level</th><th scope="col">Usual supplier</th><th scope="col"><span className="visually-hidden">Restock</span></th></tr></thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id}>
                <th scope="row" className="fw-normal"><Link to={`/admin/products/${p.id}`}>{p.name}</Link></th>
                <td className="text-end stat-num">{p.stock}</td>
                <td className="text-end stat-num">{p.reorder_level}</td>
                <td>{p.usual_supplier?.name ?? <span className="text-body-secondary">None</span>}</td>
                <td className="text-end">
                  <Link to={`/admin/restocks/new?product=${p.id}`} className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" aria-label={`Restock ${p.name}`}>
                    <PackagePlus size={16} aria-hidden /> Restock
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default function StatisticsPage() {
  const [month, setMonth] = useState(shopMonth())
  const { data: figures, isFetching } = useStatsMonthQuery(month)
  const { data: history } = useStatsHistoryQuery(month)

  return (
    <section style={{ maxWidth: 1200 }} aria-busy={isFetching}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="h3 me-auto mb-0">Statistics</h1>
        <label htmlFor="stats-month" className="small text-body-secondary">Month</label>
        <input id="stats-month" type="month" className="form-control w-auto" max={shopMonth()} value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)} />
      </div>
      {figures && <MonthFigures data={figures} />}
      {history && (
        <div className="row g-3 mb-3">
          <div className="col-xl-8"><MonthsChart months={history.months} /></div>
          <div className="col-xl-4"><YearsChart years={history.years} /></div>
        </div>
      )}
      <Products month={month} />
      <LowStock />
    </section>
  )
}
