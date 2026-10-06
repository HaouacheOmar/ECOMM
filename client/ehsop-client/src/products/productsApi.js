import { api } from '../api.js'

export const productsApi = api.injectEndpoints({
  endpoints: (build) => ({
    categories: build.query({ query: () => 'categories/', providesTags: ['Category'] }),
    products: build.query({
      // Drop empty params so equal searches share a cache entry.
      query: (params) => ({ url: 'products/', params: Object.fromEntries(Object.entries(params).filter(([, v]) => v)) }),
      providesTags: ['Product'],
    }),
    product: build.query({ query: (id) => `products/${id}/`, providesTags: (_r, _e, id) => [{ type: 'Product', id }] }),
  }),
})

export const { useCategoriesQuery, useProductsQuery, useProductQuery } = productsApi
