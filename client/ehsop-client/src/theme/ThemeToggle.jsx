import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'

const KEY = 'eshop-theme'

// index.html applies the saved or system theme before first paint; this flips it and remembers the choice.
export default function ThemeToggle({ className = 'icon-btn' }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.bsTheme ?? 'light')
  const next = theme === 'dark' ? 'light' : 'dark'

  const toggle = () => {
    document.documentElement.dataset.bsTheme = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // storage blocked: the toggle still works for this page view
    }
    setTheme(next)
  }

  return (
    <button type="button" className={className} onClick={toggle} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      {theme === 'dark' ? <Sun size={22} strokeWidth={1.75} aria-hidden /> : <Moon size={22} strokeWidth={1.75} aria-hidden />}
    </button>
  )
}
