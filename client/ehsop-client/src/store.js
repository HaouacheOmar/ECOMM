import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit'
import { api } from './api.js'
import auth, { sessionStarted } from './auth/authSlice.js'
import { cartApi } from './cart/cartApi.js'
import guestCart, { cleared, loadGuestCart, saveGuestCart } from './cart/guestCartSlice.js'

const listener = createListenerMiddleware()

// When a Customer session starts, fold the browser Cart into their saved Cart once, then empty it.
listener.startListening({
  actionCreator: sessionStarted,
  effect: async ({ payload }, { getState, dispatch }) => {
    const items = getState().guestCart.items
    if (payload.user.role !== 'CUSTOMER' || items.length === 0) return
    const merged = await dispatch(cartApi.endpoints.mergeCart.initiate(items))
    if (!merged.error) dispatch(cleared())
  },
})

export const store = configureStore({
  reducer: { auth, guestCart, [api.reducerPath]: api.reducer },
  preloadedState: { guestCart: loadGuestCart() },
  middleware: (getDefault) => getDefault().prepend(listener.middleware).concat(api.middleware),
})

let lastSaved = store.getState().guestCart
store.subscribe(() => {
  const current = store.getState().guestCart
  if (current !== lastSaved) {
    lastSaved = current
    saveGuestCart(current)
  }
})
