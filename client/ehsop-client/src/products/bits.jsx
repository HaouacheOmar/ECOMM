import { Package, Star } from 'lucide-react'

// Five stars, filled up to the (rounded) value; decorative, so pair it with a text label.
export function Stars({ value, size = 12 }) {
  const rounded = Math.round(Number(value))
  return [1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} aria-hidden fill={n <= rounded ? 'currentColor' : 'none'} />)
}

export function Rating({ value, count }) {
  return (
    <span className="rating" aria-label={count ? `Rated ${Number(value).toFixed(1)} out of 5 from ${count} review${count === 1 ? '' : 's'}` : 'No reviews yet'}>
      <Stars value={count ? value : 0} />
      <span className="ms-1">{count ? `(${count})` : 'No reviews'}</span>
    </span>
  )
}

export function ProductImage({ src, alt }) {
  return src
    ? <img className="product-img" src={src} alt={alt} loading="lazy" />
    : <div className="product-img product-img-empty" role="img" aria-label={alt}><Package size={32} aria-hidden /></div>
}
