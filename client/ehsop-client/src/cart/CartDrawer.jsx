import { Minus, Plus, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ProductImage } from '../products/bits.jsx'
import { formatPrice } from '../products/formatPrice.js'
import useCart from './useCart.js'
import './cart.css'

function unavailableNote({ product }) {
  if (product.stock === 0) return 'Sold out. Remove it to continue.'
  return `Only ${product.stock} left. Reduce the quantity to ${product.stock} to continue.`
}

function CartLine({ line, onNavigate }) {
  const { setQuantity, remove } = useCart()
  const { product, quantity, available } = line
  return (
    <li className="cart-line">
      <div className="cart-thumb"><ProductImage src={product.image} alt="" /></div>
      <div className="flex-grow-1 min-w-0">
        <Link to={`/products/${product.id}`} className="cart-name" onClick={onNavigate}>{product.name}</Link>
        <div className="small text-body-secondary">{formatPrice(product.price)}</div>
        <div className="d-flex align-items-center gap-1 mt-1">
          <button type="button" className="icon-btn icon-btn-sm" aria-label={`Decrease quantity of ${product.name}`}
            disabled={quantity <= 1} onClick={() => setQuantity(product, quantity - 1)}><Minus size={16} aria-hidden /></button>
          <span className="cart-qty" aria-label={`Quantity ${quantity}`}>{quantity}</span>
          <button type="button" className="icon-btn icon-btn-sm" aria-label={`Increase quantity of ${product.name}`}
            disabled={quantity >= product.stock} onClick={() => setQuantity(product, quantity + 1)}><Plus size={16} aria-hidden /></button>
          <button type="button" className="icon-btn icon-btn-sm ms-auto" aria-label={`Remove ${product.name}`}
            onClick={() => remove(product)}><Trash2 size={16} aria-hidden /></button>
        </div>
        {!available && <p className="cart-unavailable" role="note">{unavailableNote(line)}</p>}
      </div>
    </li>
  )
}

export default function CartDrawer({ isOpen, onClose }) {
  const cart = useCart()
  const closeButton = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const opener = document.activeElement
    closeButton.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      opener?.focus?.()
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="drawer-backdrop" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} />
          <motion.aside
            className="cart-drawer surface"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            initial={{ transform: 'translateX(100%)' }}
            animate={{ transform: 'translateX(0%)', transition: { type: 'spring', bounce: 0.2, visualDuration: 0.35 } }}
            exit={{ transform: 'translateX(100%)', transition: { duration: 0.18, ease: 'easeIn' } }}
          >
            <header className="d-flex align-items-center mb-3">
              <h2 id="cart-title" className="h5 mb-0 me-auto">Your cart</h2>
              <button ref={closeButton} type="button" className="icon-btn" aria-label="Close cart" onClick={onClose}><X size={20} aria-hidden /></button>
            </header>

            {cart.items.length === 0 ? (
              <p className="text-body-secondary my-auto text-center">Your cart is empty.</p>
            ) : (
              <ul className="cart-lines">
                {cart.items.map((line) => <CartLine key={line.product.id} line={line} onNavigate={onClose} />)}
              </ul>
            )}

            <footer className="cart-footer">
              <div className="d-flex justify-content-between mb-3">
                <span>Subtotal</span>
                <span className="fw-semibold">{formatPrice(cart.subtotal)}</span>
              </div>
              {cart.canCheckout
                ? <Link to="/checkout" className="btn btn-primary w-100" onClick={onClose}>Checkout</Link>
                : <button type="button" className="btn btn-primary w-100" disabled>Checkout</button>}
              {cart.items.length > 0 && !cart.canCheckout && (
                <p className="small text-body-secondary mt-2 mb-0">Fix the items marked above to check out.</p>
              )}
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
