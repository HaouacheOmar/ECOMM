import { useSelector } from 'react-redux'
import { Navigate, useLocation } from 'react-router-dom'
import { HOME_BY_ROLE } from './authSlice.js'

// Guards a workspace: anonymous users go to login (and come back after), other roles go to their own home.
export default function RequireRole({ role, children }) {
  const { status, user } = useSelector((state) => state.auth)
  const location = useLocation()

  if (status === 'unknown') return null
  // During the route transition this guarded page is still mounted while exiting and sees the new
  // location; redirecting again from /login would overwrite the page to return to.
  if (status === 'anonymous') return location.pathname === '/login' ? null : <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== role) return <Navigate to={HOME_BY_ROLE[user.role]} replace />
  return children
}
