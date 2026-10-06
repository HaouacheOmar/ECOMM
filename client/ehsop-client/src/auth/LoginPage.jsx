import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useLoginMutation } from './authApi.js'
import { HOME_BY_ROLE } from './authSlice.js'

export default function LoginPage() {
  const [login, { isLoading }] = useLoginMutation()
  const { status, user } = useSelector((state) => state.auth)
  const navigate = useNavigate()
  const from = useLocation().state?.from
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)

  if (status === 'authenticated' && !isLoading) return <Navigate to={HOME_BY_ROLE[user.role]} replace />

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const { user: loggedIn } = await login(form).unwrap()
      const home = HOME_BY_ROLE[loggedIn.role]
      // Only return to the requested page if it belongs to this role's workspace.
      navigate(from && (home === '/' ? !/^\/(admin|desk)/.test(from) : from.startsWith(home)) ? from : home, { replace: true })
    } catch (err) {
      setError(err.data?.detail ?? 'Could not log in. Please try again.')
    }
  }

  return (
    <div className="card mx-auto p-4 p-md-5" style={{ maxWidth: 440 }}>
      <h1 className="h3 mb-4">Log in</h1>
      <form onSubmit={onSubmit} noValidate>
        <div className="mb-3">
          <label htmlFor="login-email" className="form-label">Email</label>
          <input id="login-email" name="email" type="email" autoComplete="email" required className="form-control" value={form.email} onChange={onChange} />
        </div>
        <div className="mb-3">
          <label htmlFor="login-password" className="form-label">Password</label>
          <input id="login-password" name="password" type="password" autoComplete="current-password" required className="form-control" value={form.password} onChange={onChange} />
        </div>
        {error && <div role="alert" className="text-danger small mb-3">{error}</div>}
        <button type="submit" className="btn btn-primary w-100" disabled={isLoading}>
          {isLoading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  )
}
