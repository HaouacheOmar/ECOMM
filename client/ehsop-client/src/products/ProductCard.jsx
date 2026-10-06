import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { ProductImage, Rating } from './bits.jsx'
import { formatPrice } from './formatPrice.js'

const cardVariants = {
  hidden: { opacity: 0, transform: 'translateY(12px)' },
  shown: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.25, ease: 'easeOut' } },
}

export default function ProductCard({ product }) {
  return (
    <motion.article variants={cardVariants} className="product-card card" aria-label={product.name}>
      <Link to={`/products/${product.id}`} className="stretched-link text-reset text-decoration-none">
        <ProductImage src={product.image} alt={product.name} />
        <h2 className="product-name">{product.name}</h2>
      </Link>
      <Rating value={product.rating_avg} count={product.review_count} />
      <div className="d-flex justify-content-between align-items-center mt-2">
        <span className="product-price">{formatPrice(product.price)}</span>
        {!product.in_stock && <span className="badge-out">Out of stock</span>}
      </div>
    </motion.article>
  )
}
