import { MailWarning } from 'lucide-react'
import { useSelector } from 'react-redux'
import ResendVerificationButton from './ResendVerificationButton.jsx'

// Reminds an unverified Customer that ordering needs a verified email.
export default function VerifyEmailBanner() {
  const user = useSelector((state) => state.auth.user)
  if (user?.role !== 'CUSTOMER' || user.is_email_verified) return null
  return (
    <div className="verify-banner" role="region" aria-label="Email verification">
      <div className="container-xl d-flex align-items-center gap-2 flex-wrap py-2">
        <MailWarning size={18} aria-hidden />
        <span className="me-auto">Check your inbox to verify <strong>{user.email}</strong> before placing an order.</span>
        <ResendVerificationButton />
      </div>
    </div>
  )
}
