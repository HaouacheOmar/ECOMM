import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useLoginMutation, useRegisterMutation } from './authApi.js'
import { HOME_BY_ROLE } from './authSlice.js'

const fieldError = (error, field) => error?.data?.[field]?.[0]

function Field({ id, label, error, ...input }) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label">{label}</label>
      <input id={id} className={`form-control${error ? ' is-invalid' : ''}`} aria-describedby={error ? `${id}-error` : undefined} {...input} />
      {error && <div id={`${id}-error`} className="text-danger small mt-1">{error}</div>}
    </div>
  )
}

// Only return to the requested page if it belongs to this role's workspace.
function destination(from, role) {
  const home = HOME_BY_ROLE[role]
  if (!from) return home
  return (home === '/' ? !/^\/(admin|desk)/.test(from) : from.startsWith(home)) ? from : home
}

function LoginForm({ onBusy, onDone }) {
  const [login, { isLoading }] = useLoginMutation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    onBusy(true)
    try {
      onDone((await login(form).unwrap()).user)
    } catch (err) {
      onBusy(false)
      setError(err.data?.detail ?? 'Could not log in. Please try again.')
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Field id="login-email" label="Email" name="email" type="email" autoComplete="email" required value={form.email} onChange={onChange} />
      <Field id="login-password" label="Password" name="password" type="password" autoComplete="current-password" required value={form.password} onChange={onChange} />
      {error && <div role="alert" className="text-danger small mb-3">{error}</div>}
      <button type="submit" className="btn btn-primary w-100" disabled={isLoading}>{isLoading ? 'Logging in…' : 'Log in'}</button>
    </form>
  )
}

function RegisterForm({ onBusy, onDone }) {
  const [register, { isLoading, error }] = useRegisterMutation()
  const [form, setForm] = useState({ email: '', password: '', password_confirm: '' })
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const onSubmit = async (e) => {
    e.preventDefault()
    onBusy(true)
    const { data } = await register(form)
    if (data) onDone(data.user)
    else onBusy(false)
  }

  const general = error && !['email', 'password', 'password_confirm'].some((f) => fieldError(error, f))
  return (
    <form onSubmit={onSubmit} noValidate>
      <Field id="reg-email" label="Email" name="email" type="email" autoComplete="email" required value={form.email} onChange={onChange} error={fieldError(error, 'email')} />
      <Field id="reg-password" label="Password" name="password" type="password" autoComplete="new-password" required value={form.password} onChange={onChange} error={fieldError(error, 'password')} />
      <Field id="reg-confirm" label="Confirm password" name="password_confirm" type="password" autoComplete="new-password" required value={form.password_confirm} onChange={onChange} error={fieldError(error, 'password_confirm')} />
      {general && <div role="alert" className="text-danger small mb-3">{error.data?.detail ?? 'Could not create your account. Please try again.'}</div>}
      <button type="submit" className="btn btn-primary w-100" disabled={isLoading}>{isLoading ? 'Creating account…' : 'Create account'}</button>
    </form>
  )
}

export default function LoginPage() {
  const { status, user } = useSelector((state) => state.auth)
  const navigate = useNavigate()
  const from = useLocation().state?.from
  const [tab, setTab] = useState('login')
  const [leaving, setLeaving] = useState(false)

  if (status === 'authenticated' && !leaving) return <Navigate to={HOME_BY_ROLE[user.role]} replace />

  // While a login/registration is in flight, this page navigates itself (to the requested page),
  // so the "already signed in" redirect above must not race it.
  const onDone = (loggedIn) => navigate(destination(from, loggedIn.role), { replace: true })

  const tabs = [['login', 'Log in'], ['register', 'Register']]
  return (
    <div className="card mx-auto p-4 p-md-5" style={{ maxWidth: 440 }}>
      <div role="tablist" aria-label="Account" className="auth-tabs mb-4">
        {tabs.map(([key, label]) => (
          <button key={key} id={`tab-${key}`} type="button" role="tab" aria-selected={tab === key} aria-controls={`panel-${key}`}
            className="auth-tab" onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'login' ? <LoginForm onBusy={setLeaving} onDone={onDone} /> : <RegisterForm onBusy={setLeaving} onDone={onDone} />}
      </div>
    </div>
  )
}
