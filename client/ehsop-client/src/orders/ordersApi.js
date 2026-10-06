import { api } from '../api.js'

export const ordersApi = api.injectEndpoints({
  endpoints: (build) => ({
    orders: build.query({ query: (page = 1) => ({ url: 'orders/', params: { page } }), providesTags: ['Order'] }),
    // Success or a stock conflict alike change the Cart and stock levels, so refetch both either way.
    checkout: build.mutation({
      query: (body) => ({ url: 'orders/', method: 'POST', body }),
      invalidatesTags: () => ['Cart', 'Order', 'Product'],
    }),
    cancelOrder: build.mutation({
      query: (id) => ({ url: `orders/${id}/cancel/`, method: 'POST' }),
      invalidatesTags: () => ['Order', 'Product'],
    }),
    pickupPoints: build.query({ query: () => 'pickup-points/', providesTags: ['PickupPoint'] }),
    createPickupPoint: build.mutation({
      query: (body) => ({ url: 'pickup-points/', method: 'POST', body }),
      invalidatesTags: ['PickupPoint'],
    }),
    updatePickupPoint: build.mutation({
      query: ({ id, ...body }) => ({ url: `pickup-points/${id}/`, method: 'PATCH', body }),
      invalidatesTags: ['PickupPoint'],
    }),
    deletePickupPoint: build.mutation({
      query: (id) => ({ url: `pickup-points/${id}/`, method: 'DELETE' }),
      invalidatesTags: ['PickupPoint'],
    }),
  }),
})

export const {
  useOrdersQuery,
  useCheckoutMutation,
  useCancelOrderMutation,
  usePickupPointsQuery,
  useCreatePickupPointMutation,
  useUpdatePickupPointMutation,
  useDeletePickupPointMutation,
} = ordersApi

export const orderNumber = (order) => order.id.slice(0, 8).toUpperCase()
