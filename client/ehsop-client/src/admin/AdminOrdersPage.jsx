import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../orders/bits.jsx'
import { orderNumber, placedOn, useOrdersQuery } from '../orders/ordersApi.js'
import { formatPrice } from '../products/formatPrice.js'

const PAGE_SIZE = 20
const FILTERS = [['', 'All'], ['CONFIRMED', 'Confirmed'], ['SHIPPED', 'Shipped'], ['DELIVERED', 'Delivered'], ['CANCELLED', 'Cancelled']]

export default function AdminOrdersPage() {
  const [status, setStatus] = useState('')
  const [term, setTerm] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, isFetching } = useOrdersQuery({ status, search, page })

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(term.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [term])

  const pages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1

  return (
    <section>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="h3 me-auto mb-0">Orders</h1>
        <label htmlFor="admin-order-search" className="visually-hidden">Search by customer email</label>
        <input id="admin-order-search" type="search" className="form-control w-auto" placeholder="Customer email"
          value={term} onChange={(e) => setTerm(e.target.value)} />
      </div>

      <div className="filter-pills mb-3" role="group" aria-label="Filter by status">
        {FILTERS.map(([value, label]) => (
          <button key={label} type="button" className="filter-pill" aria-pressed={status === value}
            onClick={() => { setStatus(value); setPage(1) }}>{label}</button>
        ))}
      </div>

      <div className="card p-2 table-responsive">
        <table className="table table-hover align-middle mb-0" aria-busy={isFetching}>
          <thead>
            <tr><th scope="col">Order</th><th scope="col">Placed</th><th scope="col">Customer</th><th scope="col">Delivery</th><th scope="col">Total</th><th scope="col">Status</th></tr>
          </thead>
          <tbody>
            {data?.results.map((o) => (
              <tr key={o.id}>
                <td><Link to={`/admin/orders/${o.id}`}>Order {orderNumber(o)}</Link></td>
                <td className="small">{placedOn.format(new Date(o.created_at))}</td>
                <td className="small">{o.customer}</td>
                <td className="small">{o.delivery_method === 'HOME_DELIVERY' ? 'Home Delivery' : `Pickup, ${o.pickup_point.city}`}</td>
                <td>{formatPrice(o.total_amount)}</td>
                <td><StatusBadge status={o.status} /></td>
              </tr>
            ))}
            {data?.count === 0 && <tr><td colSpan={6} className="text-center text-body-secondary py-4">No orders found.</td></tr>}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="d-flex justify-content-center align-items-center gap-3 mt-3" aria-label="Pagination">
          <button type="button" className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="small">Page {page} of {pages}</span>
          <button type="button" className="btn btn-outline-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </nav>
      )}
    </section>
  )
}
