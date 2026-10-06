import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useCreatePickupPointMutation, useDeletePickupPointMutation, usePickupPointsQuery, useUpdatePickupPointMutation } from '../orders/ordersApi.js'
import { detailError } from './catalogApi.js'

const EMPTY = { name: '', city: '', address: '' }
const FIELDS = [['name', 'Name'], ['city', 'City'], ['address', 'Address']]

const firstError = (error) => (error?.data && FIELDS.map(([f]) => error.data[f]?.[0]).find(Boolean)) ?? detailError(error)

function PointFields({ idPrefix, values, onChange }) {
  return FIELDS.map(([field, label]) => (
    <div key={field} className={field === 'address' ? 'col-12 col-md-5' : 'col-6 col-md'}>
      <label htmlFor={`${idPrefix}-${field}`} className="form-label small">{label}</label>
      <input id={`${idPrefix}-${field}`} name={field} className="form-control" required value={values[field]} onChange={onChange} />
    </div>
  ))
}

function PointRow({ point }) {
  const [values, setValues] = useState(point)
  const [update, updated] = useUpdatePickupPointMutation()
  const [remove, removed] = useDeletePickupPointMutation()
  const dirty = FIELDS.some(([f]) => values[f] !== point[f])
  const error = firstError(updated.error) ?? (removed.error && detailError(removed.error))

  return (
    <li className="list-group-item py-3">
      <form className="row g-2 align-items-end" aria-label={point.name}
        onSubmit={(e) => { e.preventDefault(); update({ id: point.id, name: values.name, city: values.city, address: values.address }) }}>
        <PointFields idPrefix={`pp-${point.id}`} values={values} onChange={(e) => setValues({ ...values, [e.target.name]: e.target.value })} />
        <div className="col-12 d-flex align-items-center gap-3">
          <div className="form-check form-switch mb-0">
            <input id={`pp-${point.id}-active`} type="checkbox" role="switch" className="form-check-input" checked={point.is_active}
              onChange={(e) => update({ id: point.id, is_active: e.target.checked })} />
            <label htmlFor={`pp-${point.id}-active`} className="form-check-label">Active</label>
          </div>
          <button type="submit" className="btn btn-outline-secondary btn-sm ms-auto" disabled={!dirty || updated.isLoading}>Save</button>
          <button type="button" className="icon-btn" aria-label={`Delete ${point.name}`} title="Delete" onClick={() => remove(point.id)}>
            <Trash2 size={18} aria-hidden />
          </button>
        </div>
        {error && <div role="alert" className="col-12 text-danger small">{error}</div>}
      </form>
    </li>
  )
}

export default function PickupPointsPage() {
  const { data: points = [] } = usePickupPointsQuery()
  const [create, created] = useCreatePickupPointMutation()
  const [form, setForm] = useState(EMPTY)

  const onCreate = async (e) => {
    e.preventDefault()
    if ((await create(form)).data) setForm(EMPTY)
  }

  return (
    <section style={{ maxWidth: 820 }}>
      <h1 className="h3 mb-3">Pickup Points</h1>
      <form className="card p-3 mb-3" onSubmit={onCreate} aria-label="New pickup point">
        <h2 className="h6">New pickup point</h2>
        <div className="row g-2 align-items-end">
          <PointFields idPrefix="new-pp" values={form} onChange={(e) => setForm({ ...form, [e.target.name]: e.target.value })} />
          <div className="col-12 col-md-auto">
            <button type="submit" className="btn btn-primary w-100" disabled={created.isLoading}>Add</button>
          </div>
        </div>
        {created.error && <div role="alert" className="text-danger small mt-2">{firstError(created.error)}</div>}
      </form>
      {points.length === 0
        ? <p className="text-body-secondary">No pickup points yet. Customers can only choose Home Delivery.</p>
        : <ul className="list-group card p-2">{points.map((p) => <PointRow key={p.id} point={p} />)}</ul>}
    </section>
  )
}
