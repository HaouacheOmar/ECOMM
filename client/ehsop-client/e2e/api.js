import { PASSWORD, USERS } from './users.js'

// Direct calls to the E2E backend for test setup (not part of what's under test).
export const API = 'http://localhost:8001/api/'

async function tokenFor(request, who) {
  const response = await request.post(`${API}auth/login/`, { data: { email: USERS[who].email, password: PASSWORD } })
  return (await response.json()).access
}

async function call(request, who, method, path, data) {
  const headers = { Authorization: `Bearer ${await tokenFor(request, who)}` }
  const response = await request.fetch(`${API}${path}`, { method, headers, data })
  if (!response.ok()) throw new Error(`${method} ${path} -> ${response.status()} ${await response.text()}`)
  return response.status() === 204 ? null : response.json()
}

export async function findProduct(request, name) {
  const found = await call(request, 'admin', 'GET', `products/?include_archived=1&search=${encodeURIComponent(name)}`)
  return found.results.find((p) => p.name === name)
}

export async function productId(request, name) {
  return (await findProduct(request, name)).id
}

export async function updateProduct(request, name, changes) {
  return call(request, 'admin', 'PATCH', `products/${await productId(request, name)}/`, changes)
}

export async function setArchived(request, name, archived) {
  return call(request, 'admin', 'POST', `products/${await productId(request, name)}/${archived ? 'archive' : 'restore'}/`)
}

export async function emptyCustomerCart(request) {
  const cart = await call(request, 'customer', 'GET', 'cart/')
  for (const line of cart.items) await call(request, 'customer', 'DELETE', `cart/items/${line.product.id}/`)
}
