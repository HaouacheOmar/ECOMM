import { api } from '../api.js'

export const chatApi = api.injectEndpoints({
  endpoints: (build) => ({
    // A Customer's whole history, newest first (an Employee passes the Customer's id).
    chatMessages: build.query({
      query: (customer) => ({ url: 'chat/messages/', params: customer ? { customer } : {} }),
      providesTags: ['Chat'],
    }),
    markChatRead: build.mutation({
      query: (customer) => ({ url: 'chat/read/', method: 'POST', body: customer ? { customer } : {} }),
      invalidatesTags: ['Chat', 'ChatQueue'],
    }),
    chatQueue: build.query({ query: () => 'chat/queue/', providesTags: ['ChatQueue'] }),
    myChatCustomers: build.query({ query: () => 'chat/customers/', providesTags: ['ChatQueue'] }),
  }),
})

export const { useChatMessagesQuery, useMarkChatReadMutation, useChatQueueQuery, useMyChatCustomersQuery } = chatApi
