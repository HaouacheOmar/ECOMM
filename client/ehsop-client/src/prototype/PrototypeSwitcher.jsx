// PROTOTYPE (throwaway): floating variant switcher. Not for production.
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export default function PrototypeSwitcher({ variants }) {
  const [params, setParams] = useSearchParams()
  const keys = Object.keys(variants)
  const current = params.get('variant') ?? keys[0]
  const go = (step) => {
    const next = keys[(keys.indexOf(current) + step + keys.length) % keys.length]
    const p = new URLSearchParams(params)
    p.set('variant', next)
    setParams(p, { replace: true })
  }

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (t.closest?.('input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (import.meta.env.PROD) return null
  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
      background: '#111', color: '#fff', borderRadius: 999, padding: '6px 10px',
      boxShadow: '0 4px 16px rgba(0,0,0,.35)', display: 'flex', gap: 10, alignItems: 'center', fontSize: 14,
    }}>
      <button className="btn btn-sm btn-dark" onClick={() => go(-1)} aria-label="Previous variant">←</button>
      <span>{current} ({variants[current]})</span>
      <button className="btn btn-sm btn-dark" onClick={() => go(1)} aria-label="Next variant">→</button>
    </div>
  )
}
