import { Activity, LayoutDashboard, MapPin, Package, ReceiptText, Tags, UserCog, Users } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import AnimatedOutlet from '../AnimatedOutlet.jsx'
import LogoutButton from '../auth/LogoutButton.jsx'
import useLiveOrders from '../orders/useLiveOrders.js'
import ThemeToggle from '../theme/ThemeToggle.jsx'
import useLiveActivity from './useLiveActivity.js'
import './admin.css'

const NAV = [
  { to: '/admin', label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', Icon: ReceiptText },
  { to: '/admin/products', label: 'Products', Icon: Package },
  { to: '/admin/categories', label: 'Categories', Icon: Tags },
  { to: '/admin/pickup-points', label: 'Pickup Points', Icon: MapPin },
  { to: '/admin/employees', label: 'Employees', Icon: Users },
  { to: '/admin/activity', label: 'Activity log', Icon: Activity },
]

export default function AdminLayout() {
  useLiveOrders()
  useLiveActivity()
  return (
    <div className="admin-shell">
      <nav className="icon-rail surface" aria-label="Admin">
        <span className="wordmark mb-2" aria-hidden>e</span>
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="rail-item" aria-label={label} title={label}>
            <Icon size={22} aria-hidden />
          </NavLink>
        ))}
        <div className="mt-auto d-flex flex-column align-items-center">
          <ThemeToggle />
          <NavLink to="/admin/account" className="rail-item" aria-label="Account" title="Account">
            <UserCog size={22} aria-hidden />
          </NavLink>
          <LogoutButton className="rail-item border-0 bg-transparent" />
        </div>
      </nav>
      <main className="admin-main">
        <AnimatedOutlet />
      </main>
    </div>
  )
}
