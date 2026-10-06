import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProductImage } from '../products/bits.jsx'
import { formatPrice } from '../products/formatPrice.js'
import { useAdminProductsQuery } from './catalogApi.js'

const PAGE_SIZE = 20

export default function AdminProductsPage() {
  const [term, setTerm] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, isFetching } = useAdminProductsQuery({ search, page })

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(term.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [term])

  const pages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1

  return (
    <section>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="h3 me-auto mb-0">Products</h1>
        <label htmlFor="admin-product-search" className="visually-hidden">Search products</label>
        <input id="admin-product-search" type="search" className="form-control w-auto" placeholder="Search products" value={term} onChange={(e) => setTerm(e.target.value)} />
        <Link to="/admin/products/new" className="btn btn-primary d-inline-flex align-items-center gap-1"><Plus size={18} aria-hidden /> New product</Link>
      </div>

      <div className="card p-2">
        <table className="table table-hover align-middle mb-0" aria-busy={isFetching}>
          <thead>
            <tr><th scope="col"><span className="visually-hidden">Photo</span></th><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Price</th><th scope="col">Stock</th><th scope="col">Status</th></tr>
          </thead>
          <tbody>
            {data?.results.map((p) => (
              <tr key={p.id}>
                <td style={{ width: 56 }}><div style={{ width: 40 }}><ProductImage src={p.image} alt="" /></div></td>
                <td><Link to={`/admin/products/${p.id}`}>{p.name}</Link></td>
                <td>{p.category.name}</td>
                <td>{formatPrice(p.price)}</td>
                <td>{p.stock}</td>
                <td>{p.is_archived ? <span className="badge-out">Archived</span> : <span className="small">Active</span>}</td>
              </tr>
            ))}
            {data?.count === 0 && <tr><td colSpan={6} className="text-center text-body-secondary py-4">No products found.</td></tr>}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="d-flex justify-content-center align-items-center gap-3 mt-3" aria-label="Pagination">
          <button type="button" className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="small">Page {page} of {pages}</span>
          <button type="button" className="btn btn-outline-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </nav>
      )}
    </section>
  )
}
