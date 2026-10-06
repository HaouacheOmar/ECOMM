const LABELS = { CONFIRMED: 'Confirmed', SHIPPED: 'Shipped', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' }

export function StatusBadge({ status }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{LABELS[status]}</span>
}

export function Delivery({ order }) {
  if (order.delivery_method === 'HOME_DELIVERY') return <>Home Delivery to {order.delivery_address}</>
  const p = order.pickup_point
  return <>Pickup Point: {p.name}, {p.address}, {p.city}</>
}
