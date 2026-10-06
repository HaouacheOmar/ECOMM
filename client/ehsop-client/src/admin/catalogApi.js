import { api } from '../api.js'
import '../products/productsApi.js'

// Admin catalog writes. Every mutation refreshes cached catalog data (storefront and admin alike).
export const catalogApi = api.injectEndpoints({
  endpoints: (build) => ({
    adminProducts: build.query({
      query: ({ search = '', page = 1 }) => ({ url: 'products/', params: { include_archived: 1, search, page } }),
      providesTags: ['Product'],
    }),
    createProduct: build.mutation({
      query: (body) => ({ url: 'products/', method: 'POST', body }),
      invalidatesTags: ['Product'],
    }),
    updateProduct: build.mutation({
      query: ({ id, ...body }) => ({ url: `products/${id}/`, method: 'PATCH', body }),
      invalidatesTags: ['Product'],
    }),
    setArchived: build.mutation({
      query: ({ id, archived }) => ({ url: `products/${id}/${archived ? 'archive' : 'restore'}/`, method: 'POST' }),
      invalidatesTags: ['Product'],
    }),
    uploadImage: build.mutation({
      query: ({ id, file }) => {
        const body = new FormData()
        body.append('image', file)
        return { url: `products/${id}/images/`, method: 'POST', body }
      },
      invalidatesTags: ['Product'],
    }),
    deleteImage: build.mutation({
      query: ({ id, imageId }) => ({ url: `products/${id}/images/${imageId}/`, method: 'DELETE' }),
      invalidatesTags: ['Product'],
    }),
    makePrimary: build.mutation({
      query: ({ id, imageId }) => ({ url: `products/${id}/images/${imageId}/primary/`, method: 'POST' }),
      invalidatesTags: ['Product'],
    }),
    createCategory: build.mutation({
      query: (body) => ({ url: 'categories/', method: 'POST', body }),
      invalidatesTags: ['Category'],
    }),
    updateCategory: build.mutation({
      query: ({ id, ...body }) => ({ url: `categories/${id}/`, method: 'PATCH', body }),
      invalidatesTags: ['Category', 'Product'],
    }),
    deleteCategory: build.mutation({
      query: (id) => ({ url: `categories/${id}/`, method: 'DELETE' }),
      invalidatesTags: ['Category'],
    }),
  }),
})

export const {
  useAdminProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useSetArchivedMutation,
  useUploadImageMutation,
  useDeleteImageMutation,
  useMakePrimaryMutation,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} = catalogApi

// DRF errors: {"field": ["msg"]} or {"detail": "msg"}.
export const fieldError = (error, field) => error?.data?.[field]?.[0]
export const detailError = (error) => error?.data?.detail ?? (error ? 'Something went wrong. Please try again.' : null)
