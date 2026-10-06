import { api, refreshSession } from '../api.js'
import { sessionEnded, sessionStarted } from './authSlice.js'

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation({
      query: (credentials) => ({ url: 'auth/login/', method: 'POST', body: credentials }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(sessionStarted(data))
        } catch {
          // failure is shown by the login form via the mutation result
        }
      },
    }),
    register: build.mutation({
      query: (body) => ({ url: 'auth/register/', method: 'POST', body }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(sessionStarted(data))
        } catch {
          // shown by the form
        }
      },
    }),
    verifyEmail: build.mutation({ query: (token) => ({ url: 'auth/verify/', method: 'POST', body: { token } }) }),
    resendVerification: build.mutation({ query: () => ({ url: 'auth/verify/resend/', method: 'POST' }) }),
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

export const {
  useLoginMutation,
  useRegisterMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useLogoutMutation,
  useMeQuery,
} = authApi
