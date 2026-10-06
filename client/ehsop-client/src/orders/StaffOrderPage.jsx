import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Delivery, StatusBadge } from './bits.jsx'
import OrderActions from './OrderActions.jsx'
import { orderNumber, placedOn, useOrderQuery } from './ordersApi.js'
import { ProductImage } from '../products/bits.jsx'
import { formatPrice } from '../products/formatPrice.js'
import '../cart/cart.css'
import '../products/products.css'

// One Order for the Admin and Employees, with the moves its status allows.
export default function StaffOrderPage() {
  const { id } = useParams()
  const { data: order, error } = useOrderQuery(id)

  if (error) return <p role="alert" className="text-danger">This order could not be found.</p>
  if (!order) return null

  const title = `Order ${orderNumber(order)}`

  return (
    <section style={{ maxWidth: 820 }}>
      <Link to=".." relative="path" className="d-inline-flex align-items-center gap-1 small mb-2"><ArrowLeft size={16} aria-hidden /> All orders</Link>
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
            <OrderActions order={order} />
          </section>
        </div>
      </div>
    </section>
  )
}
