import { api } from '../api.js'

export const cartApi = api.injectEndpoints({
  endpoints: (build) => ({
    cart: build.query({ query: () => 'cart/', providesTags: ['Cart'] }),
    previewCart: build.query({
      query: (items) => ({ url: 'cart/preview/', method: 'POST', body: { items } }),
      providesTags: ['Product'],
    }),
    addToCart: build.mutation({
      query: ({ product, quantity }) => ({ url: 'cart/items/', method: 'POST', body: { product, quantity } }),
      invalidatesTags: ['Cart'],
    }),
    setCartQuantity: build.mutation({
      query: ({ product, quantity }) => ({ url: `cart/items/${product}/`, method: 'PATCH', body: { quantity } }),
      invalidatesTags: ['Cart'],
    }),
    removeFromCart: build.mutation({
      query: (product) => ({ url: `cart/items/${product}/`, method: 'DELETE' }),
      invalidatesTags: ['Cart'],
    }),
    mergeCart: build.mutation({
      query: (items) => ({ url: 'cart/merge/', method: 'POST', body: { items } }),
      invalidatesTags: ['Cart'],
    }),
  }),
})

export const { useCartQuery, usePreviewCartQuery, useAddToCartMutation, useSetCartQuantityMutation, useRemoveFromCartMutation } = cartApi
