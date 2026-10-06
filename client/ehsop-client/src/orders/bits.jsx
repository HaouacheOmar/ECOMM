const LABELS = { CONFIRMED: 'Confirmed', SHIPPED: 'Shipped', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' }

export function StatusBadge({ status }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{LABELS[status]}</span>
}
