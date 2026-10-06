import { KeyRound, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { detailError, fieldError } from './catalogApi.js'
import { useCreateEmployeeMutation, useEmployeesQuery, useSetEmployeeActiveMutation, useSetEmployeePasswordMutation } from './employeesApi.js'

const PAGE_SIZE = 20
const EMPTY = { first_name: '', last_name: '', email: '', password: '' }
const joined = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })
const fullName = (e) => [e.first_name, e.last_name].filter(Boolean).join(' ') || '—'

function NewEmployeeForm() {
  const [create, { isLoading, error }] = useCreateEmployeeMutation()
  const [form, setForm] = useState(EMPTY)
  const [created, setCreated] = useState(null)
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const onSubmit = async (e) => {
    e.preventDefault()
    const { data } = await create(form)
    if (data) {
      setCreated(data.email)
      setForm(EMPTY)
    }
  }

  const field = (name, label, props = {}) => {
    const message = fieldError(error, name)
    return (
      <div className="col-md-6">
        <label htmlFor={`new-employee-${name}`} className="form-label small">{label}</label>
        <input id={`new-employee-${name}`} name={name} className={`form-control${message ? ' is-invalid' : ''}`}
          value={form[name]} onChange={onChange} aria-describedby={message ? `new-employee-${name}-error` : undefined} {...props} />
        {message && <div id={`new-employee-${name}-error`} className="text-danger small mt-1">{message}</div>}
      </div>
    )
  }

  const general = error && !Object.keys(EMPTY).some((f) => fieldError(error, f))
  return (
    <form className="card p-3 mb-3" onSubmit={onSubmit} aria-label="New employee" noValidate>
      <h2 className="h6">New employee</h2>
      <div className="row g-2">
        {field('first_name', 'First name', { autoComplete: 'off' })}
        {field('last_name', 'Last name', { autoComplete: 'off' })}
        {field('email', 'Email', { type: 'email', required: true, autoComplete: 'off' })}
        {field('password', 'Initial password', { type: 'password', required: true, autoComplete: 'new-password' })}
      </div>
      {general && <div role="alert" className="text-danger small mt-2">{detailError(error)}</div>}
      <div className="d-flex align-items-center gap-3 mt-3">
        <button type="submit" className="btn btn-primary d-inline-flex align-items-center gap-1" disabled={isLoading}>
          <UserPlus size={18} aria-hidden /> Create employee
        </button>
        {created && <span role="status" className="small text-body-secondary">{created} can now log in to the desk.</span>}
      </div>
    </form>
  )
}

function PasswordForm({ employee, onDone }) {
  const [setPassword, { isLoading, error }] = useSetEmployeePasswordMutation()
  const [password, setValue] = useState('')
  const id = `password-${employee.id}`

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!(await setPassword({ id: employee.id, password })).error) onDone(`New password set for ${employee.email}.`)
  }

  return (
    <form className="d-flex flex-wrap align-items-start gap-2" onSubmit={onSubmit} aria-label={`Set password for ${employee.email}`}>
      <div className="flex-grow-1">
        <label htmlFor={id} className="visually-hidden">New password for {employee.email}</label>
        <input id={id} type="password" className="form-control form-control-sm" placeholder="New password" autoComplete="new-password"
          value={password} onChange={(e) => setValue(e.target.value)} required />
        {error && <div role="alert" className="text-danger small mt-1">{fieldError(error, 'password') ?? detailError(error)}</div>}
      </div>
      <button type="submit" className="btn btn-primary btn-sm" disabled={!password || isLoading}>Save password</button>
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onDone(null)}>Cancel</button>
    </form>
  )
}

function EmployeeRow({ employee }) {
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState(null)
  const [setActive, { isLoading }] = useSetEmployeeActiveMutation()

  const onToggle = () => {
    const active = !employee.is_active
    if (active || window.confirm(`Deactivate ${employee.email}? They are signed out at once and can no longer log in.`)) {
      setActive({ id: employee.id, active })
    }
  }

  return (
    <>
      <tr>
        <td>{fullName(employee)}</td>
        <td className="small">{employee.email}</td>
        <td>
          <span className={`status-badge ${employee.is_active ? 'status-confirmed' : 'status-cancelled'}`}>
            {employee.is_active ? 'Active' : 'Deactivated'}
          </span>
        </td>
        <td className="small">{joined.format(new Date(employee.date_joined))}</td>
        <td className="text-end text-nowrap">
          <button type="button" className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1 me-2"
            aria-expanded={editing} onClick={() => { setEditing(!editing); setNotice(null) }}>
            <KeyRound size={16} aria-hidden /> Set password
          </button>
          <button type="button" className={`btn btn-sm ${employee.is_active ? 'btn-outline-danger' : 'btn-outline-secondary'}`}
            disabled={isLoading} onClick={onToggle}>
            {employee.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
        </td>
      </tr>
      {(editing || notice) && (
        <tr>
          <td colSpan={5}>
            {editing
              ? <PasswordForm employee={employee} onDone={(message) => { setEditing(false); setNotice(message) }} />
              : <p role="status" className="small mb-0">{notice}</p>}
          </td>
        </tr>
      )}
    </>
  )
}

export default function EmployeesPage() {
  const [page, setPage] = useState(1)
  const { data, isFetching } = useEmployeesQuery(page)
  const pages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1

  return (
    <section style={{ maxWidth: 960 }}>
      <h1 className="h3 mb-3">Employees</h1>
      <NewEmployeeForm />
      <div className="card p-2 table-responsive">
        <table className="table align-middle mb-0" aria-busy={isFetching}>
          <thead>
            <tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr>
          </thead>
          <tbody>
            {data?.results.map((e) => <EmployeeRow key={e.id} employee={e} />)}
            {data?.count === 0 && <tr><td colSpan={5} className="text-center text-body-secondary py-4">No employees yet.</td></tr>}
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
