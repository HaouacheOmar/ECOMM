import { useSelector } from 'react-redux'
import { Navigate, useLocation } from 'react-router-dom'
import { HOME_BY_ROLE } from './authSlice.js'

// Guards a workspace: anonymous users go to login (and come back after), other roles go to their own home.
export default function RequireRole({ role, children }) {
  const { status, user } = useSelector((state) => state.auth)
  const location = useLocation()

  if (status === 'unknown') return null
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== role) return <Navigate to={HOME_BY_ROLE[user.role]} replace />
  return children
}
