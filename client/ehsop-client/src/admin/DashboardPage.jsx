import { Radio } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../orders/bits.jsx'
import { orderNumber, placedOn, useOrdersQuery } from '../orders/ordersApi.js'
import { formatPrice } from '../products/formatPrice.js'

const FEED_SIZE = 10

// The Admin's at-a-glance view. The Order feed is the first page of Orders, kept live by the
// orders socket: new Orders slide in at the top, status changes update in place.
export default function DashboardPage() {
  const { data, isLoading } = useOrdersQuery({ page: 1 })
  const feed = data?.results.slice(0, FEED_SIZE) ?? []
  const latest = feed[0]

  return (
    <section style={{ maxWidth: 960 }}>
      <h1 className="h3 mb-3">Dashboard</h1>
      <section className="card p-3" aria-labelledby="feed-title">
        <div className="d-flex align-items-center gap-2 mb-2">
          <h2 id="feed-title" className="h6 mb-0">Live orders</h2>
          <span className="live-dot" aria-hidden><Radio size={14} /></span>
          <Link to="orders" className="small ms-auto">All orders</Link>
        </div>
        {/* One announcement per new Order for screen readers. */}
        <p role="status" className="visually-hidden">{latest ? `Latest order ${orderNumber(latest)} from ${latest.customer}` : ''}</p>
        {!isLoading && feed.length === 0 && <p className="text-body-secondary small mb-0">No orders yet. New ones appear here as they arrive.</p>}
        <ul className="live-feed" aria-label="Order feed">
          <AnimatePresence initial={false}>
            {feed.map((o) => (
              <motion.li key={o.id} layout="position" className="live-feed-row"
                initial={{ opacity: 0, transform: 'translateY(-12px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.25, ease: 'easeOut' }}>
                <Link to={`orders/${o.id}`} className="fw-medium">Order {orderNumber(o)}</Link>
                <span className="small text-body-secondary text-truncate">{o.customer}</span>
                <span className="small text-body-secondary d-none d-md-inline">{placedOn.format(new Date(o.created_at))}</span>
                <span className="ms-auto">{formatPrice(o.total_amount)}</span>
                <StatusBadge status={o.status} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>
    </section>
  )
}
