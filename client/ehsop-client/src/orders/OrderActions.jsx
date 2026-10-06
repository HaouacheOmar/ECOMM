import { PackageCheck, Truck, XCircle } from 'lucide-react'
import { orderNumber, useMoveOrderMutation } from './ordersApi.js'

// The moves each status allows: Confirmed -> Shipped -> Delivered, or Confirmed -> Cancelled.
const MOVES = {
  CONFIRMED: [['ship', 'Mark as shipped', Truck, 'btn-primary'], ['cancel', 'Cancel order', XCircle, 'btn-outline-danger']],
  SHIPPED: [['deliver', 'Mark as delivered', PackageCheck, 'btn-primary']],
}

// Staff buttons for an Order's next status (none once Delivered or Cancelled).
export default function OrderActions({ order, small }) {
  const [move, moving] = useMoveOrderMutation()
  if (!MOVES[order.status]) return null

  const onMove = (name) => {
    if (name !== 'cancel' || window.confirm(`Cancel Order ${orderNumber(order)}? Its items go back on sale.`)) move({ id: order.id, move: name })
  }

  return (
    <>
      <div className={`d-flex flex-wrap gap-2 ${small ? 'mt-2' : 'mt-3'}`}>
        {MOVES[order.status].map(([name, label, Icon, style]) => (
          <button key={name} type="button" className={`btn ${style} d-inline-flex align-items-center gap-1${small ? ' btn-sm' : ''}`}
            disabled={moving.isLoading} onClick={() => onMove(name)}>
            <Icon size={small ? 16 : 18} aria-hidden /> {label}
          </button>
        ))}
      </div>
      {moving.error && <div role="alert" className="text-danger small mt-2">{moving.error.data?.detail ?? 'Could not update this order.'}</div>}
    </>
  )
}
