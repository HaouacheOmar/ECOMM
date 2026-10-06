// PROTOTYPE (throwaway): three structurally different screen inventories for the
// Storefront, Employee portal and Admin dashboard, switchable via ?variant=A|B|C
// and ?ws=store|employee|admin on /#/prototype/screens. Fake data, no API calls.
import { useSearchParams } from 'react-router-dom'
import PrototypeSwitcher from './PrototypeSwitcher.jsx'

// ---------- fake data ----------
const products = [
  { id: 1, name: 'Blue ceramic mug', cat: 'Kitchen', price: 12, rating: 4.7, stock: 14 },
  { id: 2, name: 'Linen tote bag', cat: 'Bags', price: 25, rating: 4.4, stock: 0 },
  { id: 3, name: 'Oak cutting board', cat: 'Kitchen', price: 38, rating: 4.9, stock: 6 },
  { id: 4, name: 'Wool scarf', cat: 'Clothing', price: 45, rating: 4.2, stock: 22 },
]
const categories = ['Kitchen', 'Bags', 'Clothing', 'Home']
const orders = [
  { id: 'A1F3', customer: 'sara@mail.com', total: 62, status: 'Confirmed', method: 'Home Delivery', at: '14:02' },
  { id: '9C2B', customer: 'yanis@mail.com', total: 25, status: 'Shipped', method: 'Pickup Point', at: '13:40' },
  { id: '77DE', customer: 'lina@mail.com', total: 83, status: 'Delivered', method: 'Home Delivery', at: '11:15' },
]
const queue = [
  { customer: 'sara@mail.com', last: 'Where is my order A1F3?', waiting: '3 min' },
  { customer: 'karim@mail.com', last: 'Can I change the pickup point?', waiting: '1 min' },
]
const chats = [
  { customer: 'yanis@mail.com', last: 'Thanks!', unread: 0 },
  { customer: 'lina@mail.com', last: 'The scarf is the wrong colour', unread: 2 },
]
const employees = [
  { email: 'amine@eshop.dz', online: true, active: true },
  { email: 'nadia@eshop.dz', online: false, active: true },
  { email: 'old@eshop.dz', online: false, active: false },
]
const sessions = [
  { email: 'amine@eshop.dz', login: '08:58', logout: null },
  { email: 'nadia@eshop.dz', login: '08:30', logout: '12:01' },
]

// ---------- tiny shared bits (content only; layouts are per variant) ----------
const Box = ({ title, children, className = '' }) => (
  <div className={`border rounded p-2 mb-2 bg-white ${className}`}>
    {title && <div className="fw-semibold small text-uppercase text-muted mb-1">{title}</div>}
    {children}
  </div>
)
const Badge = ({ s }) => {
  const c = { Confirmed: 'primary', Shipped: 'warning', Delivered: 'success', Cancelled: 'secondary' }[s]
  return <span className={`badge text-bg-${c}`}>{s}</span>
}
const OrdersTable = ({ actions = true }) => (
  <table className="table table-sm mb-0">
    <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Method</th><th>Status</th>{actions && <th />}</tr></thead>
    <tbody>
      {orders.map((o) => (
        <tr key={o.id}>
          <td>#{o.id} <small className="text-muted">{o.at}</small></td><td>{o.customer}</td><td>{o.total} DA</td>
          <td>{o.method}</td><td><Badge s={o.status} /></td>
          {actions && (
            <td className="text-end">
              {o.status === 'Confirmed' && <><button className="btn btn-sm btn-outline-primary me-1">Ship</button><button className="btn btn-sm btn-outline-danger">Cancel</button></>}
              {o.status === 'Shipped' && <button className="btn btn-sm btn-outline-success">Deliver</button>}
            </td>
          )}
        </tr>
      ))}
    </tbody>
  </table>
)
const ProductCard = ({ p, onClick }) => (
  <div className="border rounded p-2 bg-white h-100" role={onClick ? 'button' : undefined} onClick={onClick}>
    <div className="bg-secondary-subtle rounded mb-2" style={{ height: 70 }} />
    <div className="fw-semibold">{p.name}</div>
    <div className="small text-muted">{p.cat} · ★ {p.rating}</div>
    <div className="d-flex justify-content-between align-items-center mt-1">
      <span>{p.price} DA</span>
      {p.stock ? <button className="btn btn-sm btn-primary">Add</button> : <span className="badge text-bg-secondary">Out of stock</span>}
    </div>
  </div>
)
const ChatThread = () => (
  <div className="d-flex flex-column gap-1 small">
    <div className="align-self-start bg-light border rounded px-2 py-1">Where is my order A1F3?</div>
    <div className="align-self-end bg-primary text-white rounded px-2 py-1">It ships today, you'll get an update.</div>
    <div className="input-group input-group-sm mt-2"><input className="form-control" placeholder="Message…" /><button className="btn btn-primary">Send</button></div>
  </div>
)
const RouteMap = ({ routes }) => (
  <details className="mb-3">
    <summary className="small fw-semibold">Route map for this variant ({routes.length} routes)</summary>
    <table className="table table-sm small mt-2 mb-0">
      <tbody>{routes.map(([r, d]) => <tr key={r}><td><code>{r}</code></td><td>{d}</td></tr>)}</tbody>
    </table>
  </details>
)

// =====================================================================
// Variant A: classic multi-page. Storefront top navbar, each thing its own
// route. Employee and Admin each get a left sidebar with one page per item.
// =====================================================================
const A_ROUTES = {
  store: [
    ['/', 'Home: Bestsellers + Recommendations'], ['/products', 'Catalog: category filter + search'],
    ['/products/:id', 'Product detail + Reviews + review form'], ['/cart', 'Cart page'],
    ['/checkout', 'Checkout: delivery method, address / Pickup Point, confirm'], ['/orders', 'My Orders'],
    ['/orders/:id', 'Order detail + cancel'], ['/support', 'Chat with support (full page)'],
    ['/account', 'Account + change password'], ['/login', 'Login'], ['/register', 'Register'],
    ['/verify/:uid/:token', 'Email verification'], ['/forgot', 'Forgot password'], ['/reset/:uid/:token', 'Reset password'],
  ],
  employee: [
    ['/staff/queue', 'Support Queue'], ['/staff/chats', 'My assigned Customers'], ['/staff/chats/:customerId', 'Conversation'],
    ['/staff/orders', 'Orders (live feed)'], ['/staff/orders/:id', 'Order detail + ship/deliver/cancel'], ['/staff/account', 'Change password'],
  ],
  admin: [
    ['/admin', 'Dashboard: live Order feed + Online Employees'], ['/admin/orders', 'Orders'], ['/admin/orders/:id', 'Order detail'],
    ['/admin/products', 'Products list'], ['/admin/products/new', 'Create Product'], ['/admin/products/:id', 'Edit / archive Product'],
    ['/admin/categories', 'Categories'], ['/admin/pickup-points', 'Pickup Points'], ['/admin/employees', 'Employees: create, deactivate, set password'],
    ['/admin/activity', 'Activity log (Employee Sessions)'], ['/admin/account', 'Change password'],
  ],
}
function Sidebar({ items, active }) {
  return (
    <div className="bg-dark text-white p-2" style={{ width: 190, minHeight: 420 }}>
      {items.map((i) => <div key={i} className={`px-2 py-1 rounded small ${i === active ? 'bg-primary' : ''}`}>{i}</div>)}
    </div>
  )
}
function VariantA({ ws }) {
  if (ws === 'store') return (
    <>
      <RouteMap routes={A_ROUTES.store} />
      <nav className="navbar bg-white border px-3 mb-3">
        <b>E-Shop</b>
        <div className="d-flex gap-3 small"><span>Shop</span><span>My Orders</span><span>Support</span><span>Cart (2)</span><span>Account</span></div>
      </nav>
      <h6>Bestsellers</h6>
      <div className="row g-2 mb-3">{products.map((p) => <div className="col-3" key={p.id}><ProductCard p={p} /></div>)}</div>
      <h6>Recommended for you</h6>
      <div className="row g-2">{[...products].reverse().map((p) => <div className="col-3" key={p.id}><ProductCard p={p} /></div>)}</div>
    </>
  )
  if (ws === 'employee') return (
    <>
      <RouteMap routes={A_ROUTES.employee} />
      <div className="d-flex border">
        <Sidebar items={['Support Queue (2)', 'My chats (2)', 'Orders', 'Account']} active="Support Queue (2)" />
        <div className="flex-grow-1 p-3 bg-light">
          <h6>Support Queue</h6>
          {queue.map((q) => (
            <Box key={q.customer}>
              <div className="d-flex justify-content-between"><b>{q.customer}</b><small className="text-muted">waiting {q.waiting}</small></div>
              <div className="small">{q.last}</div>
              <button className="btn btn-sm btn-primary mt-1">Open & reply</button>
            </Box>
          ))}
        </div>
      </div>
    </>
  )
  return (
    <>
      <RouteMap routes={A_ROUTES.admin} />
      <div className="d-flex border">
        <Sidebar items={['Dashboard', 'Orders', 'Products', 'Categories', 'Pickup Points', 'Employees', 'Activity log', 'Account']} active="Dashboard" />
        <div className="flex-grow-1 p-3 bg-light">
          <h6>Dashboard</h6>
          <div className="row g-2">
            <div className="col-8"><Box title="Live Order feed"><OrdersTable actions={false} /></Box></div>
            <div className="col-4"><Box title="Employees Online">{employees.filter((e) => e.active).map((e) => <div key={e.email} className="small">{e.online ? '🟢' : '⚪'} {e.email}</div>)}</Box></div>
          </div>
        </div>
      </div>
    </>
  )
}

// =====================================================================
// Variant B: one staff console for Admin + Employees (role-filtered nav),
// storefront with chat as a floating widget and cart as a slide-out drawer.
// =====================================================================
const B_ROUTES = {
  store: [
    ['/', 'Home: Bestsellers + Recommendations'], ['/products', 'Catalog'], ['/products/:id', 'Product detail + Reviews'],
    ['/checkout', 'Checkout (cart lives in a drawer on every page, no /cart route)'], ['/orders', 'My Orders (+ detail inline, cancel)'],
    ['/account', 'Account + change password'], ['/login', 'Login / Register (tabs)'], ['/verify/:uid/:token', 'Verify'],
    ['/forgot', 'Forgot password'], ['/reset/:uid/:token', 'Reset password'], ['(widget)', 'Support chat: floating bubble on every page'],
  ],
  employee: [
    ['/console/support', 'Support: Queue + my chats in one list, conversation on the right'], ['/console/orders', 'Orders (live)'],
    ['/console/orders/:id', 'Order detail'], ['/console/account', 'Change password'],
  ],
  admin: [
    ['/console/orders', 'Orders (live), same page Employees see'], ['/console/orders/:id', 'Order detail'], ['/console/catalog', 'Products + Categories (tabs)'],
    ['/console/pickup-points', 'Pickup Points'], ['/console/team', 'Employees + Online status + activity log (tabs)'], ['/console/account', 'Change password'],
  ],
}
function ConsoleShell({ role, active, children }) {
  const nav = role === 'admin'
    ? ['Orders', 'Catalog', 'Pickup Points', 'Team', 'Account']
    : ['Support', 'Orders', 'Account']
  return (
    <div className="border">
      <div className="d-flex align-items-center bg-dark text-white px-3 py-2 gap-3 small">
        <b>Console</b>
        {nav.map((n) => <span key={n} className={n === active ? 'text-warning' : ''}>{n}</span>)}
        <span className="ms-auto">{role === 'admin' ? 'Admin' : 'amine@eshop.dz 🟢'}</span>
      </div>
      <div className="p-3 bg-light">{children}</div>
    </div>
  )
}
function VariantB({ ws }) {
  if (ws === 'store') return (
    <>
      <RouteMap routes={B_ROUTES.store} />
      <div className="position-relative border bg-light" style={{ minHeight: 440 }}>
        <div className="d-flex justify-content-between bg-white border-bottom px-3 py-2 small"><b>E-Shop</b><span>🔍 search… · Orders · Account · 🛒 2</span></div>
        <div className="p-3" style={{ marginRight: 260 }}>
          <h6>Bestsellers</h6>
          <div className="row g-2">{products.map((p) => <div className="col-6" key={p.id}><ProductCard p={p} /></div>)}</div>
        </div>
        <div className="position-absolute top-0 end-0 h-100 bg-white border-start p-2" style={{ width: 250 }}>
          <div className="fw-semibold mb-2">Cart drawer</div>
          <div className="small">Blue ceramic mug × 2 <span className="float-end">24 DA</span></div>
          <div className="small text-danger">Linen tote bag × 1 (unavailable)</div>
          <button className="btn btn-sm btn-primary w-100 mt-2" disabled>Checkout</button>
        </div>
        <div className="position-absolute bg-white border rounded shadow p-2" style={{ left: 16, bottom: 16, width: 240 }}>
          <div className="fw-semibold small mb-1">💬 Support</div><ChatThread />
        </div>
      </div>
    </>
  )
  if (ws === 'employee') return (
    <>
      <RouteMap routes={B_ROUTES.employee} />
      <ConsoleShell role="employee" active="Support">
        <div className="row g-2">
          <div className="col-4">
            <Box title="Queue">{queue.map((q) => <div key={q.customer} className="small border-bottom py-1"><b>{q.customer}</b><br />{q.last}</div>)}</Box>
            <Box title="My chats">{chats.map((c) => <div key={c.customer} className="small border-bottom py-1">{c.customer} {c.unread > 0 && <span className="badge text-bg-danger">{c.unread}</span>}</div>)}</Box>
          </div>
          <div className="col-8"><Box title="sara@mail.com"><ChatThread /></Box></div>
        </div>
      </ConsoleShell>
    </>
  )
  return (
    <>
      <RouteMap routes={B_ROUTES.admin} />
      <ConsoleShell role="admin" active="Team">
        <ul className="nav nav-tabs small mb-2"><li className="nav-item"><span className="nav-link active">Employees</span></li><li className="nav-item"><span className="nav-link">Activity log</span></li></ul>
        <Box>
          <table className="table table-sm mb-0">
            <thead><tr><th>Employee</th><th>Status</th><th /></tr></thead>
            <tbody>{employees.map((e) => (
              <tr key={e.email}><td>{e.email}</td><td>{!e.active ? 'Deactivated' : e.online ? '🟢 Online' : '⚪ Offline'}</td>
                <td className="text-end">{e.active && <><button className="btn btn-sm btn-outline-secondary me-1">Set password</button><button className="btn btn-sm btn-outline-danger">Deactivate</button></>}</td></tr>
            ))}</tbody>
          </table>
          <button className="btn btn-sm btn-primary mt-2">+ New Employee</button>
        </Box>
      </ConsoleShell>
    </>
  )
}

// =====================================================================
// Variant C: single-screen hubs. Storefront is one catalog page with filter
// rail, product detail in a modal and a checkout stepper. Employee works in
// one 3-pane screen. Admin runs everything from one dashboard with modals.
// =====================================================================
const C_ROUTES = {
  store: [
    ['/', 'Catalog hub: filter rail + Bestsellers strip + Recommendations strip; product detail opens as modal (/?product=:id)'],
    ['/checkout', 'Checkout stepper: Cart → Delivery → Review → Confirmed'], ['/me', 'My Orders + Account + Support chat as tabs'],
    ['/auth', 'Login / Register / Forgot (one page, tabs)'], ['/verify/:uid/:token', 'Verify'], ['/reset/:uid/:token', 'Reset password'],
  ],
  employee: [['/desk', 'One 3-pane desk: Queue + chats | conversation | that Customer\'s Orders with ship/deliver/cancel']],
  admin: [
    ['/hq', 'One dashboard: live Orders, Online Employees, activity log, stock alerts; editors open as modals'],
    ['/hq/catalog', 'Products + Categories + Pickup Points in one table view with inline/modal editing'],
  ],
}
function VariantC({ ws }) {
  if (ws === 'store') return (
    <>
      <RouteMap routes={C_ROUTES.store} />
      <div className="d-flex border bg-light" style={{ minHeight: 440 }}>
        <div className="bg-white border-end p-2" style={{ width: 180 }}>
          <input className="form-control form-control-sm mb-2" placeholder="Search products" />
          <div className="small fw-semibold">Categories</div>
          {categories.map((c) => <div key={c} className="form-check small"><input className="form-check-input" type="checkbox" readOnly /> {c}</div>)}
          <div className="small fw-semibold mt-2">Sort</div><select className="form-select form-select-sm"><option>Best rated</option></select>
        </div>
        <div className="flex-grow-1 p-3">
          <div className="small fw-semibold">🔥 Bestsellers</div>
          <div className="d-flex gap-2 overflow-auto mb-3">{products.map((p) => <div key={p.id} style={{ minWidth: 150 }}><ProductCard p={p} /></div>)}</div>
          <div className="small fw-semibold">All products</div>
          <div className="row g-2">{products.map((p) => <div className="col-4" key={p.id}><ProductCard p={p} /></div>)}</div>
        </div>
        <div className="position-fixed top-50 start-50 translate-middle bg-white border rounded shadow p-3" style={{ width: 360, zIndex: 10 }}>
          <div className="d-flex justify-content-between"><b>Oak cutting board</b><span>✕</span></div>
          <div className="bg-secondary-subtle rounded my-2" style={{ height: 90 }} />
          <div className="small">★ 4.9 (12 Reviews) · 38 DA · 6 in stock</div>
          <button className="btn btn-sm btn-primary my-2">Add to Cart</button>
          <div className="small border-top pt-1">“Great quality” ★★★★★</div>
        </div>
      </div>
    </>
  )
  if (ws === 'employee') return (
    <>
      <RouteMap routes={C_ROUTES.employee} />
      <div className="d-flex border bg-light" style={{ minHeight: 420 }}>
        <div className="bg-white border-end p-2" style={{ width: 200 }}>
          <div className="small fw-semibold text-danger">Queue (2)</div>
          {queue.map((q) => <div key={q.customer} className="small border-bottom py-1">{q.customer}<br /><span className="text-muted">{q.waiting}</span></div>)}
          <div className="small fw-semibold mt-2">Mine</div>
          {chats.map((c) => <div key={c.customer} className="small border-bottom py-1">{c.customer}</div>)}
        </div>
        <div className="flex-grow-1 p-2"><Box title="sara@mail.com"><ChatThread /></Box></div>
        <div className="bg-white border-start p-2" style={{ width: 260 }}>
          <div className="small fw-semibold">sara's Orders</div>
          <div className="small border rounded p-1 mt-1">#A1F3 · 62 DA · <Badge s="Confirmed" /><br /><button className="btn btn-sm btn-outline-primary mt-1 me-1">Ship</button><button className="btn btn-sm btn-outline-danger mt-1">Cancel</button></div>
          <div className="small fw-semibold mt-3">Live feed</div>
          {orders.map((o) => <div key={o.id} className="small">#{o.id} <Badge s={o.status} /></div>)}
        </div>
      </div>
    </>
  )
  return (
    <>
      <RouteMap routes={C_ROUTES.admin} />
      <div className="border p-3 bg-light">
        <div className="row g-2 mb-2">
          {[['Orders today', 12], ['Revenue today', '1 240 DA'], ['Employees Online', '1 / 2'], ['Out of stock', 1]].map(([k, v]) => (
            <div className="col-3" key={k}><Box><div className="small text-muted">{k}</div><div className="fs-5 fw-semibold">{v}</div></Box></div>
          ))}
        </div>
        <div className="row g-2">
          <div className="col-7"><Box title="Live Orders"><OrdersTable /></Box></div>
          <div className="col-5">
            <Box title="Activity log">{sessions.map((s) => <div key={s.email} className="small">{s.email}: in {s.login}{s.logout ? `, out ${s.logout}` : ' (open)'}</div>)}</Box>
            <Box title="Quick actions">
              <div className="d-flex flex-wrap gap-1">
                {['+ Product', '+ Category', '+ Pickup Point', '+ Employee'].map((a) => <button key={a} className="btn btn-sm btn-outline-primary">{a}</button>)}
              </div>
            </Box>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------- switcher route ----------
const VARIANTS = { A: 'Classic multi-page', B: 'Shared staff console + drawers', C: 'Single-screen hubs' }
const WS = { store: 'Storefront (Guest/Customer)', employee: 'Employee portal', admin: 'Admin dashboard' }

export default function ScreensPrototype() {
  const [params, setParams] = useSearchParams()
  const variant = params.get('variant') ?? 'A'
  const ws = params.get('ws') ?? 'store'
  const setWs = (w) => { const p = new URLSearchParams(params); p.set('ws', w); setParams(p, { replace: true }) }
  const V = { A: VariantA, B: VariantB, C: VariantC }[variant] ?? VariantA
  return (
    <div className="container-fluid py-3" style={{ paddingBottom: 80, textAlign: 'left' }}>
      <div className="alert alert-warning py-1 small">PROTOTYPE: screen inventory. Use ← / → to switch variant; pick a workspace below. Fake data, nothing works.</div>
      <div className="btn-group btn-group-sm mb-3">
        {Object.entries(WS).map(([k, label]) => (
          <button key={k} className={`btn ${k === ws ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setWs(k)}>{label}</button>
        ))}
      </div>
      <V ws={ws} />
      <div style={{ height: 80 }} />
      <PrototypeSwitcher variants={VARIANTS} />
    </div>
  )
}
