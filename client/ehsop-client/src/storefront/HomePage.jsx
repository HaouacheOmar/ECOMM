import { ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import ProductCard from '../products/ProductCard.jsx'
import { useBestsellersQuery, useRecommendationsQuery } from '../products/productsApi.js'
import '../products/products.css'

function Shelf({ id, title, products }) {
  if (!products?.length) return null
  return (
    <section className="shelf" aria-labelledby={id}>
      <h2 id={id} className="shelf-title">
        <Link to="/products">{title} <ChevronRight size={18} aria-hidden /></Link>
      </h2>
      <motion.div className="product-grid" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.04 } } }}>
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
      </motion.div>
    </section>
  )
}

export default function HomePage() {
  const isCustomer = useSelector((state) => state.auth.user?.role === 'CUSTOMER')
  const { data: bestsellers } = useBestsellersQuery()
  const { data: recommended } = useRecommendationsQuery(undefined, { skip: !isCustomer })

  return (
    <>
      <section className="py-5 text-center">
        <h1 className="display-6 mb-3">Home &amp; lifestyle, made to last</h1>
        <p className="text-body-secondary mb-4">Kitchen, home decor, textiles, bags and stationery.</p>
        <Link to="/products" className="btn btn-primary btn-lg px-4">Shop the collection</Link>
      </section>
      {isCustomer && <Shelf id="recommended-title" title="Recommended for you" products={recommended} />}
      <Shelf id="bestsellers-title" title="Bestsellers" products={bestsellers} />
    </>
  )
}
