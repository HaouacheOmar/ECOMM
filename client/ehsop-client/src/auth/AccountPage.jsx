import { useMeQuery } from './authApi.js'

export default function AccountPage() {
  const { data: me, isLoading } = useMeQuery()
  return (
    <section className="py-4">
      <h1 className="h3">Account</h1>
      {isLoading ? <p className="text-body-secondary">Loading…</p> : <p>Signed in as <strong>{me?.email}</strong></p>}
    </section>
  )
}
