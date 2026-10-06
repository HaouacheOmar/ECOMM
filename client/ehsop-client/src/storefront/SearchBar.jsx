import { ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

const DEBOUNCE_MS = 300

// The site-wide search: typing updates the catalog after a pause; Enter goes there immediately.
export default function SearchBar() {
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const current = params.get('search') ?? ''
  const [term, setTerm] = useState(current)
  // Follow the URL when the search changes elsewhere (Back button, links).
  const [seen, setSeen] = useState(current)
  if (current !== seen) {
    setSeen(current)
    setTerm(current)
  }

  const go = (value) => {
    // Keep the catalog's category and sort when already browsing it.
    const next = new URLSearchParams(pathname === '/products' ? params : undefined)
    next.delete('page')
    if (value) next.set('search', value)
    else next.delete('search')
    navigate(`/products?${next}`, { replace: pathname === '/products' })
  }

  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const onChange = (e) => {
    const value = e.target.value
    setTerm(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (value.trim() !== current) go(value.trim())
    }, DEBOUNCE_MS)
  }

  return (
    <form role="search" className="search-pill" onSubmit={(e) => { e.preventDefault(); clearTimeout(timer.current); go(term.trim()) }}>
      <label htmlFor="site-search" className="visually-hidden">Search products</label>
      <input id="site-search" type="search" className="form-control" placeholder="What are you shopping for today?" value={term} onChange={onChange} />
      <button type="submit" className="search-submit" aria-label="Search">
        <ArrowRight size={20} aria-hidden />
      </button>
    </form>
  )
}
