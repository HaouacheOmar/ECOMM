import { motion } from 'motion/react'
import { useSearchParams } from 'react-router-dom'
import ProductCard from './ProductCard.jsx'
import { useCategoriesQuery, useProductsQuery } from './productsApi.js'
import './products.css'

const SORTS = [
  ['', 'Newest'],
  ['price', 'Price: low to high'],
  ['-price', 'Price: high to low'],
  ['-rating_avg', 'Best rated'],
]
const PAGE_SIZE = 20

export default function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const filters = {
    category: params.get('category') ?? '',
    search: params.get('search') ?? '',
    ordering: params.get('ordering') ?? '',
    page: params.get('page') ?? '',
  }
  const { data: categories = [] } = useCategoriesQuery()
  const { data, isFetching, isError } = useProductsQuery(filters)

  // Changing a filter resets to page 1.
  const update = (changes) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries({ page: '', ...changes })) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next)
  }

  const page = Number(filters.page || 1)
  const pages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1

  return (
    <section>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="h3 me-auto mb-0">{filters.search ? `Results for “${filters.search}”` : 'Shop'}</h1>
        <label htmlFor="sort" className="visually-hidden">Sort by</label>
        <select id="sort" className="form-select w-auto" value={filters.ordering} onChange={(e) => update({ ordering: e.target.value })}>
          {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="chips mb-4" role="group" aria-label="Categories">
        <button type="button" className="chip" aria-pressed={!filters.category} onClick={() => update({ category: '' })}>All</button>
        {categories.map((c) => (
          <button key={c.id} type="button" className="chip" aria-pressed={filters.category === c.id} onClick={() => update({ category: c.id })}>
            {c.name}
          </button>
        ))}
      </div>

      <p role="status" className="text-body-secondary small">
        {isError ? 'Could not load products.' : data ? `${data.count} product${data.count === 1 ? '' : 's'} found` : 'Loading products…'}
      </p>

      {data?.count === 0 && <p className="py-5 text-center text-body-secondary">No products found.</p>}

      <motion.div
        key={JSON.stringify(filters)}
        className="product-grid"
        initial="hidden"
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.04 } } }}
        aria-busy={isFetching}
      >
        {data?.results.map((p) => <ProductCard key={p.id} product={p} />)}
      </motion.div>

      {pages > 1 && (
        <nav className="d-flex justify-content-center align-items-center gap-3 mt-4" aria-label="Pagination">
          <button type="button" className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => update({ ...filters, page: String(page - 1) })}>Previous</button>
          <span className="small">Page {page} of {pages}</span>
          <button type="button" className="btn btn-outline-secondary" disabled={page >= pages} onClick={() => update({ ...filters, page: String(page + 1) })}>Next</button>
        </nav>
      )}
    </section>
  )
}
