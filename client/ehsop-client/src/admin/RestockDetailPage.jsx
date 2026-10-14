import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatPrice } from '../products/formatPrice.js'
import { detailError } from './catalogApi.js'
import { useCancelRestockMutation, useRestockQuery } from './stockApi.js'

export default function RestockDetailPage() {
  const { id } = useParams()
  const { data: restock, isLoading, isError } = useRestockQuery(id)
  const [cancel, cancelling] = useCancelRestockMutation()
  const [confirming, setConfirming] = useState(false)

  if (isLoading) return <p className="text-body-secondary">Loading…</p>
  if (isError) return <p>Restock not found. <Link to="/admin/restocks">Back to restocks</Link></p>

  return (
    <section style={{ maxWidth: 820 }}>
      <Link to="/admin/restocks" className="d-inline-flex align-items-center gap-1 mb-3 text-body-secondary text-decoration-none">
        <ArrowLeft size={16} aria-hidden /> Restocks
      </Link>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="h3 me-auto mb-0">Restock from {restock.supplier.name}</h1>
        {restock.cancelled_at && <span className="badge-out">Cancelled</span>}
      </div>
      <div className="card p-4">
        <p className="mb-3">
          {restock.date} · <Link to={`/admin/suppliers/${restock.supplier.id}`}>{restock.supplier.name}</Link>
          {restock.note && <span className="d-block small text-body-secondary mt-1">{restock.note}</span>}
        </p>
        <table className="table align-middle">
          <thead><tr><th scope="col">Product</th><th scope="col">Quantity</th><th scope="col">Unit cost</th><th scope="col">Line total</th></tr></thead>
          <tbody>
            {restock.lines.map((line) => (
              <tr key={line.product.id}>
                <td><Link to={`/admin/products/${line.product.id}`}>{line.product.name}</Link></td>
                <td>{line.quantity}</td>
                <td>{formatPrice(line.unit_cost)}</td>
                <td>{formatPrice(line.quantity * line.unit_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="d-flex flex-wrap align-items-center gap-3">
          <span>Total <strong>{formatPrice(restock.total)}</strong></span>
          {!restock.cancelled_at && !confirming && (
            <button type="button" className="btn btn-outline-secondary ms-auto" onClick={() => setConfirming(true)}>Cancel restock</button>
          )}
          {confirming && !restock.cancelled_at && (
            <div className="ms-auto d-flex flex-wrap align-items-center gap-2">
              <span className="small">Remove this stock and its spending?</span>
              <button type="button" className="btn btn-danger btn-sm" disabled={cancelling.isLoading} onClick={() => cancel(restock.id)}>Yes, cancel it</button>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setConfirming(false)}>Keep it</button>
            </div>
          )}
        </div>
        {cancelling.error && (
          <div role="alert" className="text-danger small mt-2">
            {cancelling.error.data?.code === 'not_enough_stock' ? 'Some of this stock has already been sold, so it can no longer be cancelled. Use a stock correction instead.' : detailError(cancelling.error)}
          </div>
        )}
      </div>
    </section>
  )
}
