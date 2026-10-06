import { Package, Star } from 'lucide-react'

export function Rating({ value, count }) {
  const rounded = Math.round(Number(value))
  return (
    <span className="rating" aria-label={count ? `Rated ${Number(value).toFixed(1)} out of 5 from ${count} reviews` : 'No reviews yet'}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={12} aria-hidden fill={n <= rounded && count ? 'currentColor' : 'none'} />
      ))}
      <span className="ms-1">{count ? `(${count})` : 'No reviews'}</span>
    </span>
  )
}

export function ProductImage({ src, alt }) {
  return src
    ? <img className="product-img" src={src} alt={alt} loading="lazy" />
    : <div className="product-img product-img-empty" role="img" aria-label={alt}><Package size={32} aria-hidden /></div>
}
