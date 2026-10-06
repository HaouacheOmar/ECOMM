import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <section className="py-5 text-center">
      <h1 className="display-6 mb-3">Home &amp; lifestyle, made to last</h1>
      <p className="text-body-secondary mb-4">Kitchen, home decor, textiles, bags and stationery.</p>
      <Link to="/products" className="btn btn-primary btn-lg px-4">Shop the collection</Link>
    </section>
  )
}
