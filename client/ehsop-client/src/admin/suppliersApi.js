import { api } from '../api.js'

// Admin only: Suppliers (archived, never deleted).
export const suppliersApi = api.injectEndpoints({
  endpoints: (build) => ({
    suppliers: build.query({
      query: ({ search = '', includeArchived = false } = {}) => ({
        url: 'suppliers/', params: { search, ...(includeArchived && { include_archived: 1 }) },
      }),
      providesTags: ['Supplier'],
    }),
    supplier: build.query({
      query: (id) => `suppliers/${id}/`,
      providesTags: ['Supplier'],
    }),
    createSupplier: build.mutation({
      query: (body) => ({ url: 'suppliers/', method: 'POST', body }),
      invalidatesTags: ['Supplier'],
    }),
    updateSupplier: build.mutation({
      query: ({ id, ...body }) => ({ url: `suppliers/${id}/`, method: 'PATCH', body }),
      invalidatesTags: ['Supplier', 'Product'],
    }),
    setSupplierArchived: build.mutation({
      query: ({ id, archived }) => ({ url: `suppliers/${id}/${archived ? 'archive' : 'restore'}/`, method: 'POST' }),
      invalidatesTags: ['Supplier', 'Product'],
    }),
  }),
})

export const {
  useSuppliersQuery,
  useSupplierQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useSetSupplierArchivedMutation,
} = suppliersApi
