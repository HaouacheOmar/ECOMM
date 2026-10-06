import { createSlice } from '@reduxjs/toolkit'

const KEY = 'eshop-guest-cart'

// A Guest Cart is only product ids and quantities; prices and stock always come from the API.
export function loadGuestCart() {
  try {
    const items = JSON.parse(localStorage.getItem(KEY))?.items
    if (Array.isArray(items)) return { items: items.filter((i) => typeof i.product === 'string' && i.quantity > 0) }
  } catch {
    // unreadable or blocked storage: start empty
  }
  return { items: [] }
}

export function saveGuestCart(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage blocked: the cart still works for this page view
  }
}

const capped = (quantity, stock) => Math.max(1, Math.min(quantity, stock))

const guestCartSlice = createSlice({
  name: 'guestCart',
  initialState: { items: [] },
  reducers: {
    added: (state, { payload: { product, quantity = 1, stock } }) => {
      const line = state.items.find((i) => i.product === product)
      if (line) line.quantity = capped(line.quantity + quantity, stock)
      else state.items.push({ product, quantity: capped(quantity, stock) })
    },
    quantitySet: (state, { payload: { product, quantity, stock } }) => {
      const line = state.items.find((i) => i.product === product)
      if (line) line.quantity = capped(quantity, stock)
    },
    removed: (state, { payload: product }) => {
      state.items = state.items.filter((i) => i.product !== product)
    },
    // Drop lines the API no longer sells (archived or deleted).
    pruned: (state, { payload: keepIds }) => {
      state.items = state.items.filter((i) => keepIds.includes(i.product))
    },
    cleared: (state) => {
      state.items = []
    },
  },
})

export const { added, quantitySet, removed, pruned, cleared } = guestCartSlice.actions
export default guestCartSlice.reducer
