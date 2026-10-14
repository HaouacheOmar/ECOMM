import { api } from '../api.js'

// Admin only: Restocks, Stock Corrections and a Product's stock history. Every write changes stock,
// so cached Products, Suppliers (total spent) and histories refresh.
const CHANGED = ['Restock', 'StockHistory', 'Product', 'Supplier']

export const stockApi = api.injectEndpoints({
  endpoints: (build) => ({
    restocks: build.query({
      query: ({ month = '', supplier = '', page = 1 } = {}) => ({ url: 'restocks/', params: { month, supplier, page } }),
      providesTags: ['Restock'],
    }),
    restock: build.query({
      query: (id) => `restocks/${id}/`,
      providesTags: ['Restock'],
    }),
    recordRestock: build.mutation({
      query: (body) => ({ url: 'restocks/', method: 'POST', body }),
      invalidatesTags: CHANGED,
    }),
    cancelRestock: build.mutation({
      query: (id) => ({ url: `restocks/${id}/cancel/`, method: 'POST' }),
      invalidatesTags: CHANGED,
    }),
    correctStock: build.mutation({
      query: (body) => ({ url: 'stock-corrections/', method: 'POST', body }),
      invalidatesTags: CHANGED,
    }),
    stockHistory: build.query({
      query: (productId) => `products/${productId}/stock-history/`,
      providesTags: ['StockHistory'],
    }),
  }),
})

export const {
  useRestocksQuery,
  useRestockQuery,
  useRecordRestockMutation,
  useCancelRestockMutation,
  useCorrectStockMutation,
  useStockHistoryQuery,
} = stockApi

// Today in the shop's time zone, as YYYY-MM-DD (Restocks can't be dated later than this).
export const shopToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date())

export const REASONS = [['LOSS', 'Loss'], ['BREAKAGE', 'Breakage'], ['MISCOUNT', 'Miscount'], ['OTHER', 'Other']]
