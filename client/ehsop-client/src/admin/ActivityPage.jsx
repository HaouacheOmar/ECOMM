import { useState } from 'react'
import { useEmployeeSessionsQuery, useEmployeesQuery } from './employeesApi.js'

const PAGE_SIZE = 20
const at = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

function duration(session) {
  const minutes = Math.round((new Date(session.logout_at) - new Date(session.login_at)) / 60000)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

// The Employee Session log: one row per explicit login, closed by an explicit logout (or deactivation).
export default function ActivityPage() {
  const [employee, setEmployee] = useState('')
  const [page, setPage] = useState(1)
  const { data: employees } = useEmployeesQuery(1)
  const { data, isFetching } = useEmployeeSessionsQuery({ page, ...(employee && { employee }) })
  const pages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1

  return (
    <section style={{ maxWidth: 960 }}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="h3 me-auto mb-0">Activity log</h1>
        <label htmlFor="activity-employee" className="visually-hidden">Employee</label>
        <select id="activity-employee" className="form-select w-auto" value={employee} onChange={(e) => { setEmployee(e.target.value); setPage(1) }}>
          <option value="">All employees</option>
          {employees?.results.map((e) => <option key={e.id} value={e.id}>{e.email}</option>)}
        </select>
      </div>

      <div className="card p-2 table-responsive">
        <table className="table align-middle mb-0" aria-busy={isFetching}>
          <thead>
            <tr><th scope="col">Employee</th><th scope="col">Logged in</th><th scope="col">Logged out</th><th scope="col">Duration</th></tr>
          </thead>
          <tbody>
            {data?.results.map((s) => (
              <tr key={s.id}>
                <td>
                  <span className="d-block">{s.employee.name || s.employee.email}</span>
                  {s.employee.name && <span className="small text-body-secondary">{s.employee.email}</span>}
                </td>
                <td className="small">{at.format(new Date(s.login_at))}</td>
                <td className="small">
                  {s.logout_at ? at.format(new Date(s.logout_at)) : <span className="status-badge status-confirmed">Signed in</span>}
                </td>
                <td className="small">{s.logout_at ? duration(s) : '—'}</td>
              </tr>
            ))}
            {data?.count === 0 && <tr><td colSpan={4} className="text-center text-body-secondary py-4">No sessions yet.</td></tr>}
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
