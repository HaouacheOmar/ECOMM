import { Star } from 'lucide-react'
import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useLocation } from 'react-router-dom'
import { Stars } from './bits.jsx'
import { useMyReviewQuery, usePostReviewMutation, useProductReviewsQuery } from './productsApi.js'

const PAGE_SIZE = 20
const MAX_TEXT = 2000
const on = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })

// Five radio buttons drawn as stars; hovering previews the rating.
function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <fieldset className="star-input" onMouseLeave={() => setHover(0)}>
      <legend className="form-label small">Your rating</legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className="star-option" onMouseEnter={() => setHover(n)}>
          <input type="radio" name="rating" value={n} checked={value === n} onChange={() => onChange(n)} className="visually-hidden" />
          <Star size={28} aria-hidden fill={n <= shown ? 'currentColor' : 'none'} className={n <= shown ? 'star-on' : 'star-off'} />
          <span className="visually-hidden">{n} star{n === 1 ? '' : 's'}</span>
        </label>
      ))}
    </fieldset>
  )
}

function ReviewForm({ productId, mine }) {
  // Shared per product so the confirmation survives the form refilling with the saved review.
  const [post, { isLoading, error, isSuccess }] = usePostReviewMutation({ fixedCacheKey: `review-${productId}` })
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [text, setText] = useState(mine?.text ?? '')

  const onSubmit = (e) => {
    e.preventDefault()
    if (rating) post({ id: productId, rating, text })
  }

  return (
    <form className="card p-4 mb-4" onSubmit={onSubmit} aria-label={mine ? 'Edit your review' : 'Write a review'}>
      <h3 className="h6">{mine ? 'Your review' : 'Write a review'}</h3>
      <StarInput value={rating} onChange={setRating} />
      <label htmlFor="review-text" className="form-label small mt-2">Your review <span className="text-body-secondary">(optional)</span></label>
      <textarea id="review-text" className="form-control" rows={3} maxLength={MAX_TEXT} value={text} onChange={(e) => setText(e.target.value)}
        placeholder="What did you like or dislike?" />
      {error && <div role="alert" className="text-danger small mt-2">{error.data?.rating?.[0] ?? error.data?.detail ?? 'Could not save your review.'}</div>}
      {isSuccess && <p role="status" className="small mt-2 mb-0">Thanks! Your review is saved.</p>}
      <button type="submit" className="btn btn-primary align-self-start mt-3" disabled={!rating || isLoading}>
        {isLoading ? 'Saving…' : mine ? 'Update review' : 'Post review'}
      </button>
    </form>
  )
}

// A Customer writes (or edits) their Review; Guests are invited to log in; staff only read.
function YourReview({ productId }) {
  const role = useSelector((state) => state.auth.user?.role)
  const location = useLocation()
  const mine = useMyReviewQuery(productId, { skip: role !== 'CUSTOMER' })

  if (!role) {
    return <p className="mb-4"><Link to="/login" state={{ from: location.pathname }}>Log in</Link> to write a review.</p>
  }
  if (role !== 'CUSTOMER' || mine.isLoading) return null
  // Keyed by the saved review so the form refills after it loads.
  return <ReviewForm key={mine.data?.id ?? 'new'} productId={productId} mine={mine.data} />
}

export default function Reviews({ product }) {
  const [page, setPage] = useState(1)
  const { data } = useProductReviewsQuery({ id: product.id, page })
  const pages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1

  return (
    <section className="mt-5" aria-labelledby="reviews-title">
      <div className="d-flex flex-wrap align-items-baseline gap-3 mb-3">
        <h2 id="reviews-title" className="h4 mb-0">Reviews</h2>
        {product.review_count > 0 && (
          <span className="text-body-secondary">{Number(product.rating_avg).toFixed(1)} out of 5 · {product.review_count} review{product.review_count === 1 ? '' : 's'}</span>
        )}
      </div>
      <YourReview productId={product.id} />
      {data?.count === 0 && <p className="text-body-secondary">No reviews yet.</p>}
      <ul className="review-list">
        {data?.results.map((r) => (
          <li key={r.id} className="review">
            <div className="d-flex align-items-center gap-2">
              <span className="fw-semibold">{r.author}</span>
              <span className="rating" role="img" aria-label={`${r.rating} out of 5 stars`}><Stars value={r.rating} /></span>
              <span className="small text-body-secondary ms-auto">{on.format(new Date(r.updated_at))}</span>
            </div>
            {r.text && <p className="mb-0 mt-1" style={{ whiteSpace: 'pre-line' }}>{r.text}</p>}
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav className="d-flex justify-content-center align-items-center gap-3 mt-3" aria-label="Review pages">
          <button type="button" className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="small">Page {page} of {pages}</span>
          <button type="button" className="btn btn-outline-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </nav>
      )}
    </section>
  )
}
