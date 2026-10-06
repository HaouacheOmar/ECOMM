import { createContext, useContext } from 'react'

export const CartDrawerContext = createContext({ open: () => {}, close: () => {} })

export const useCartDrawer = () => useContext(CartDrawerContext)
