import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../products/formatPrice.js'
import { useRestocksQuery } from './stockApi.js'

const PAGE_SIZE = 20

export function RestockTable({ restocks, showSupplier = true }) {
  return (
    <table className="table table-hover align-middle mb-0">
      <thead>
        <tr>
          <th scope="col">Date</th>
          {showSupplier && <th scope="col">Supplier</th>}
          <th scope="col">Items</th><th scope="col">Total</th><th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {restocks.map((r) => (
          <tr key={r.id}>
            <td><Link to={`/admin/restocks/${r.id}`}>{r.date}</Link></td>
            {showSupplier && <td>{r.supplier.name}</td>}
            <td>{r.lines.reduce((n, line) => n + line.quantity, 0)}</td>
            <td>{formatPrice(r.total)}</td>
            <td>{r.cancelled_at ? <span className="badge-out">Cancelled</span> : <span className="small">Recorded</span>}</td>
          </tr>
        ))}
        {restocks.length === 0 && <tr><td colSpan={showSupplier ? 5 : 4} className="text-center text-body-secondary py-4">No restocks.</td></tr>}
      </tbody>
    </table>
  )
}

export default function RestocksPage() {
  const [month, setMonth] = useState('')
  const [page, setPage] = useState(1)
  const { data, isFetching } = useRestocksQuery({ month, page })
  const pages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1

  return (
    <section>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="h3 me-auto mb-0">Restocks</h1>
        <label htmlFor="restock-month" className="visually-hidden">Month</label>
        <input id="restock-month" type="month" className="form-control w-auto" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1) }} />
        <Link to="/admin/restocks/new" className="btn btn-primary d-inline-flex align-items-center gap-1"><Plus size={18} aria-hidden /> New restock</Link>
      </div>
      <div className="card p-2" aria-busy={isFetching}>
        {data && <RestockTable restocks={data.results} />}
      </div>
      {pages > 1 && (
        <nav className="d-flex align-items-center gap-2 mt-3" aria-label="Restock pages">
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="small">Page {page} of {pages}</span>
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button>
        </nav>
      )}
    </section>
  )
}
