import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fieldError, useForgotPasswordMutation } from './authApi.js'
import Field from './Field.jsx'

// The answer is the same whether or not the email has an account.
export default function ForgotPasswordPage() {
  const [forgot, { data, error, isLoading }] = useForgotPasswordMutation()
  const [email, setEmail] = useState('')

  return (
    <div className="card mx-auto p-4 p-md-5" style={{ maxWidth: 440 }}>
      <h1 className="h4">Reset your password</h1>
      {data ? (
        <>
          <p role="status">{data.detail}</p>
          <p className="small text-body-secondary">The link works once and expires in 1 hour.</p>
          <Link to="/login">Back to log in</Link>
        </>
      ) : (
        <form noValidate onSubmit={(e) => { e.preventDefault(); forgot(email.trim()) }}>
          <p className="text-body-secondary small">Enter your account's email and we'll send you a link to choose a new password.</p>
          <Field id="forgot-email" label="Email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} error={error && (fieldError(error, 'email') ?? error.data?.[0] ?? 'Enter a valid email address.')} />
          <button type="submit" className="btn btn-primary w-100" disabled={isLoading || !email.trim()}>{isLoading ? 'Sending…' : 'Send reset link'}</button>
          <p className="text-center small mt-3 mb-0"><Link to="/login">Back to log in</Link></p>
        </form>
      )}
    </div>
  )
}
