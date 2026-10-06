import { ArrowLeft, Star, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCategoriesQuery, useProductQuery } from '../products/productsApi.js'
import {
  detailError,
  fieldError,
  useCreateProductMutation,
  useDeleteImageMutation,
  useMakePrimaryMutation,
  useSetArchivedMutation,
  useUpdateProductMutation,
  useUploadImageMutation,
} from './catalogApi.js'

const EMPTY = { name: '', description: '', price: '', stock: '0', category: '' }

function Field({ id, label, error, children }) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label">{label}</label>
      {children}
      {error && <div id={`${id}-error`} className="text-danger small mt-1">{error}</div>}
    </div>
  )
}

function ProductForm({ product }) {
  const navigate = useNavigate()
  const { data: categories = [] } = useCategoriesQuery()
  const [create, created] = useCreateProductMutation()
  const [update, updated] = useUpdateProductMutation()
  const [form, setForm] = useState(product
    ? { name: product.name, description: product.description, price: product.price, stock: String(product.stock), category: product.category.id }
    : EMPTY)
  const [saved, setSaved] = useState(false)
  const result = product ? updated : created
  const error = result.error

  const onChange = (e) => {
    setSaved(false)
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (product) {
      if ((await update({ id: product.id, ...form })).data) setSaved(true)
    } else {
      const { data } = await create(form)
      if (data) navigate(`/admin/products/${data.id}`, { replace: true })
    }
  }

  const input = (name, props = {}) => (
    <input id={`p-${name}`} name={name} className={`form-control${fieldError(error, name) ? ' is-invalid' : ''}`} value={form[name]} onChange={onChange}
      aria-describedby={fieldError(error, name) ? `p-${name}-error` : undefined} {...props} />
  )

  return (
    <form onSubmit={onSubmit} noValidate className="card p-4">
      <Field id="p-name" label="Name" error={fieldError(error, 'name')}>{input('name', { required: true })}</Field>
      <Field id="p-description" label="Description" error={fieldError(error, 'description')}>
        <textarea id="p-description" name="description" rows={4} className="form-control" value={form.description} onChange={onChange} />
      </Field>
      <div className="row">
        <div className="col-sm-6"><Field id="p-price" label="Price (DA)" error={fieldError(error, 'price')}>{input('price', { type: 'number', min: 1, step: '0.01', inputMode: 'decimal' })}</Field></div>
        <div className="col-sm-6"><Field id="p-stock" label="Stock" error={fieldError(error, 'stock')}>{input('stock', { type: 'number', min: 0, step: 1 })}</Field></div>
      </div>
      <Field id="p-category" label="Category" error={fieldError(error, 'category')}>
        <select id="p-category" name="category" className={`form-select${fieldError(error, 'category') ? ' is-invalid' : ''}`} value={form.category} onChange={onChange}>
          <option value="">Choose a category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      {error && !Object.keys(EMPTY).some((f) => fieldError(error, f)) && <div role="alert" className="text-danger small mb-3">{detailError(error)}</div>}
      <div className="d-flex align-items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={result.isLoading}>{product ? 'Save changes' : 'Create product'}</button>
        <span role="status" className="small text-body-secondary">{saved ? 'Saved.' : ''}</span>
      </div>
    </form>
  )
}

function Photos({ product }) {
  const [upload, uploading] = useUploadImageMutation()
  const [remove] = useDeleteImageMutation()
  const [makePrimary] = useMakePrimaryMutation()

  const onFile = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (file) await upload({ id: product.id, file })
  }

  return (
    <section className="card p-4 mt-3" aria-labelledby="photos-heading">
      <h2 id="photos-heading" className="h5">Photos</h2>
      <div className="admin-photos">
        {product.images.map((img) => (
          <figure key={img.id} className="admin-photo">
            <img src={img.image} alt={`${product.name} photo`} />
            <figcaption className="d-flex align-items-center justify-content-between">
              {img.is_primary
                ? <span className="small">Primary</span>
                : <button type="button" className="icon-btn" aria-label="Make primary photo" title="Make primary" onClick={() => makePrimary({ id: product.id, imageId: img.id })}><Star size={18} aria-hidden /></button>}
              <button type="button" className="icon-btn" aria-label="Delete photo" title="Delete photo" onClick={() => remove({ id: product.id, imageId: img.id })}><Trash2 size={18} aria-hidden /></button>
            </figcaption>
          </figure>
        ))}
      </div>
      <label className="btn btn-outline-secondary d-inline-flex align-items-center gap-2 mt-3 align-self-start">
        <Upload size={18} aria-hidden /> {uploading.isLoading ? 'Uploading…' : 'Add photo'}
        <input type="file" accept="image/*" className="visually-hidden" onChange={onFile} disabled={uploading.isLoading} />
      </label>
      {uploading.error && <div role="alert" className="text-danger small mt-2">{fieldError(uploading.error, 'image') ?? detailError(uploading.error)}</div>}
    </section>
  )
}

export default function ProductFormPage() {
  const { id } = useParams()
  const { data: product, isLoading, isError } = useProductQuery(id, { skip: !id })
  const [setArchived, archiving] = useSetArchivedMutation()

  if (id && isLoading) return <p className="text-body-secondary">Loading…</p>
  if (id && isError) return <p>Product not found. <Link to="/admin/products">Back to products</Link></p>

  return (
    <section style={{ maxWidth: 720 }}>
      <Link to="/admin/products" className="d-inline-flex align-items-center gap-1 mb-3 text-body-secondary text-decoration-none">
        <ArrowLeft size={16} aria-hidden /> Products
      </Link>
      <div className="d-flex align-items-center gap-2 mb-3">
        <h1 className="h3 me-auto mb-0">{product ? product.name : 'New product'}</h1>
        {product?.is_archived && <span className="badge-out">Archived</span>}
        {product && (
          <button type="button" className="btn btn-outline-secondary" disabled={archiving.isLoading}
            onClick={() => setArchived({ id: product.id, archived: !product.is_archived })}>
            {product.is_archived ? 'Restore' : 'Archive'}
          </button>
        )}
      </div>
      <ProductForm key={product?.id ?? 'new'} product={product} />
      {product && <Photos product={product} />}
    </section>
  )
}
