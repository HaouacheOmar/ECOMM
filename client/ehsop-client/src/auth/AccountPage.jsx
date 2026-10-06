import { useState } from 'react'
import { fieldError, useChangePasswordMutation, useMeQuery } from './authApi.js'
import Field from './Field.jsx'

const EMPTY = { current_password: '', password: '', password_confirm: '' }

function ChangePasswordForm() {
  const [change, { error, isLoading, isSuccess, reset }] = useChangePasswordMutation()
  const [form, setForm] = useState(EMPTY)
  const onChange = (e) => {
    reset()
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if ((await change(form)).data) setForm(EMPTY)
  }

  return (
    <form className="card p-4 mt-3" style={{ maxWidth: 480 }} onSubmit={onSubmit} aria-label="Change password" noValidate>
      <h2 className="h5 mb-3">Change password</h2>
      <Field id="current-password" label="Current password" name="current_password" type="password" autoComplete="current-password"
        required value={form.current_password} onChange={onChange} error={fieldError(error, 'current_password')} />
      <Field id="new-password" label="New password" name="password" type="password" autoComplete="new-password"
        required value={form.password} onChange={onChange} error={fieldError(error, 'password')} />
      <Field id="confirm-password" label="Confirm new password" name="password_confirm" type="password" autoComplete="new-password"
        required value={form.password_confirm} onChange={onChange} error={fieldError(error, 'password_confirm')} />
      {isSuccess && <p role="status" className="small">Password changed. Your other sessions have been signed out.</p>}
      <button type="submit" className="btn btn-primary align-self-start" disabled={isLoading}>{isLoading ? 'Saving…' : 'Change password'}</button>
    </form>
  )
}

export default function AccountPage() {
  const { data: me, isLoading } = useMeQuery()
  return (
    <section className="py-4">
      <h1 className="h3">Account</h1>
      {isLoading ? <p className="text-body-secondary">Loading…</p> : <p>Signed in as <strong>{me?.email}</strong></p>}
      <ChangePasswordForm />
    </section>
  )
}
