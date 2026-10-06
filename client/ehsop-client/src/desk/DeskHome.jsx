// Queue + my Customers | conversation | that Customer's Orders (filled in by the chat tickets).
export default function DeskHome() {
  return (
    <div className="desk-panes">
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
    </div>
  )
}
