import { ArrowLeft, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { formatPrice } from '../products/formatPrice.js'
import { useProductQuery } from '../products/productsApi.js'
import { detailError, fieldError, useAdminProductsQuery } from './catalogApi.js'
import { Field } from './ProductFormPage.jsx'
import { shopToday, useRecordRestockMutation } from './stockApi.js'
import { useSuppliersQuery } from './suppliersApi.js'

const newLine = (product) => ({
  product,
  quantity: '1',
  unit_cost: product.cost_price ?? '',
  update_cost_price: product.cost_price == null, // Cost missing: filling it is the obvious choice
})

// Whether a line's unit cost differs from the Product's Cost price (then the Admin chooses to update it).
const differs = (line) => line.unit_cost !== '' && (line.product.cost_price == null || Number(line.unit_cost) !== Number(line.product.cost_price))

function ProductPicker({ onPick, exclude }) {
  const [term, setTerm] = useState('')
  const [search, setSearch] = useState('')
  const { data } = useAdminProductsQuery({ search, page: 1 }, { skip: !search })

  useEffect(() => {
    const timer = setTimeout(() => setSearch(term.trim()), 250)
    return () => clearTimeout(timer)
  }, [term])

  const results = (data?.results ?? []).filter((p) => !p.is_archived && !exclude.includes(p.id))
  return (
    <div className="mb-3">
      <label htmlFor="restock-add" className="form-label">Add a product</label>
      <input id="restock-add" type="search" className="form-control" placeholder="Search products" value={term} onChange={(e) => setTerm(e.target.value)} />
      {search && (
        <ul className="list-group mt-1" aria-label="Matching products">
          {results.map((p) => (
            <li key={p.id} className="list-group-item p-0">
              <button type="button" className="btn btn-link w-100 text-start text-decoration-none" onClick={() => { onPick(p); setTerm('') }}>
                {p.name} <span className="small text-body-secondary">· {p.stock} in stock</span>
              </button>
            </li>
          ))}
          {data && results.length === 0 && <li className="list-group-item small text-body-secondary">No products found.</li>}
        </ul>
      )}
    </div>
  )
}

function RestockForm({ startProduct }) {
  const navigate = useNavigate()
  const { data: suppliers } = useSuppliersQuery()
  const [record, recorded] = useRecordRestockMutation()
  // Opened from a Product: start with it, from its Usual Supplier.
  const usual = startProduct?.usual_supplier
  const [form, setForm] = useState({ supplier: usual && !usual.is_archived ? usual.id : '', date: shopToday(), note: '' })
  const [lines, setLines] = useState(startProduct ? [newLine(startProduct)] : [])
  const error = recorded.error

  const setLine = (index, changes) => setLines(lines.map((line, i) => (i === index ? { ...line, ...changes } : line)))
  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_cost) || 0), 0)
  const lineError = (index) => {
    const errors = error?.data?.lines
    return Array.isArray(errors) ? Object.values(errors[index] ?? {})[0]?.[0] : null
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const { data } = await record({
      ...form,
      lines: lines.map((line) => ({
        product: line.product.id, quantity: line.quantity, unit_cost: line.unit_cost, update_cost_price: differs(line) && line.update_cost_price,
      })),
    })
    if (data) navigate(`/admin/restocks/${data.id}`, { replace: true })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card p-4">
      <div className="row">
        <div className="col-sm-7">
          <Field id="r-supplier" label="Supplier" error={fieldError(error, 'supplier')}>
            <select id="r-supplier" className={`form-select${fieldError(error, 'supplier') ? ' is-invalid' : ''}`} value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}>
              <option value="">Choose a supplier</option>
              {suppliers?.results.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="col-sm-5">
          <Field id="r-date" label="Date" error={fieldError(error, 'date')}>
            <input id="r-date" type="date" className={`form-control${fieldError(error, 'date') ? ' is-invalid' : ''}`} max={shopToday()} value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
        </div>
      </div>

      <ProductPicker exclude={lines.map((line) => line.product.id)} onPick={(product) => setLines([...lines, newLine(product)])} />

      {lines.length > 0 && (
        <table className="table align-middle">
          <thead><tr><th scope="col">Product</th><th scope="col" style={{ width: 110 }}>Quantity</th><th scope="col" style={{ width: 160 }}>Unit cost (DA)</th><th scope="col"><span className="visually-hidden">Remove</span></th></tr></thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={line.product.id}>
                <td>
                  {line.product.name}
                  {differs(line) && (
                    <div className="form-check small mt-1">
                      <input id={`r-cost-${i}`} type="checkbox" className="form-check-input" checked={line.update_cost_price}
                        onChange={(e) => setLine(i, { update_cost_price: e.target.checked })} />
                      <label htmlFor={`r-cost-${i}`} className="form-check-label">
                        {line.product.cost_price == null ? 'Set as its cost price (Cost missing)' : `Update its cost price from ${formatPrice(line.product.cost_price)}`}
                      </label>
                    </div>
                  )}
                  {lineError(i) && <div className="text-danger small">{lineError(i)}</div>}
                </td>
                <td><input aria-label={`Quantity of ${line.product.name}`} type="number" min={1} step={1} className="form-control" value={line.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} /></td>
                <td><input aria-label={`Unit cost of ${line.product.name}`} type="number" min={0} step="0.01" inputMode="decimal" className="form-control" value={line.unit_cost} onChange={(e) => setLine(i, { unit_cost: e.target.value })} /></td>
                <td><button type="button" className="icon-btn" aria-label={`Remove ${line.product.name}`} onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 size={18} aria-hidden /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {typeof error?.data?.lines?.[0] === 'string' && <div className="text-danger small mb-2">{error.data.lines[0]}</div>}

      <Field id="r-note" label="Note (optional)" error={fieldError(error, 'note')}>
        <textarea id="r-note" rows={2} className="form-control" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </Field>
      {error && !['supplier', 'date', 'lines', 'note'].some((f) => error.data?.[f]) && <div role="alert" className="text-danger small mb-3">{detailError(error)}</div>}
      <div className="d-flex align-items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={recorded.isLoading || lines.length === 0}>Record restock</button>
        <span className="ms-auto">Total <strong>{formatPrice(total)}</strong></span>
      </div>
    </form>
  )
}

export default function RestockFormPage() {
  const [params] = useSearchParams()
  const productId = params.get('product')
  const { data: startProduct, isLoading } = useProductQuery(productId, { skip: !productId })

  return (
    <section style={{ maxWidth: 860 }}>
      <Link to="/admin/restocks" className="d-inline-flex align-items-center gap-1 mb-3 text-body-secondary text-decoration-none">
        <ArrowLeft size={16} aria-hidden /> Restocks
      </Link>
      <h1 className="h3 mb-3">New restock</h1>
      {productId && isLoading ? <p className="text-body-secondary">Loading…</p> : <RestockForm startProduct={startProduct} />}
    </section>
  )
}
