import { configureStore } from '@reduxjs/toolkit'
import { api } from './api.js'
import auth from './auth/authSlice.js'

export const store = configureStore({
  reducer: { auth, [api.reducerPath]: api.reducer },
  middleware: (getDefault) => getDefault().concat(api.middleware),
})
