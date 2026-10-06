import { Link } from 'react-router-dom'
import ThemeToggle from '../theme/ThemeToggle.jsx'
import './desk.css'

// Employee support desk: Queue + my Customers | conversation | that Customer's Orders.
export default function DeskLayout() {
  return (
    <div className="desk-shell">
      <header className="desk-header surface">
        <Link to="/desk" className="wordmark">eshop</Link>
        <span className="text-body-secondary ms-2">Support desk</span>
        <div className="ms-auto"><ThemeToggle /></div>
      </header>
      <main className="desk-panes">
        <section className="desk-pane surface" aria-label="Support Queue and my Customers">
          <h2 className="h6">Support Queue</h2>
          <p className="text-body-secondary small mb-0">No Customers waiting.</p>
        </section>
        <section className="desk-pane surface" aria-label="Conversation">
          <p className="text-body-secondary m-auto">Select a Customer to start.</p>
        </section>
        <section className="desk-pane surface" aria-label="Customer's Orders">
          <h2 className="h6">Orders</h2>
          <p className="text-body-secondary small mb-0">Nothing selected.</p>
        </section>
      </main>
    </div>
  )
}
