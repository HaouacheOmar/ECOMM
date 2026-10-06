import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { sessionEnded, sessionStarted } from './auth/authSlice.js'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/'

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.accessToken
    if (token) headers.set('authorization', `Bearer ${token}`)
    return headers
  },
})

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let refreshing = null

// One refresh at a time: concurrent 401s (and app bootstrap) share the same request, because the
// refresh cookie rotates and a second request with the old cookie would be rejected.
export function refreshSession(api, extraOptions) {
  refreshing ??= (async () => {
    let result = await rawBaseQuery({ url: 'auth/refresh/', method: 'POST' }, api, extraOptions)
    if (result.error?.data?.code === 'session_expired') {
      // ponytail: another tab may have just rotated the cookie; one delayed retry covers it, a
      // cross-tab lock (BroadcastChannel) would if tabs still log each other out.
      await wait(500)
      result = await rawBaseQuery({ url: 'auth/refresh/', method: 'POST' }, api, extraOptions)
    }
    api.dispatch(result.data ? sessionStarted(result.data) : sessionEnded())
    return result
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

const isAuthCall = (args) => (typeof args === 'string' ? args : args.url).startsWith('auth/')

async function baseQueryWithReauth(args, api, extraOptions) {
  let result = await rawBaseQuery(args, api, extraOptions)
  if (result.error?.status === 401 && !isAuthCall(args)) {
    const refreshed = await refreshSession(api, extraOptions)
    if (refreshed.data) result = await rawBaseQuery(args, api, extraOptions)
  }
  return result
}

// Feature slices inject their endpoints with api.injectEndpoints().
export const api = createApi({
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Product', 'Category', 'Cart', 'Order', 'PickupPoint', 'Employee', 'EmployeeSession'],
  endpoints: () => ({}),
})
