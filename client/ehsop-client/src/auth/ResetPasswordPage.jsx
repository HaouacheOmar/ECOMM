import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fieldError, useResetPasswordMutation } from './authApi.js'
import Field from './Field.jsx'

// Opened from the emailed link: /reset/:uid/:token.
export default function ResetPasswordPage() {
  const { uid, token } = useParams()
  const [reset, { data, error, isLoading }] = useResetPasswordMutation()
  const [form, setForm] = useState({ password: '', password_confirm: '' })
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  if (data) {
    return (
      <div className="card mx-auto p-4 p-md-5 text-center" style={{ maxWidth: 440 }}>
        <h1 className="h4">Password changed</h1>
        <p role="status" className="text-body-secondary">{data.detail}</p>
        <Link to="/login" className="btn btn-primary">Log in</Link>
      </div>
    )
  }

  const badLink = error?.data?.code === 'invalid_link'
  return (
    <div className="card mx-auto p-4 p-md-5" style={{ maxWidth: 440 }}>
      <h1 className="h4">Choose a new password</h1>
      {badLink ? (
        <>
          <p role="alert" className="text-danger">{error.data.detail}</p>
          <Link to="/forgot" className="btn btn-primary w-100">Send a new link</Link>
        </>
      ) : (
        <form noValidate onSubmit={(e) => { e.preventDefault(); reset({ uid, token, ...form }) }}>
          <Field id="reset-password" label="New password" name="password" type="password" autoComplete="new-password" required
            value={form.password} onChange={onChange} error={fieldError(error, 'password')} />
          <Field id="reset-confirm" label="Confirm new password" name="password_confirm" type="password" autoComplete="new-password" required
            value={form.password_confirm} onChange={onChange} error={fieldError(error, 'password_confirm')} />
          <button type="submit" className="btn btn-primary w-100" disabled={isLoading}>{isLoading ? 'Saving…' : 'Change password'}</button>
        </form>
      )}
    </div>
  )
}
