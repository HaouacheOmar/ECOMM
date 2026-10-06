import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ProductImage } from '../products/bits.jsx'
import { formatPrice } from '../products/formatPrice.js'
import { StatusBadge } from './bits.jsx'
import { orderNumber, useCancelOrderMutation, useOrdersQuery } from './ordersApi.js'
import './orders.css'

const PAGE_SIZE = 20
const placedOn = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

function Delivery({ order }) {
  if (order.delivery_method === 'HOME_DELIVERY') return <>Home Delivery to {order.delivery_address}</>
  const p = order.pickup_point
  return <>Pickup Point: {p.name}, {p.address}, {p.city}</>
}

function OrderCard({ order, initiallyOpen }) {
  const [open, setOpen] = useState(initiallyOpen)
  const [cancel, cancelled] = useCancelOrderMutation()
  const units = order.items.reduce((n, i) => n + i.quantity, 0)
  const title = `Order ${orderNumber(order)}`

  const onCancel = () => {
    if (window.confirm(`Cancel ${title}? Its items go back on sale.`)) cancel(order.id)
  }

  return (
    <motion.li className="card order-card" layout="position" initial={{ opacity: 0, transform: 'translateY(8px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }} aria-label={title}>
      <button type="button" className="order-summary" aria-expanded={open} aria-controls={`order-${order.id}`} onClick={() => setOpen(!open)}>
        <span className="flex-grow-1">
          <span className="d-block fw-semibold">{title}</span>
          <span className="d-block small text-body-secondary">
            {placedOn.format(new Date(order.created_at))} · {units} item{units === 1 ? '' : 's'}
          </span>
        </span>
        <StatusBadge status={order.status} />
        <span className="fw-semibold order-total">{formatPrice(order.total_amount)}</span>
        <ChevronDown size={18} aria-hidden className={`order-chevron${open ? ' open' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={`order-${order.id}`} className="order-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}>
            <ul className="cart-lines">
              {order.items.map((item) => (
                <li key={item.product.id} className="cart-line">
                  <div className="cart-thumb"><ProductImage src={item.product.image} alt="" /></div>
                  <div className="flex-grow-1 d-flex justify-content-between gap-2">
                    <span>
                      <Link to={`/products/${item.product.id}`} className="cart-name">{item.product.name}</Link>
                      <span className="d-block small text-body-secondary">{item.quantity} × {formatPrice(item.price_at_purchase)}</span>
                    </span>
                    <span>{formatPrice(item.price_at_purchase * item.quantity)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="small mt-3 mb-1"><Delivery order={order} /></p>
            <p className="small text-body-secondary mb-0">Cash on delivery · free delivery</p>
            {order.status === 'CONFIRMED' && (
              <button type="button" className="btn btn-outline-danger btn-sm mt-3" disabled={cancelled.isLoading} onClick={onCancel}>
                Cancel order
              </button>
            )}
            {cancelled.error && <div role="alert" className="text-danger small mt-2">{cancelled.error.data?.detail ?? 'Could not cancel this order.'}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

export default function MyOrdersPage() {
  const placed = useLocation().state?.placed
  const [page, setPage] = useState(1)
  const { data, isLoading } = useOrdersQuery(page)
  const pages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1

  return (
    <section className="mx-auto" style={{ maxWidth: 760 }}>
      <h1 className="h3 mb-3">My Orders</h1>
      {placed && <p role="status" className="order-placed">Order placed. A confirmation email is on its way.</p>}
      {!isLoading && data?.count === 0 && (
        <div className="text-center py-5">
          <p className="text-body-secondary">You haven't placed any orders yet.</p>
          <Link to="/products" className="btn btn-primary">Start shopping</Link>
        </div>
      )}
      <ul className="order-list">
        {data?.results.map((order) => <OrderCard key={order.id} order={order} initiallyOpen={order.id === placed} />)}
      </ul>
      {pages > 1 && (
        <nav className="d-flex justify-content-center align-items-center gap-3 mt-4" aria-label="Pagination">
          <button type="button" className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="small">Page {page} of {pages}</span>
          <button type="button" className="btn btn-outline-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </nav>
      )}
    </section>
  )
}
