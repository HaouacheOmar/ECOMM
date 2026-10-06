import { useResendVerificationMutation } from './authApi.js'

export default function ResendVerificationButton({ className = 'btn btn-outline-secondary btn-sm' }) {
  const [resend, { isLoading, data, error }] = useResendVerificationMutation()
  return (
    <span className="d-inline-flex align-items-center gap-2 flex-wrap">
      <button type="button" className={className} onClick={() => resend()} disabled={isLoading || !!data}>
        {isLoading ? 'Sending…' : 'Resend email'}
      </button>
      <span role="status" className="small">{data?.detail ?? error?.data?.detail ?? ''}</span>
    </span>
  )
}
