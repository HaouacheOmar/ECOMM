import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatPrice } from '../products/formatPrice.js'
import { detailError, fieldError } from './catalogApi.js'
import { Field } from './ProductFormPage.jsx'
import { RestockTable } from './RestocksPage.jsx'
import { useRestocksQuery } from './stockApi.js'
import { useCreateSupplierMutation, useSetSupplierArchivedMutation, useSupplierQuery, useUpdateSupplierMutation } from './suppliersApi.js'

const EMPTY = { name: '', phone: '', email: '', address: '', notes: '' }

function SupplierForm({ supplier }) {
  const navigate = useNavigate()
  const [create, created] = useCreateSupplierMutation()
  const [update, updated] = useUpdateSupplierMutation()
  const [form, setForm] = useState(supplier ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, supplier[k]])) : EMPTY)
  const [saved, setSaved] = useState(false)
  const result = supplier ? updated : created
  const error = result.error

  const onChange = (e) => {
    setSaved(false)
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (supplier) {
      if ((await update({ id: supplier.id, ...form })).data) setSaved(true)
    } else {
      const { data } = await create(form)
      if (data) navigate(`/admin/suppliers/${data.id}`, { replace: true })
    }
  }

  const control = (name, props = {}) => {
    const Tag = props.rows ? 'textarea' : 'input'
    return (
      <Tag id={`s-${name}`} name={name} className={`form-control${fieldError(error, name) ? ' is-invalid' : ''}`} value={form[name]} onChange={onChange}
        aria-describedby={fieldError(error, name) ? `s-${name}-error` : undefined} {...props} />
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card p-4">
      <Field id="s-name" label="Name" error={fieldError(error, 'name')}>{control('name', { required: true })}</Field>
      <div className="row">
        <div className="col-sm-6"><Field id="s-phone" label="Phone" error={fieldError(error, 'phone')}>{control('phone', { type: 'tel' })}</Field></div>
        <div className="col-sm-6"><Field id="s-email" label="Email" error={fieldError(error, 'email')}>{control('email', { type: 'email' })}</Field></div>
      </div>
      <Field id="s-address" label="Address" error={fieldError(error, 'address')}>{control('address', { rows: 2 })}</Field>
      <Field id="s-notes" label="Notes" error={fieldError(error, 'notes')}>{control('notes', { rows: 3 })}</Field>
      {error && !Object.keys(EMPTY).some((f) => fieldError(error, f)) && <div role="alert" className="text-danger small mb-3">{detailError(error)}</div>}
      <div className="d-flex align-items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={result.isLoading}>{supplier ? 'Save changes' : 'Add supplier'}</button>
        <span role="status" className="small text-body-secondary">{saved ? 'Saved.' : ''}</span>
      </div>
    </form>
  )
}

function SupplierRestocks({ supplier }) {
  const { data } = useRestocksQuery({ supplier: supplier.id })
  return (
    <section className="card p-4 mt-3" aria-labelledby="supplier-restocks">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <h2 id="supplier-restocks" className="h5 me-auto mb-0">Restocks</h2>
        <span>Total spent <strong>{formatPrice(supplier.total_spent)}</strong></span>
      </div>
      {data && <RestockTable restocks={data.results} showSupplier={false} />}
    </section>
  )
}

export default function SupplierFormPage() {
  const { id } = useParams()
  const { data: supplier, isLoading, isError } = useSupplierQuery(id, { skip: !id })
  const [setArchived, archiving] = useSetSupplierArchivedMutation()

  if (id && isLoading) return <p className="text-body-secondary">Loading…</p>
  if (id && isError) return <p>Supplier not found. <Link to="/admin/suppliers">Back to suppliers</Link></p>

  return (
    <section style={{ maxWidth: 720 }}>
      <Link to="/admin/suppliers" className="d-inline-flex align-items-center gap-1 mb-3 text-body-secondary text-decoration-none">
        <ArrowLeft size={16} aria-hidden /> Suppliers
      </Link>
      <div className="d-flex align-items-center gap-2 mb-3">
        <h1 className="h3 me-auto mb-0">{supplier ? supplier.name : 'New supplier'}</h1>
        {supplier?.is_archived && <span className="badge-out">Archived</span>}
        {supplier && (
          <button type="button" className="btn btn-outline-secondary" disabled={archiving.isLoading}
            onClick={() => setArchived({ id: supplier.id, archived: !supplier.is_archived })}>
            {supplier.is_archived ? 'Restore' : 'Archive'}
          </button>
        )}
      </div>
      <SupplierForm key={supplier?.id ?? 'new'} supplier={supplier} />
      {supplier && <SupplierRestocks supplier={supplier} />}
    </section>
  )
}
