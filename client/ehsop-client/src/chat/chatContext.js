import { createContext, useContext } from 'react'

// { pending, send(body, to?), dismiss(clientId) } from ChatProvider.
export const ChatContext = createContext(null)
export const useChat = () => useContext(ChatContext)
