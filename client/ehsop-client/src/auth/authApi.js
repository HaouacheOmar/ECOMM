import { api, refreshSession, waitForSessionChange } from '../api.js'
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
    demo: build.query({ query: () => 'demo/' }),
    // DEMO_MODE only: sign in as the demo Customer, Employee or Admin.
    demoLogin: build.mutation({
      query: (role) => ({ url: 'demo/login/', method: 'POST', body: { role } }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          dispatch(sessionStarted((await queryFulfilled).data))
        } catch {
          // shown by the buttons
        }
      },
    }),
    forgotPassword: build.mutation({ query: (email) => ({ url: 'auth/password/reset/', method: 'POST', body: { email } }) }),
    resetPassword: build.mutation({ query: (body) => ({ url: 'auth/password/reset/confirm/', method: 'POST', body }) }),
    // Other sessions are signed out; this one continues with the fresh tokens returned.
    changePassword: build.mutation({
      query: (body) => ({ url: 'auth/password/change/', method: 'POST', body }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        waitForSessionChange(queryFulfilled)
        try {
          dispatch(sessionStarted((await queryFulfilled).data))
        } catch {
          // shown by the form
        }
      },
    }),
  }),
})

export const {
  useLoginMutation,
  useRegisterMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useLogoutMutation,
  useMeQuery,
  useDemoQuery,
  useDemoLoginMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
} = authApi

// DRF errors: {"field": ["message"]}.
export const fieldError = (error, field) => error?.data?.[field]?.[0]
