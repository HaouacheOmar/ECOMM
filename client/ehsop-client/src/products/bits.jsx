import { Package, Star } from 'lucide-react'
import { Link } from 'react-router-dom'

// Five stars, filled up to the (rounded) value; decorative, so pair it with a text label.
export function Stars({ value, size = 12 }) {
  const rounded = Math.round(Number(value))
  return [1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} aria-hidden fill={n <= rounded ? 'currentColor' : 'none'} />)
}

export function Rating({ value, count, size }) {
  return (
    <span className="rating" aria-label={count ? `Rated ${Number(value).toFixed(1)} out of 5 from ${count} review${count === 1 ? '' : 's'}` : 'No reviews yet'}>
      <Stars value={count ? value : 0} size={size} />
      <span className="ms-1">{count ? `(${count})` : 'No reviews'}</span>
    </span>
  )
}

export function ProductImage({ src, alt }) {
  return src
    ? <img className="product-img" src={src} alt={alt} loading="lazy" />
    : <div className="product-img product-img-empty" role="img" aria-label={alt}><Package size={32} aria-hidden /></div>
}

// The reference's category pill: a 16px round photo of the Category, then its name. A link on the
// home page; a toggle (aria-pressed) when it filters the catalog.
export function CategoryPill({ category, to, pressed, onClick }) {
  const body = (
    <>
      {category.image ? <img className="chip-icon" src={category.image} alt="" /> : <span className="chip-icon" aria-hidden />}
      {category.name}
    </>
  )
  return to
    ? <Link to={to} className="chip">{body}</Link>
    : <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>{body}</button>
}
