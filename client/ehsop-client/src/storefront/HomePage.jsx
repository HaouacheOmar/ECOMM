import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { CategoryPill, ProductImage, Stars } from '../products/bits.jsx'
import ProductCard from '../products/ProductCard.jsx'
import { useBestsellersQuery, useCategoriesQuery, useRecommendationsQuery } from '../products/productsApi.js'
import SearchBar from './SearchBar.jsx'
import '../products/products.css'
import './home.css'

// Where the hero cards float: offsets (% of the hero width), tilt and idle-float timing.
const CONSTELLATION = [
  { left: 4, top: 26, tilt: -6, delay: 0 },
  { left: 21, top: 2, tilt: 4, delay: 1.2 },
  { left: 40, top: 14, tilt: -2, delay: 0.6 },
  { left: 59, top: 0, tilt: 5, delay: 1.8 },
  { left: 77, top: 24, tilt: -4, delay: 0.9 },
]

// The reference's hero: product cards float in a loose, slightly overlapping constellation above the
// wordmark. Entrance staggers in; then each card drifts a few pixels on its own slow loop
// (transform only; MotionConfig turns it off for reduced-motion users).
function Constellation({ products }) {
  return (
    <div className="constellation" aria-label="Popular right now" role="group">
      {products.slice(0, CONSTELLATION.length).map((p, i) => {
        const spot = CONSTELLATION[i]
        return (
          <motion.div key={p.id} className="hero-card-slot" style={{ left: `${spot.left}%`, top: `${spot.top}%` }}
            initial={{ opacity: 0, transform: `rotate(${spot.tilt}deg) translateY(24px)` }}
            animate={{ opacity: 1, transform: `rotate(${spot.tilt}deg) translateY(0px)` }}
            transition={{ type: 'spring', bounce: 0.2, visualDuration: 0.6, delay: 0.08 * i }}>
            <motion.div
              animate={{ transform: ['translateY(0px)', 'translateY(-10px)', 'translateY(0px)'] }}
              transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity, delay: spot.delay }}>
              <Link to={`/products/${p.id}`} className="hero-card card" aria-label={p.name}>
                <ProductImage src={p.image} alt="" />
                <span className="hero-card-name">{p.name}</span>
                <span className="hero-card-rating" aria-hidden><Stars value={p.review_count ? p.rating_avg : 0} size={9} /></span>
              </Link>
            </motion.div>
          </motion.div>
        )
      })}
    </div>
  )
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// A horizontal product rail. It scrolls inside itself (never the page); the round arrows appear at
// the edges only when there is more to see.
function ProductRail({ id, title, products }) {
  const track = useRef(null)
  const [edges, setEdges] = useState({ start: true, end: true })

  const measure = useCallback(() => {
    const el = track.current
    if (el) setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure, products])

  if (!products?.length) return null
  const scroll = (direction) =>
    track.current.scrollBy({ left: direction * track.current.clientWidth * 0.8, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })

  return (
    <section className="shelf" aria-labelledby={id}>
      <h2 id={id} className="shelf-title">
        <Link to="/products">{title} <ChevronRight size={16} aria-hidden /></Link>
      </h2>
      <div className="rail">
        <motion.div ref={track} className="rail-track" onScroll={measure} initial="hidden" animate="shown"
          variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
          {products.map((p) => <div key={p.id} className="rail-cell"><ProductCard product={p} /></div>)}
        </motion.div>
        {!edges.start && (
          <button type="button" className="rail-arrow rail-arrow-prev" aria-label={`Scroll ${title} back`} onClick={() => scroll(-1)}>
            <ChevronLeft size={16} aria-hidden />
          </button>
        )}
        {!edges.end && (
          <button type="button" className="rail-arrow" aria-label={`Scroll ${title} forward`} onClick={() => scroll(1)}>
            <ChevronRight size={16} aria-hidden />
          </button>
        )}
      </div>
    </section>
  )
}

// "Shop by category": the reference's 2-column hero-and-grid composition. The first Category is a
// large photo with its name in white display type; the others are photo tiles with a frosted label.
function CategoryBand({ categories }) {
  const shown = categories.filter((c) => c.image).slice(0, 5)
  if (shown.length < 2) return null
  const [lead, ...rest] = shown
  return (
    <section className="shelf" aria-labelledby="categories-title">
      <h2 id="categories-title" className="shelf-title">
        <Link to="/products">Shop by category <ChevronRight size={16} aria-hidden /></Link>
      </h2>
      <div className="category-band">
        <Link to={`/products?category=${lead.id}`} className="category-hero">
          <img src={lead.image} alt="" loading="lazy" />
          <span className="category-hero-name">{lead.name}</span>
        </Link>
        <div className="category-tiles">
          {rest.map((c) => (
            <Link key={c.id} to={`/products?category=${c.id}`} className="category-tile">
              <img src={c.image} alt="" loading="lazy" />
              <span className="category-tile-label">{c.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  const isCustomer = useSelector((state) => state.auth.user?.role === 'CUSTOMER')
  const { data: bestsellers = [] } = useBestsellersQuery()
  const { data: categories = [] } = useCategoriesQuery()
  const { data: recommended } = useRecommendationsQuery(undefined, { skip: !isCustomer })

  return (
    <>
      <section className="hero">
        <Constellation products={bestsellers.filter((p) => p.image)} />
        <h1 className="hero-wordmark">eshop</h1>
        <p className="hero-tagline">Home and lifestyle goods, made to last.</p>
        <SearchBar />
        <nav className="chips hero-chips" aria-label="Categories">
          {categories.map((c) => <CategoryPill key={c.id} category={c} to={`/products?category=${c.id}`} />)}
        </nav>
      </section>
      {isCustomer && <ProductRail id="recommended-title" title="Recommended for you" products={recommended} />}
      <ProductRail id="bestsellers-title" title="Bestsellers" products={bestsellers} />
      <CategoryBand categories={categories} />
    </>
  )
}
