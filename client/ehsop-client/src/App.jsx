import { lazy, Suspense } from 'react'
import { Route, Routes, useParams } from 'react-router-dom'
import AccountPage from './auth/AccountPage.jsx'
import LoginPage from './auth/LoginPage.jsx'
import RequireRole from './auth/RequireRole.jsx'

const StorefrontLayout = lazy(() => import('./storefront/StorefrontLayout.jsx'))
const DeskLayout = lazy(() => import('./desk/DeskLayout.jsx'))
const AdminLayout = lazy(() => import('./admin/AdminLayout.jsx'))

function Placeholder({ title }) {
  const { section } = useParams()
  const heading = title ?? section?.replaceAll('-', ' ')
  return (
    <section className="py-4">
      <h1 className="h3 text-capitalize">{heading}</h1>
      <p className="text-body-secondary">Coming soon.</p>
    </section>
  )
}

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/desk/*" element={<RequireRole role="EMPLOYEE"><DeskLayout /></RequireRole>} />
        <Route path="/admin" element={<RequireRole role="ADMIN"><AdminLayout /></RequireRole>}>
          <Route index element={<Placeholder title="Dashboard" />} />
          <Route path="account" element={<AccountPage />} />
          <Route path=":section" element={<Placeholder />} />
        </Route>
        <Route path="/" element={<StorefrontLayout />}>
          <Route index element={<Placeholder title="Welcome" />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="account" element={<RequireRole role="CUSTOMER"><AccountPage /></RequireRole>} />
          <Route path=":section" element={<Placeholder />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
