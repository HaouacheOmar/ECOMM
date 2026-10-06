import { AnimatePresence, motion } from 'motion/react'
import { Link, useSearchParams } from 'react-router-dom'
import { useChatQueueQuery, useMyChatCustomersQuery } from '../chat/chatApi.js'
import ChatThread from '../chat/ChatThread.jsx'
import { StatusBadge } from '../orders/bits.jsx'
import OrderActions from '../orders/OrderActions.jsx'
import { orderNumber, placedOn, useOrdersQuery } from '../orders/ordersApi.js'
import { formatPrice } from '../products/formatPrice.js'
import '../chat/chat.css'

const waitingSince = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' })

function People({ title, people, empty, selected, onSelect, waiting }) {
  return (
    <section aria-labelledby={`${title}-title`}>
      <h2 id={`${title}-title`} className="h6 d-flex align-items-center gap-2">
        {title}
        {people.length > 0 && <span className="small text-body-secondary fw-normal">{people.length}</span>}
      </h2>
      {people.length === 0 && <p className="text-body-secondary small">{empty}</p>}
      <ul className="chat-people" aria-label={title}>
        <AnimatePresence initial={false}>
          {people.map((c) => (
            <motion.li key={c.id} layout="position" initial={{ opacity: 0, transform: 'translateX(-12px)' }}
              animate={{ opacity: 1, transform: 'translateX(0px)' }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: 'easeOut' }}>
              <button type="button" className="chat-person" aria-current={c.id === selected} onClick={() => onSelect(c.id)}>
                <span className="min-w-0">
                  <span className="d-block text-truncate fw-medium">{c.name}</span>
                  {waiting && <span className="d-block small text-body-secondary">Waiting since {waitingSince.format(new Date(c.queued_at))}</span>}
                </span>
                {c.unread > 0 && <span className="chat-unread" aria-label={`${c.unread} unread`}>{c.unread}</span>}
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  )
}

function CustomerOrders({ customerId }) {
  const { data } = useOrdersQuery({ customer: customerId })
  if (!data) return null
  if (data.count === 0) return <p className="text-body-secondary small mb-0">No orders yet.</p>
  return (
    <ul className="list-unstyled mb-0 d-grid gap-3">
      {data.results.map((o) => (
        <li key={o.id} className="pb-3 border-bottom">
          <div className="d-flex align-items-center gap-2">
            <Link to={`orders/${o.id}`} className="fw-medium">Order {orderNumber(o)}</Link>
            <span className="ms-auto"><StatusBadge status={o.status} /></span>
          </div>
          <div className="small text-body-secondary">{placedOn.format(new Date(o.created_at))} · {formatPrice(o.total_amount)}</div>
          <OrderActions order={o} small />
        </li>
      ))}
    </ul>
  )
}

// Queue + my Customers | conversation | that Customer's Orders. The selected Customer is in the URL.
export default function DeskHome() {
  const [params, setParams] = useSearchParams()
  const selected = params.get('customer')
  const { data: queue = [] } = useChatQueueQuery()
  const { data: mine = [] } = useMyChatCustomersQuery()
  const customer = [...queue, ...mine].find((c) => c.id === selected)
  const select = (id) => setParams({ customer: id })

  return (
    <div className="desk-panes">
      <section className="desk-pane surface" aria-label="Support Queue and my Customers">
        <People title="Support Queue" people={queue} empty="No Customers waiting." selected={selected} onSelect={select} waiting />
        <People title="My Customers" people={mine} empty="Customers you answer from the Queue appear here." selected={selected} onSelect={select} />
      </section>

      <section className="desk-pane surface" aria-label="Conversation">
        {selected ? (
          <>
            <header className="mb-2">
              <h2 className="h6 mb-0">{customer?.name ?? 'Customer'}</h2>
              {customer?.queued_at && <p className="small text-body-secondary mb-0">Waiting in the Support Queue: your reply claims them</p>}
              {customer && !customer.queued_at && customer.name !== customer.email && <p className="small text-body-secondary mb-0">{customer.email}</p>}
            </header>
            <ChatThread key={selected} customerId={selected} autoFocus />
          </>
        ) : (
          <p className="text-body-secondary m-auto">Select a Customer to start.</p>
        )}
      </section>

      <section className="desk-pane surface" aria-label="Customer's Orders">
        <h2 className="h6">Orders</h2>
        {selected ? <CustomerOrders customerId={selected} /> : <p className="text-body-secondary small mb-0">Nothing selected.</p>}
      </section>
    </div>
  )
}
