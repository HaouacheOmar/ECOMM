import { NavLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import LogoutButton from '../auth/LogoutButton.jsx'
import ThemeToggle from '../theme/ThemeToggle.jsx'

// The reference's persistent 64px icon rail: the wordmark mark, the workspace's icons, then the theme
// switch, log out and the profile avatar at the bottom. On phones it is a bottom bar (theme.css).
export default function IconRail({ label, home, children, account }) {
  const signedIn = useSelector((state) => state.auth.status === 'authenticated')
  return (
    <nav className="icon-rail" aria-label={label}>
      <NavLink to={home} end className="rail-mark wordmark" aria-label="eshop home" title="Home">e</NavLink>
      <div className="rail-group">{children}</div>
      <div className="rail-group rail-end">
        <ThemeToggle className="rail-item" />
        {signedIn && <LogoutButton className="rail-item" />}
        {account}
      </div>
    </nav>
  )
}

export function RailLink({ to, label, Icon, end }) {
  return (
    <NavLink to={to} end={end} className="rail-item" aria-label={label} title={label}>
      <Icon size={24} strokeWidth={1.75} aria-hidden />
    </NavLink>
  )
}

// The signed-in user's initials in the 32px ringed avatar, linking to their Account page.
export function RailAvatar({ to }) {
  const user = useSelector((state) => state.auth.user)
  return (
    <NavLink to={to} className="rail-item" aria-label="Account" title="Account">
      <span className="rail-avatar" aria-hidden>{user?.email?.[0] ?? '?'}</span>
    </NavLink>
  )
}
