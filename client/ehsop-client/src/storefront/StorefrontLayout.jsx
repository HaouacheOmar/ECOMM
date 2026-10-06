import { LogIn, Package, ShoppingBag, User } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import AnimatedOutlet from '../AnimatedOutlet.jsx'
import LogoutButton from '../auth/LogoutButton.jsx'
import VerifyEmailBanner from '../auth/VerifyEmailBanner.jsx'
import CartDrawer from '../cart/CartDrawer.jsx'
import ChatBubble from '../chat/ChatBubble.jsx'
import ChatProvider from '../chat/ChatProvider.jsx'
import { CartDrawerContext } from '../cart/CartDrawerContext.js'
import useCart from '../cart/useCart.js'
import useLiveOrders from '../orders/useLiveOrders.js'
import ThemeToggle from '../theme/ThemeToggle.jsx'
import SearchBar from './SearchBar.jsx'
import './storefront.css'

function CartButton({ onClick }) {
  const { count } = useCart()
  const label = `${count} item${count === 1 ? '' : 's'} in cart`
  return (
    <>
      <button type="button" className="icon-btn position-relative" aria-label={`Cart, ${label}`} title="Cart" onClick={onClick}>
        <ShoppingBag size={20} aria-hidden />
        {count > 0 && <span className="cart-count" aria-hidden>{count}</span>}
      </button>
      {/* One announcement when the count changes, e.g. "3 items in cart". */}
      <span role="status" aria-atomic="true" className="visually-hidden">{label}</span>
    </>
  )
}

export default function StorefrontLayout() {
  const signedIn = useSelector((state) => state.auth.status === 'authenticated')
  const isCustomer = useSelector((state) => state.auth.user?.role === 'CUSTOMER')
  useLiveOrders() // a Customer's My Orders follows Shipped/Delivered live
  const [cartOpen, setCartOpen] = useState(false)
  const open = useCallback(() => setCartOpen(true), [])
  const close = useCallback(() => setCartOpen(false), [])
  const drawer = useMemo(() => ({ open, close }), [open, close])

  return (
    <CartDrawerContext.Provider value={drawer}>
      <header className="storefront-header surface">
        <div className="container-xl d-flex align-items-center gap-3 py-2">
          <Link to="/" className="wordmark">eshop</Link>
          <SearchBar />
          <nav className="d-flex align-items-center" aria-label="Account">
            <Link to="/orders" className="icon-btn" aria-label="My Orders" title="My Orders"><Package size={20} aria-hidden /></Link>
            {signedIn
              ? <Link to="/account" className="icon-btn" aria-label="Account" title="Account"><User size={20} aria-hidden /></Link>
              : <Link to="/login" className="icon-btn" aria-label="Log in" title="Log in"><LogIn size={20} aria-hidden /></Link>}
            <CartButton onClick={open} />
            <ThemeToggle />
            {signedIn && <LogoutButton />}
          </nav>
        </div>
        <VerifyEmailBanner />
      </header>
      <main className="container-xl py-4">
        <AnimatedOutlet />
      </main>
      <CartDrawer isOpen={cartOpen} onClose={close} />
      {isCustomer && <ChatProvider><ChatBubble /></ChatProvider>}
    </CartDrawerContext.Provider>
  )
}
