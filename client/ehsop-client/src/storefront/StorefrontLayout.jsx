import { House, LayoutGrid, LogIn, Package, ShoppingBag } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, NavLink, useLocation } from 'react-router-dom'
import AnimatedOutlet from '../AnimatedOutlet.jsx'
import VerifyEmailBanner from '../auth/VerifyEmailBanner.jsx'
import CartDrawer from '../cart/CartDrawer.jsx'
import { CartDrawerContext } from '../cart/CartDrawerContext.js'
import useCart from '../cart/useCart.js'
import ChatBubble from '../chat/ChatBubble.jsx'
import ChatProvider from '../chat/ChatProvider.jsx'
import useLiveOrders from '../orders/useLiveOrders.js'
import { useCategoriesQuery } from '../products/productsApi.js'
import IconRail, { RailAvatar, RailLink } from '../shell/Rail.jsx'
import SearchBar from './SearchBar.jsx'
import './storefront.css'

function CartButton({ onClick }) {
  const { count } = useCart()
  const label = `${count} item${count === 1 ? '' : 's'} in cart`
  return (
    <>
      <button type="button" className="rail-item" aria-label={`Cart, ${label}`} title="Cart" onClick={onClick}>
        <ShoppingBag size={24} strokeWidth={1.75} aria-hidden />
        {count > 0 && <span className="cart-count" aria-hidden>{count}</span>}
      </button>
      {/* One announcement when the count changes, e.g. "3 items in cart". */}
      <span role="status" aria-atomic="true" className="visually-hidden">{label}</span>
    </>
  )
}

// The reference's dark band at the foot of the page, with columns of links.
function Footer() {
  const { data: categories = [] } = useCategoriesQuery()
  return (
    <footer className="shop-footer">
      <div className="container-xl">
        <div className="footer-columns">
          <div>
            <Link to="/" className="wordmark footer-mark">eshop</Link>
            <p className="footer-note">Home and lifestyle goods, made to last. Free delivery and cash on delivery across Algeria.</p>
          </div>
          <nav aria-label="Shop by category">
            <h2 className="footer-title">Shop</h2>
            <ul>
              <li><Link to="/products">All products</Link></li>
              {categories.map((c) => <li key={c.id}><Link to={`/products?category=${c.id}`}>{c.name}</Link></li>)}
            </ul>
          </nav>
          <nav aria-label="Your account">
            <h2 className="footer-title">Your account</h2>
            <ul>
              <li><Link to="/orders">My Orders</Link></li>
              <li><Link to="/account">Account</Link></li>
              <li><Link to="/forgot">Forgot your password?</Link></li>
            </ul>
          </nav>
          <div>
            <h2 className="footer-title">Delivery</h2>
            <ul>
              <li>Home Delivery to your address</li>
              <li>Pickup Points in Algiers, Oran, Constantine and Annaba</li>
              <li>Cash on delivery, no delivery fee</li>
            </ul>
          </div>
        </div>
        <p className="footer-legal">
          © 2026 eshop · A portfolio project · Product photos from <a href="https://unsplash.com" target="_blank" rel="noreferrer">Unsplash</a>
        </p>
      </div>
    </footer>
  )
}

export default function StorefrontLayout() {
  const signedIn = useSelector((state) => state.auth.status === 'authenticated')
  const isCustomer = useSelector((state) => state.auth.user?.role === 'CUSTOMER')
  const onHome = useLocation().pathname === '/'
  useLiveOrders() // a Customer's My Orders follows Shipped/Delivered live
  const [cartOpen, setCartOpen] = useState(false)
  const open = useCallback(() => setCartOpen(true), [])
  const close = useCallback(() => setCartOpen(false), [])
  const drawer = useMemo(() => ({ open, close }), [open, close])

  const account = signedIn
    ? <RailAvatar to="/account" />
    : <NavLink to="/login" className="rail-item" aria-label="Log in" title="Log in"><LogIn size={24} strokeWidth={1.75} aria-hidden /></NavLink>

  return (
    <CartDrawerContext.Provider value={drawer}>
      <div className="app-shell">
        <IconRail label="Shop" home="/" account={account}>
          <RailLink to="/" end label="Home" Icon={House} />
          <RailLink to="/products" label="All products" Icon={LayoutGrid} />
          <RailLink to="/orders" label="My Orders" Icon={Package} />
          <CartButton onClick={open} />
        </IconRail>
        <div className="app-main">
          {/* The home page's hero carries the search; everywhere else it sits on top. */}
          {!onHome && (
            <header className="shop-topbar">
              <div className="container-xl"><SearchBar /></div>
            </header>
          )}
          <VerifyEmailBanner />
          <main className="container-xl shop-content">
            <AnimatedOutlet />
          </main>
          <Footer />
        </div>
      </div>
      <CartDrawer isOpen={cartOpen} onClose={close} />
      {isCustomer && <ChatProvider><ChatBubble /></ChatProvider>}
    </CartDrawerContext.Provider>
  )
}
