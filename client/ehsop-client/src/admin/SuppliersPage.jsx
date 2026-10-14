import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSuppliersQuery } from './suppliersApi.js'

export default function SuppliersPage() {
  const [term, setTerm] = useState('')
  const [search, setSearch] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const { data, isFetching } = useSuppliersQuery({ search, includeArchived })

  useEffect(() => {
    const timer = setTimeout(() => setSearch(term.trim()), 300)
    return () => clearTimeout(timer)
  }, [term])

  return (
    <section>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="h3 me-auto mb-0">Suppliers</h1>
        <div className="form-check form-switch mb-0">
          <input id="suppliers-archived" type="checkbox" role="switch" className="form-check-input" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
          <label htmlFor="suppliers-archived" className="form-check-label">Show archived</label>
        </div>
        <label htmlFor="supplier-search" className="visually-hidden">Search suppliers</label>
        <input id="supplier-search" type="search" className="form-control w-auto" placeholder="Search suppliers" value={term} onChange={(e) => setTerm(e.target.value)} />
        <Link to="/admin/suppliers/new" className="btn btn-primary d-inline-flex align-items-center gap-1"><Plus size={18} aria-hidden /> New supplier</Link>
      </div>

      <div className="card p-2">
        <table className="table table-hover align-middle mb-0" aria-busy={isFetching}>
          <thead>
            <tr><th scope="col">Name</th><th scope="col">Phone</th><th scope="col">Email</th><th scope="col">Status</th></tr>
          </thead>
          <tbody>
            {data?.results.map((s) => (
              <tr key={s.id}>
                <td><Link to={`/admin/suppliers/${s.id}`}>{s.name}</Link></td>
                <td>{s.phone}</td>
                <td>{s.email}</td>
                <td>{s.is_archived ? <span className="badge-out">Archived</span> : <span className="small">Active</span>}</td>
              </tr>
            ))}
            {data?.count === 0 && <tr><td colSpan={4} className="text-center text-body-secondary py-4">No suppliers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
