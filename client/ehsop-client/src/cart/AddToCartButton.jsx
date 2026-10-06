import { useCartDrawer } from './CartDrawerContext.js'
import useCart from './useCart.js'

// Adds to the right Cart (saved or browser) and opens the drawer as confirmation.
export default function AddToCartButton({ product, quantity = 1, className = 'btn btn-primary btn-sm', label = 'Add' }) {
  const { add } = useCart()
  const { open } = useCartDrawer()

  if (!product.in_stock) {
    return <button type="button" className={`${className} btn-out`} disabled>Out of stock</button>
  }

  const onClick = async () => {
    await add(product, quantity)
    open()
  }

  return (
    <button type="button" className={className} onClick={onClick} aria-label={`Add ${product.name} to cart`}>
      {label}
    </button>
  )
}
