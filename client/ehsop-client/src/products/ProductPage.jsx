import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AddToCartButton from '../cart/AddToCartButton.jsx'
import { ProductImage, Rating } from './bits.jsx'
import { formatPrice } from './formatPrice.js'
import { useProductQuery } from './productsApi.js'
import './products.css'

function stockLabel(stock) {
  if (stock <= 0) return 'Out of stock'
  if (stock <= 5) return `Only ${stock} left`
  return 'In stock'
}

export default function ProductPage() {
  const { id } = useParams()
  const { data: product, isLoading, isError } = useProductQuery(id)
  const [selected, setSelected] = useState(0)
  const [quantity, setQuantity] = useState(1)

  if (isLoading) return <p className="text-body-secondary">Loading…</p>
  if (isError) return <p>This product isn’t available. <Link to="/products">Back to the shop</Link></p>

  const images = product.images
  const main = images[selected]?.image ?? null

  return (
    <article className="product-detail">
      <Link to="/products" className="d-inline-flex align-items-center gap-1 mb-3 text-body-secondary text-decoration-none">
        <ArrowLeft size={16} aria-hidden /> Back to the shop
      </Link>
      <div className="row g-4">
        <div className="col-md-6">
          <div className="card p-2"><ProductImage src={main} alt={product.name} /></div>
          {images.length > 1 && (
            <div className="thumbs mt-2" role="group" aria-label="Product photos">
              {images.map((img, i) => (
                <button key={img.id} type="button" className="thumb" aria-pressed={i === selected} aria-label={`Photo ${i + 1}`} onClick={() => setSelected(i)}>
                  <img src={img.image} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="col-md-6">
          <p className="text-body-secondary small mb-1">{product.category.name}</p>
          <h1 className="h2">{product.name}</h1>
          <Rating value={product.rating_avg} count={product.review_count} />
          <p className="product-price fs-3 my-3">{formatPrice(product.price)}</p>
          <p className={product.in_stock ? 'stock-ok' : 'badge-out d-inline-block'}>{stockLabel(product.stock)}</p>
          {product.in_stock && (
            <div className="d-flex align-items-end gap-2 my-3">
              <div>
                <label htmlFor="qty" className="form-label small">Quantity</label>
                <input id="qty" type="number" className="form-control" style={{ width: 96 }} min={1} max={product.stock} value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock, Number(e.target.value) || 1)))} />
              </div>
              <AddToCartButton product={product} quantity={quantity} className="btn btn-primary px-4" label="Add to cart" />
            </div>
          )}
          {product.description && <p className="mt-3" style={{ whiteSpace: 'pre-line' }}>{product.description}</p>}
        </div>
      </div>
    </article>
  )
}
