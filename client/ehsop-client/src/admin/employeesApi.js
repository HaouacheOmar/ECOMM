import { api } from '../api.js'

export const employeesApi = api.injectEndpoints({
  endpoints: (build) => ({
    employees: build.query({ query: (page = 1) => ({ url: 'employees/', params: { page } }), providesTags: ['Employee'] }),
    createEmployee: build.mutation({
      query: (body) => ({ url: 'employees/', method: 'POST', body }),
      invalidatesTags: ['Employee'],
    }),
    setEmployeePassword: build.mutation({
      query: ({ id, password }) => ({ url: `employees/${id}/set-password/`, method: 'POST', body: { password } }),
    }),
    // Deactivating also closes their open Employee Session.
    setEmployeeActive: build.mutation({
      query: ({ id, active }) => ({ url: `employees/${id}/${active ? 'reactivate' : 'deactivate'}/`, method: 'POST' }),
      invalidatesTags: ['Employee', 'EmployeeSession'],
    }),
    employeeSessions: build.query({
      query: (params) => ({ url: 'employee-sessions/', params }),
      providesTags: ['EmployeeSession'],
    }),
  }),
})

export const {
  useEmployeesQuery,
  useCreateEmployeeMutation,
  useSetEmployeePasswordMutation,
  useSetEmployeeActiveMutation,
  useEmployeeSessionsQuery,
} = employeesApi
