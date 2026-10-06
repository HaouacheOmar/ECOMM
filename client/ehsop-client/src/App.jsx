import { lazy, Suspense } from 'react'
import { Route, Routes, useParams } from 'react-router-dom'
import AccountPage from './auth/AccountPage.jsx'
import LoginPage from './auth/LoginPage.jsx'
import VerifyEmailPage from './auth/VerifyEmailPage.jsx'
import RequireRole from './auth/RequireRole.jsx'
import HomePage from './storefront/HomePage.jsx'

const StorefrontLayout = lazy(() => import('./storefront/StorefrontLayout.jsx'))
const DeskLayout = lazy(() => import('./desk/DeskLayout.jsx'))
const AdminLayout = lazy(() => import('./admin/AdminLayout.jsx'))
const AdminProductsPage = lazy(() => import('./admin/AdminProductsPage.jsx'))
const ProductFormPage = lazy(() => import('./admin/ProductFormPage.jsx'))
const CategoriesPage = lazy(() => import('./admin/CategoriesPage.jsx'))
const DashboardPage = lazy(() => import('./admin/DashboardPage.jsx'))
const StaffOrdersPage = lazy(() => import('./orders/StaffOrdersPage.jsx'))
const StaffOrderPage = lazy(() => import('./orders/StaffOrderPage.jsx'))
const DeskHome = lazy(() => import('./desk/DeskHome.jsx'))
const EmployeesPage = lazy(() => import('./admin/EmployeesPage.jsx'))
const ActivityPage = lazy(() => import('./admin/ActivityPage.jsx'))
const PickupPointsPage = lazy(() => import('./admin/PickupPointsPage.jsx'))
const CatalogPage = lazy(() => import('./products/CatalogPage.jsx'))
const CheckoutPage = lazy(() => import('./orders/CheckoutPage.jsx'))
const MyOrdersPage = lazy(() => import('./orders/MyOrdersPage.jsx'))
const ProductPage = lazy(() => import('./products/ProductPage.jsx'))

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
        <Route path="/desk" element={<RequireRole role="EMPLOYEE"><DeskLayout /></RequireRole>}>
          <Route index element={<DeskHome />} />
          <Route path="orders" element={<div className="desk-page"><StaffOrdersPage /></div>} />
          <Route path="orders/:id" element={<div className="desk-page"><StaffOrderPage /></div>} />
          <Route path="account" element={<div className="desk-page"><AccountPage /></div>} />
        </Route>
        <Route path="/admin" element={<RequireRole role="ADMIN"><AdminLayout /></RequireRole>}>
          <Route index element={<DashboardPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="orders" element={<StaffOrdersPage />} />
          <Route path="orders/:id" element={<StaffOrderPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="products/new" element={<ProductFormPage />} />
          <Route path="products/:id" element={<ProductFormPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="pickup-points" element={<PickupPointsPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path=":section" element={<Placeholder />} />
        </Route>
        <Route path="/" element={<StorefrontLayout />}>
          <Route index element={<HomePage />} />
          <Route path="products" element={<CatalogPage />} />
          <Route path="products/:id" element={<ProductPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="verify/:token" element={<VerifyEmailPage />} />
          <Route path="account" element={<RequireRole role="CUSTOMER"><AccountPage /></RequireRole>} />
          <Route path="checkout" element={<RequireRole role="CUSTOMER"><CheckoutPage /></RequireRole>} />
          <Route path="orders" element={<RequireRole role="CUSTOMER"><MyOrdersPage /></RequireRole>} />
          <Route path=":section" element={<Placeholder />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
