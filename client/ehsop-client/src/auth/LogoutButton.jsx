import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLogoutMutation } from './authApi.js'

export default function LogoutButton({ className = 'icon-btn' }) {
  const [logout] = useLogoutMutation()
  const navigate = useNavigate()

  const onClick = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <button type="button" className={className} onClick={onClick} aria-label="Log out" title="Log out">
      <LogOut size={className === 'icon-btn' ? 20 : 24} strokeWidth={1.75} aria-hidden />
    </button>
  )
}
