import { NavLink } from 'react-router-dom'
import AnimatedOutlet from '../AnimatedOutlet.jsx'
import LogoutButton from '../auth/LogoutButton.jsx'
import ChatProvider from '../chat/ChatProvider.jsx'
import useLiveOrders from '../orders/useLiveOrders.js'
import ThemeToggle from '../theme/ThemeToggle.jsx'
import './desk.css'

// Employee workspace: the support desk plus the Orders list, kept live by the orders socket.
export default function DeskLayout() {
  useLiveOrders()
  return (
    <ChatProvider>
      <div className="desk-shell">
        <header className="desk-header surface">
          <NavLink to="/desk" end className="wordmark">eshop</NavLink>
          <span className="text-body-secondary ms-2 me-3">Support desk</span>
          <nav className="desk-nav" aria-label="Desk">
            <NavLink to="/desk" end>Desk</NavLink>
            <NavLink to="/desk/orders">Orders</NavLink>
          </nav>
          <div className="ms-auto d-flex"><ThemeToggle /><LogoutButton /></div>
        </header>
        <main className="desk-main">
          <AnimatedOutlet />
        </main>
      </div>
    </ChatProvider>
  )
}
