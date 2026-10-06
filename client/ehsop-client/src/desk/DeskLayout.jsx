import { MessagesSquare, ReceiptText } from 'lucide-react'
import AnimatedOutlet from '../AnimatedOutlet.jsx'
import ChatProvider from '../chat/ChatProvider.jsx'
import useLiveOrders from '../orders/useLiveOrders.js'
import IconRail, { RailAvatar, RailLink } from '../shell/Rail.jsx'
import './desk.css'

// Employee workspace: the support desk plus the Orders list, kept live by the orders socket.
export default function DeskLayout() {
  useLiveOrders()
  return (
    <ChatProvider>
      <div className="app-shell desk-shell">
        <IconRail label="Desk" home="/desk" account={<RailAvatar to="/desk/account" />}>
          <RailLink to="/desk" end label="Desk" Icon={MessagesSquare} />
          <RailLink to="/desk/orders" label="Orders" Icon={ReceiptText} />
        </IconRail>
        <main className="app-main desk-main">
          <AnimatedOutlet />
        </main>
      </div>
    </ChatProvider>
  )
}
