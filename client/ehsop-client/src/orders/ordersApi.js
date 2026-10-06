import { api } from '../api.js'

export const ordersApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Customers get their own Orders, staff get all of them (optionally ?status= and ?search= by email).
    orders: build.query({ query: (params) => ({ url: 'orders/', params }), providesTags: ['Order'] }),
    order: build.query({ query: (id) => `orders/${id}/`, providesTags: ['Order'] }),
    // Success or a stock conflict alike change the Cart and stock levels, so refetch both either way.
    checkout: build.mutation({
      query: (body) => ({ url: 'orders/', method: 'POST', body }),
      invalidatesTags: () => ['Cart', 'Order', 'Product'],
    }),
    // move: 'ship' | 'deliver' | 'cancel'
    moveOrder: build.mutation({
      query: ({ id, move }) => ({ url: `orders/${id}/${move}/`, method: 'POST' }),
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
  useOrderQuery,
  useCheckoutMutation,
  useMoveOrderMutation,
  usePickupPointsQuery,
  useCreatePickupPointMutation,
  useUpdatePickupPointMutation,
  useDeletePickupPointMutation,
} = ordersApi

export const orderNumber = (order) => order.id.slice(0, 8).toUpperCase()
export const placedOn = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
