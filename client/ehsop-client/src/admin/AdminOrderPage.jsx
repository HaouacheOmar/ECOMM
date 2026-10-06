import { ArrowLeft, PackageCheck, Truck, XCircle } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Delivery, StatusBadge } from '../orders/bits.jsx'
import { orderNumber, placedOn, useMoveOrderMutation, useOrderQuery } from '../orders/ordersApi.js'
import { ProductImage } from '../products/bits.jsx'
import { formatPrice } from '../products/formatPrice.js'
import '../cart/cart.css'
import '../products/products.css'

// The moves each status allows: Confirmed -> Shipped -> Delivered, or Confirmed -> Cancelled.
const MOVES = {
  CONFIRMED: [['ship', 'Mark as shipped', Truck, 'btn-primary'], ['cancel', 'Cancel order', XCircle, 'btn-outline-danger']],
  SHIPPED: [['deliver', 'Mark as delivered', PackageCheck, 'btn-primary']],
}

export default function AdminOrderPage() {
  const { id } = useParams()
  const { data: order, error } = useOrderQuery(id)
  const [move, moving] = useMoveOrderMutation()

  if (error) return <p role="alert" className="text-danger">This order could not be found.</p>
  if (!order) return null

  const title = `Order ${orderNumber(order)}`
  const onMove = (name) => {
    if (name !== 'cancel' || window.confirm(`Cancel ${title}? Its items go back on sale.`)) move({ id: order.id, move: name })
  }

  return (
    <section style={{ maxWidth: 820 }}>
      <Link to="/admin/orders" className="d-inline-flex align-items-center gap-1 small mb-2"><ArrowLeft size={16} aria-hidden /> All orders</Link>
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <h1 className="h3 mb-0">{title}</h1>
        <StatusBadge status={order.status} />
      </div>

      <div className="row g-3">
        <div className="col-md-7">
          <section className="card p-4 h-100" aria-labelledby="items-title">
            <h2 id="items-title" className="h6">Items</h2>
            <ul className="cart-lines">
              {order.items.map((item) => (
                <li key={item.product.id} className="cart-line">
                  <div className="cart-thumb"><ProductImage src={item.product.image} alt="" /></div>
                  <div className="flex-grow-1 d-flex justify-content-between gap-2">
                    <span>
                      <span className="fw-medium">{item.product.name}</span>
                      <span className="d-block small text-body-secondary">{item.quantity} × {formatPrice(item.price_at_purchase)}</span>
                    </span>
                    <span>{formatPrice(item.price_at_purchase * item.quantity)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="d-flex justify-content-between fw-semibold mt-3"><span>Total, cash on delivery</span><span>{formatPrice(order.total_amount)}</span></div>
          </section>
        </div>

        <div className="col-md-5">
          <section className="card p-4 h-100" aria-labelledby="details-title">
            <h2 id="details-title" className="h6">Details</h2>
            <dl className="small mb-0">
              <dt>Customer</dt><dd>{order.customer}</dd>
              <dt>Placed</dt><dd>{placedOn.format(new Date(order.created_at))}</dd>
              <dt>Delivery</dt><dd><Delivery order={order} /></dd>
            </dl>
            {MOVES[order.status] && (
              <div className="d-flex flex-wrap gap-2 mt-3">
                {MOVES[order.status].map(([name, label, Icon, style]) => (
                  <button key={name} type="button" className={`btn ${style} d-inline-flex align-items-center gap-1`}
                    disabled={moving.isLoading} onClick={() => onMove(name)}>
                    <Icon size={18} aria-hidden /> {label}
                  </button>
                ))}
              </div>
            )}
            {moving.error && <div role="alert" className="text-danger small mt-2">{moving.error.data?.detail ?? 'Could not update this order.'}</div>}
          </section>
        </div>
      </div>
    </section>
  )
}
