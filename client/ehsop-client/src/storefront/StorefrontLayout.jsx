import { ArrowRight, LogIn, Package, ShoppingBag, User } from 'lucide-react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import AnimatedOutlet from '../AnimatedOutlet.jsx'
import LogoutButton from '../auth/LogoutButton.jsx'
import ThemeToggle from '../theme/ThemeToggle.jsx'
import './storefront.css'

export default function StorefrontLayout() {
  const signedIn = useSelector((state) => state.auth.status === 'authenticated')
  return (
    <>
      <header className="storefront-header surface">
        <div className="container-xl d-flex align-items-center gap-3 py-2">
          <Link to="/" className="wordmark">eshop</Link>
          <form role="search" className="search-pill flex-grow-1 mx-md-4" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="site-search" className="visually-hidden">Search products</label>
            <input id="site-search" type="search" className="form-control" placeholder="What are you shopping for today?" />
            <button type="submit" className="search-submit" aria-label="Search">
              <ArrowRight size={20} aria-hidden />
            </button>
          </form>
          <nav className="d-flex align-items-center" aria-label="Account">
            <Link to="/orders" className="icon-btn" aria-label="My Orders" title="My Orders"><Package size={20} aria-hidden /></Link>
            {signedIn
              ? <Link to="/account" className="icon-btn" aria-label="Account" title="Account"><User size={20} aria-hidden /></Link>
              : <Link to="/login" className="icon-btn" aria-label="Log in" title="Log in"><LogIn size={20} aria-hidden /></Link>}
            <button type="button" className="icon-btn" aria-label="Cart, 0 items" title="Cart"><ShoppingBag size={20} aria-hidden /></button>
            <ThemeToggle />
            {signedIn && <LogoutButton />}
          </nav>
        </div>
      </header>
      <main className="container-xl py-4">
        <AnimatedOutlet />
      </main>
    </>
  )
}
