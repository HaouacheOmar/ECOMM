import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/'

// Feature slices inject their endpoints with api.injectEndpoints().
export const api = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: API_URL, credentials: 'include' }),
  endpoints: () => ({}),
})
