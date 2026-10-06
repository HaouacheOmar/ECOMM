import { Activity, LayoutDashboard, MapPin, Package, ReceiptText, Tags, Users } from 'lucide-react'
import AnimatedOutlet from '../AnimatedOutlet.jsx'
import useLiveOrders from '../orders/useLiveOrders.js'
import IconRail, { RailAvatar, RailLink } from '../shell/Rail.jsx'
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
    <div className="app-shell">
      <IconRail label="Admin" home="/admin" account={<RailAvatar to="/admin/account" />}>
        {NAV.map((item) => <RailLink key={item.to} {...item} />)}
      </IconRail>
      <main className="app-main admin-main">
        <AnimatedOutlet />
      </main>
    </div>
  )
}
