import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useCategoriesQuery } from '../products/productsApi.js'
import { detailError, fieldError, useCreateCategoryMutation, useDeleteCategoryMutation, useUpdateCategoryMutation } from './catalogApi.js'

function CategoryRow({ category }) {
  const [name, setName] = useState(category.name)
  const [update, updated] = useUpdateCategoryMutation()
  const [remove, removed] = useDeleteCategoryMutation()
  const error = fieldError(updated.error, 'name') ?? (removed.error && detailError(removed.error))

  return (
    <li className="list-group-item d-flex flex-wrap align-items-center gap-2">
      <form className="d-flex gap-2 flex-grow-1" onSubmit={(e) => { e.preventDefault(); update({ id: category.id, name }) }}>
        <label htmlFor={`cat-${category.id}`} className="visually-hidden">Category name</label>
        <input id={`cat-${category.id}`} className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-outline-secondary" disabled={name === category.name || updated.isLoading}>Rename</button>
      </form>
      <button type="button" className="icon-btn" aria-label={`Delete ${category.name}`} title="Delete" onClick={() => remove(category.id)}>
        <Trash2 size={18} aria-hidden />
      </button>
      {error && <div role="alert" className="w-100 text-danger small">{error}</div>}
    </li>
  )
}

export default function CategoriesPage() {
  const { data: categories = [] } = useCategoriesQuery()
  const [create, created] = useCreateCategoryMutation()
  const [name, setName] = useState('')

  const onCreate = async (e) => {
    e.preventDefault()
    if ((await create({ name: name.trim() })).data) setName('')
  }

  return (
    <section style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-3">Categories</h1>
      <form className="card p-3 mb-3" onSubmit={onCreate}>
        <label htmlFor="new-category" className="form-label">New category</label>
        <div className="d-flex gap-2">
          <input id="new-category" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
          <button type="submit" className="btn btn-primary" disabled={!name.trim() || created.isLoading}>Add</button>
        </div>
        {created.error && <div role="alert" className="text-danger small mt-2">{fieldError(created.error, 'name') ?? detailError(created.error)}</div>}
      </form>
      <ul className="list-group card p-2">
        {categories.map((c) => <CategoryRow key={c.id} category={c} />)}
      </ul>
    </section>
  )
}
