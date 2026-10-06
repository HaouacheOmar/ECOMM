import { Radio } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../orders/bits.jsx'
import { orderNumber, placedOn, useOrdersQuery } from '../orders/ordersApi.js'
import { formatPrice } from '../products/formatPrice.js'
import { useEmployeeSessionsQuery, useEmployeesQuery } from './employeesApi.js'
import Presence from './Presence.jsx'

const FEED_SIZE = 10
const at = new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short' })

// Active Employees, Online first; updates live through the activity socket.
function Staff() {
  const { data } = useEmployeesQuery(1)
  const staff = (data?.results ?? []).filter((e) => e.is_active).sort((a, b) => b.is_online - a.is_online)
  const online = staff.filter((e) => e.is_online).length
  return (
    <section className="card p-3" aria-labelledby="staff-title">
      <div className="d-flex align-items-center mb-2">
        <h2 id="staff-title" className="h6 mb-0">Staff</h2>
        <span className="small text-body-secondary ms-2">{online} online</span>
        <Link to="employees" className="small ms-auto">Manage</Link>
      </div>
      {staff.length === 0 && <p className="text-body-secondary small mb-0">No employees yet.</p>}
      <ul className="list-unstyled mb-0" aria-label="Staff presence">
        {staff.map((e) => (
          <li key={e.id} className="d-flex align-items-center gap-2 py-1">
            <span className="text-truncate">{[e.first_name, e.last_name].filter(Boolean).join(' ') || e.email}</span>
            <span className="ms-auto"><Presence online={e.is_online} /></span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RecentActivity() {
  const { data } = useEmployeeSessionsQuery({ page: 1 })
  const sessions = data?.results.slice(0, 5) ?? []
  return (
    <section className="card p-3" aria-labelledby="activity-title">
      <div className="d-flex align-items-center mb-2">
        <h2 id="activity-title" className="h6 mb-0">Recent activity</h2>
        <Link to="activity" className="small ms-auto">Activity log</Link>
      </div>
      {sessions.length === 0 && <p className="text-body-secondary small mb-0">No sessions yet.</p>}
      <ul className="list-unstyled mb-0 small" aria-label="Recent sessions">
        {sessions.map((s) => (
          <li key={s.id} className="py-1">
            <span className="fw-medium">{s.employee.name || s.employee.email}</span>{' '}
            {s.logout_at ? `logged out ${at.format(new Date(s.logout_at))}` : `logged in ${at.format(new Date(s.login_at))}`}
          </li>
        ))}
      </ul>
    </section>
  )
}

// The Admin's at-a-glance view. The Order feed is the first page of Orders, kept live by the
// orders socket: new Orders slide in at the top, status changes update in place.
export default function DashboardPage() {
  const { data, isLoading } = useOrdersQuery({ page: 1 })
  const feed = data?.results.slice(0, FEED_SIZE) ?? []
  const latest = feed[0]

  return (
    <section style={{ maxWidth: 1200 }}>
      <h1 className="h3 mb-3">Dashboard</h1>
      <div className="row g-3 align-items-start">
        <section className="col-lg-8" aria-labelledby="feed-title">
          <div className="card p-3">
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
          </div>
        </section>
        <div className="col-lg-4 d-grid gap-3">
          <Staff />
          <RecentActivity />
        </div>
      </div>
    </section>
  )
}
