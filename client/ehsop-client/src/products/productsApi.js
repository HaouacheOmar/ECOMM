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
    bestsellers: build.query({ query: () => 'bestsellers/', providesTags: ['Product'] }),
    // Changes when the Customer confirms or cancels an Order.
    recommendations: build.query({ query: () => 'recommendations/', providesTags: ['Product', 'Order'] }),
    productReviews: build.query({
      query: ({ id, page = 1 }) => ({ url: `products/${id}/reviews/`, params: { page } }),
      providesTags: ['Review'],
    }),
    // The signed-in Customer's own Review (404 until they write one).
    myReview: build.query({ query: (id) => `products/${id}/reviews/mine/`, providesTags: ['Review'] }),
    // Creates or edits the Customer's Review; the Product's average and count change with it.
    postReview: build.mutation({
      query: ({ id, ...body }) => ({ url: `products/${id}/reviews/`, method: 'POST', body }),
      invalidatesTags: ['Review', 'Product'],
    }),
  }),
})

export const {
  useCategoriesQuery,
  useProductsQuery,
  useProductQuery,
  useBestsellersQuery,
  useRecommendationsQuery,
  useProductReviewsQuery,
  useMyReviewQuery,
  usePostReviewMutation,
} = productsApi
