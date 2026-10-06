import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useAddToCartMutation, useCartQuery, usePreviewCartQuery, useRemoveFromCartMutation, useSetCartQuantityMutation } from './cartApi.js'
import { added, pruned, quantitySet, removed } from './guestCartSlice.js'

const EMPTY = { items: [], count: 0, subtotal: '0' }

// One Cart interface for the storefront: the saved Cart for a Customer, the browser Cart for everyone else.
export default function useCart() {
  const dispatch = useDispatch()
  const isCustomer = useSelector((state) => state.auth.user?.role === 'CUSTOMER')
  const guestItems = useSelector((state) => state.guestCart.items)

  const saved = useCartQuery(undefined, { skip: !isCustomer })
  const preview = usePreviewCartQuery(guestItems, { skip: isCustomer || guestItems.length === 0 })
  const [addToCart] = useAddToCartMutation()
  const [setCartQuantity] = useSetCartQuantityMutation()
  const [removeFromCart] = useRemoveFromCartMutation()

  // Forget Guest lines the shop no longer sells.
  const priced = preview.currentData
  useEffect(() => {
    if (isCustomer || !priced) return
    const keep = priced.items.map((i) => i.product.id)
    if (guestItems.some((i) => !keep.includes(i.product))) dispatch(pruned(keep))
  }, [isCustomer, priced, guestItems, dispatch])

  const cart = isCustomer ? saved.data ?? EMPTY : guestItems.length ? preview.data ?? EMPTY : EMPTY

  return {
    ...cart,
    isCustomer,
    canCheckout: cart.items.length > 0 && cart.items.every((i) => i.available),
    add: (product, quantity = 1) =>
      isCustomer
        ? addToCart({ product: product.id, quantity })
        : dispatch(added({ product: product.id, quantity, stock: product.stock })),
    setQuantity: (product, quantity) =>
      isCustomer
        ? setCartQuantity({ product: product.id, quantity })
        : dispatch(quantitySet({ product: product.id, quantity, stock: product.stock })),
    remove: (product) => (isCustomer ? removeFromCart(product.id) : dispatch(removed(product.id))),
  }
}
