import { Home, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import useCart, { unavailableNote } from '../cart/useCart.js'
import { ProductImage } from '../products/bits.jsx'
import { formatPrice } from '../products/formatPrice.js'
import { useCheckoutMutation, usePickupPointsQuery } from './ordersApi.js'
import './orders.css'

const METHODS = [
  { value: 'PICKUP_POINT', label: 'Pickup Point', hint: 'Collect it from one of our offices', Icon: MapPin },
  { value: 'HOME_DELIVERY', label: 'Home Delivery', hint: 'Delivered to your address', Icon: Home },
]

function checkoutError(error) {
  if (!error) return null
  if (error.data?.code === 'out_of_stock') return 'Some items sold out while you were shopping. They are marked below: remove or reduce them to continue.'
  if (error.data?.delivery_address || error.data?.pickup_point) return null // shown next to the field
  return error.data?.detail ?? 'Could not place your order. Please try again.'
}

export default function CheckoutPage() {
  const cart = useCart()
  const verified = useSelector((state) => state.auth.user?.is_email_verified)
  const { data: points = [] } = usePickupPointsQuery()
  const [checkout, { isLoading, error }] = useCheckoutMutation()
  const navigate = useNavigate()
  const [form, setForm] = useState({ delivery_method: 'PICKUP_POINT', pickup_point: '', delivery_address: '' })
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  if (cart.items.length === 0) {
    return (
      <section className="text-center py-5">
        <h1 className="h3">Your cart is empty</h1>
        <Link to="/products" className="btn btn-primary mt-3">Browse products</Link>
      </section>
    )
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const { delivery_method, pickup_point, delivery_address } = form
    const { data } = await checkout(delivery_method === 'PICKUP_POINT' ? { delivery_method, pickup_point: pickup_point || null } : { delivery_method, delivery_address })
    if (data) navigate('/orders', { replace: true, state: { placed: data.id } })
  }

  const pickup = form.delivery_method === 'PICKUP_POINT'
  const fieldError = error?.data?.[pickup ? 'pickup_point' : 'delivery_address']?.[0]
  const general = checkoutError(error)

  return (
    <form className="checkout row g-4" onSubmit={onSubmit} noValidate>
      <h1 className="h3 col-12 mb-0">Checkout</h1>

      <div className="col-lg-7">
        <fieldset className="card p-4">
          <legend className="h5 mb-3">Delivery</legend>
          <div className="method-options mb-3">
            {METHODS.map(({ value, label, hint, Icon }) => (
              <label key={value} className="method-option">
                <input type="radio" name="delivery_method" value={value} checked={form.delivery_method === value} onChange={onChange} />
                <Icon size={20} aria-hidden />
                <span>
                  <span className="d-block fw-medium">{label}</span>
                  <span className="d-block small text-body-secondary">{hint}</span>
                </span>
              </label>
            ))}
          </div>

          {pickup ? (
            <div>
              <label htmlFor="pickup-point" className="form-label">Pickup Point</label>
              <select id="pickup-point" name="pickup_point" className={`form-select${fieldError ? ' is-invalid' : ''}`} required
                value={form.pickup_point} onChange={onChange} aria-describedby={fieldError ? 'pickup-point-error' : undefined}>
                <option value="">Choose an office…</option>
                {points.map((p) => <option key={p.id} value={p.id}>{p.city}: {p.name}, {p.address}</option>)}
              </select>
              {fieldError && <div id="pickup-point-error" className="text-danger small mt-1">{fieldError}</div>}
            </div>
          ) : (
            <div>
              <label htmlFor="delivery-address" className="form-label">Delivery address</label>
              <textarea id="delivery-address" name="delivery_address" rows={3} autoComplete="street-address" required
                className={`form-control${fieldError ? ' is-invalid' : ''}`} value={form.delivery_address} onChange={onChange}
                aria-describedby={fieldError ? 'delivery-address-error' : undefined} />
              {fieldError && <div id="delivery-address-error" className="text-danger small mt-1">{fieldError}</div>}
            </div>
          )}
        </fieldset>
      </div>

      <div className="col-lg-5">
        <section className="card p-4" aria-labelledby="summary-title">
          <h2 id="summary-title" className="h5 mb-3">Order summary</h2>
          <ul className="cart-lines">
            {cart.items.map((line) => (
              <li key={line.product.id} className="cart-line">
                <div className="cart-thumb"><ProductImage src={line.product.image} alt="" /></div>
                <div className="flex-grow-1 min-w-0">
                  <div className="d-flex justify-content-between gap-2">
                    <span className="fw-medium">{line.product.name}</span>
                    <span>{formatPrice(line.product.price * line.quantity)}</span>
                  </div>
                  <div className="small text-body-secondary">{line.quantity} × {formatPrice(line.product.price)}</div>
                  {!line.available && <p className="cart-unavailable" role="note">{unavailableNote(line)}</p>}
                </div>
              </li>
            ))}
          </ul>
          <dl className="checkout-totals">
            <dt>Delivery</dt><dd>Free</dd>
            <dt>Payment</dt><dd>Cash on delivery</dd>
            <dt className="fw-semibold">Total</dt><dd className="fw-semibold">{formatPrice(cart.subtotal)}</dd>
          </dl>

          {!verified && <p className="small text-body-secondary">Verify your email to confirm your order. Check your inbox for the link.</p>}
          {general && <div role="alert" className="text-danger small mb-3">{general}</div>}
          <button type="submit" className="btn btn-primary w-100" disabled={!verified || !cart.canCheckout || isLoading}>
            {isLoading ? 'Placing order…' : 'Confirm order'}
          </button>
          {!cart.canCheckout && <p className="small text-body-secondary mt-2 mb-0">Fix the items marked above to continue.</p>}
        </section>
      </div>
    </form>
  )
}
