import { api, refreshSession } from '../api.js'
import { sessionEnded, sessionStarted } from './authSlice.js'

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation({
      query: (credentials) => ({ url: 'auth/login/', method: 'POST', body: credentials }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled
        dispatch(sessionStarted(data))
      },
    }),
    logout: build.mutation({
      query: () => ({ url: 'auth/logout/', method: 'POST' }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        await queryFulfilled.catch(() => {})
        dispatch(sessionEnded())
        dispatch(api.util.resetApiState())
      },
    }),
    restoreSession: build.mutation({
      queryFn: (_, apiCtx, extraOptions) => refreshSession(apiCtx, extraOptions),
    }),
    me: build.query({ query: () => 'me/' }),
  }),
})

export const { useLoginMutation, useLogoutMutation, useMeQuery } = authApi
