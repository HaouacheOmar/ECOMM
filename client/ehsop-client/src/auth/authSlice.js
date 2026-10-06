import { createSlice } from '@reduxjs/toolkit'

// The access token lives only here (memory); the refresh token is an httpOnly cookie the SPA never sees.
const authSlice = createSlice({
  name: 'auth',
  initialState: { status: 'unknown', accessToken: null, user: null },
  reducers: {
    sessionStarted: (state, { payload }) => {
      state.status = 'authenticated'
      state.accessToken = payload.access
      state.user = payload.user
    },
    sessionEnded: (state) => {
      state.status = 'anonymous'
      state.accessToken = null
      state.user = null
    },
  },
})

export const { sessionStarted, sessionEnded } = authSlice.actions
export default authSlice.reducer

export const HOME_BY_ROLE = { CUSTOMER: '/', EMPLOYEE: '/desk', ADMIN: '/admin' }
