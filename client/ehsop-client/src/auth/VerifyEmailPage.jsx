import { CircleCheck, CircleX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useParams } from 'react-router-dom'
import { authApi, useVerifyEmailMutation } from './authApi.js'
import ResendVerificationButton from './ResendVerificationButton.jsx'

export default function VerifyEmailPage() {
  const { token } = useParams()
  const dispatch = useDispatch()
  const signedIn = useSelector((state) => state.auth.status === 'authenticated')
  const [verify, { isSuccess, isError, error }] = useVerifyEmailMutation()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    verify(token).then(({ data }) => {
      // Pick up the verified status in this session's tokens.
      if (data) dispatch(authApi.endpoints.restoreSession.initiate())
    })
  }, [token, verify, dispatch])

  return (
    <div className="card mx-auto p-4 p-md-5 text-center" style={{ maxWidth: 480 }}>
      {isSuccess && (
        <>
          <CircleCheck size={40} className="mx-auto mb-3 presence-online" aria-hidden />
          <h1 className="h4">Your email is verified</h1>
          <p className="text-body-secondary">You can now place orders.</p>
          <Link to="/products" className="btn btn-primary">Continue shopping</Link>
        </>
      )}
      {isError && (
        <>
          <CircleX size={40} className="mx-auto mb-3 presence-offline" aria-hidden />
          <h1 className="h4">We couldn’t verify your email</h1>
          <p role="alert" className="text-body-secondary">{error.data?.detail ?? 'Something went wrong.'}</p>
          {signedIn ? <ResendVerificationButton /> : <Link to="/login" className="btn btn-primary">Log in to get a new link</Link>}
        </>
      )}
      {!isSuccess && !isError && <p className="text-body-secondary mb-0" role="status">Verifying your email…</p>}
    </div>
  )
}
