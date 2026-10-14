import { PackagePlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { detailError, fieldError } from './catalogApi.js'
import { REASONS, useCorrectStockMutation, useStockHistoryQuery } from './stockApi.js'

const KIND = {
  ORDER: 'Order',
  ORDER_CANCELLED: 'Order cancelled',
  RESTOCK: 'Restock',
  RESTOCK_CANCELLED: 'Restock cancelled',
  CORRECTION: 'Correction',
}
const REASON = Object.fromEntries(REASONS)
const when = (at) => new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function describe(event) {
  if (event.kind.startsWith('RESTOCK')) return <Link to={`/admin/restocks/${event.restock}`}>{KIND[event.kind]} · {event.supplier}</Link>
  if (event.kind.startsWith('ORDER')) return <Link to={`/admin/orders/${event.order}`}>{KIND[event.kind]} {event.order.slice(0, 8).toUpperCase()}</Link>
  return <>{KIND[event.kind]} · {REASON[event.reason]}{event.note && ` (${event.note})`}</>
}

function CorrectionForm({ product }) {
  const [correct, corrected] = useCorrectStockMutation()
  const [form, setForm] = useState({ quantity: '', reason: 'MISCOUNT', note: '' })
  const error = corrected.error

  const onSubmit = async (e) => {
    e.preventDefault()
    if ((await correct({ product: product.id, ...form })).data) setForm({ quantity: '', reason: 'MISCOUNT', note: '' })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="row g-2 align-items-end" aria-label="Stock correction">
      <div className="col-sm-3">
        <label htmlFor="c-quantity" className="form-label small">Change (+/−)</label>
        <input id="c-quantity" type="number" step={1} className={`form-control${fieldError(error, 'quantity') ? ' is-invalid' : ''}`} placeholder="-2"
          value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
      </div>
      <div className="col-sm-3">
        <label htmlFor="c-reason" className="form-label small">Reason</label>
        <select id="c-reason" className="form-select" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
          {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="col-sm-4">
        <label htmlFor="c-note" className="form-label small">Note</label>
        <input id="c-note" className={`form-control${fieldError(error, 'note') ? ' is-invalid' : ''}`} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>
      <div className="col-sm-2"><button type="submit" className="btn btn-outline-secondary w-100" disabled={corrected.isLoading}>Correct</button></div>
      {error && (
        <div role="alert" className="col-12 text-danger small">
          {fieldError(error, 'quantity') ?? fieldError(error, 'reason') ?? fieldError(error, 'note')
            ?? (error.data?.code === 'not_enough_stock' ? 'Stock cannot go below zero.' : detailError(error))}
        </div>
      )}
    </form>
  )
}

export default function StockPanel({ product }) {
  const { data: history } = useStockHistoryQuery(product.id)

  return (
    <section className="card p-4 mt-3" aria-labelledby="stock-heading">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h2 id="stock-heading" className="h5 me-auto mb-0">Stock: <span data-testid="stock-level">{product.stock}</span></h2>
        {!product.is_archived && (
          <Link to={`/admin/restocks/new?product=${product.id}`} className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1">
            <PackagePlus size={16} aria-hidden /> Record restock
          </Link>
        )}
      </div>
      <CorrectionForm product={product} />
      <h3 className="h6 mt-4">Stock history</h3>
      {history?.events.length === 0 && <p className="small text-body-secondary mb-0">No stock changes yet.</p>}
      {history?.events.length > 0 && (
        <table className="table table-sm align-middle mb-0">
          <thead><tr><th scope="col">When</th><th scope="col">What</th><th scope="col" className="text-end">Change</th></tr></thead>
          <tbody>
            {history.events.map((event, i) => (
              <tr key={i}>
                <td className="small">{event.date ?? when(event.at)}</td>
                <td className="small">{describe(event)}</td>
                <td className="text-end">{event.change > 0 ? `+${event.change}` : event.change}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
