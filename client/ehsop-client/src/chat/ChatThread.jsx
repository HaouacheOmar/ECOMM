import { SendHorizontal, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useChatMessagesQuery, useMarkChatReadMutation } from './chatApi.js'
import { useChat } from './chatContext.js'
import './chat.css'

const MAX_BODY = 1000
const time = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' })

/**
 * One Customer's conversation with support. A Customer sees their own (customerId omitted); an
 * Employee passes the Customer they are helping. Customer messages sit on one side, support's on
 * the other, with the Employee's name since several may have answered over time.
 */
export default function ChatThread({ customerId, autoFocus }) {
  const me = useSelector((state) => state.auth.user)
  const { data } = useChatMessagesQuery(customerId)
  const [markRead] = useMarkChatReadMutation()
  const { pending, send, dismiss } = useChat()
  const [draft, setDraft] = useState('')
  const end = useRef(null)
  const input = useRef(null)

  const history = data ? [...data.results].reverse() : []
  const known = new Set(history.map((m) => m.client_id))
  const waiting = pending.filter((m) => m.to === customerId && !known.has(m.client_id))
  // Pending messages have no sender yet: they are always the viewer's own.
  const fromCustomer = (m) => (m.sender ? m.sender.role === 'CUSTOMER' : me.role === 'CUSTOMER')
  const unread = history.filter((m) => !m.is_read && fromCustomer(m) === (me.role === 'EMPLOYEE')).length

  // Opening the conversation (or a message arriving while it's open) marks it read.
  useEffect(() => {
    if (unread > 0) markRead(customerId)
  }, [unread, customerId, markRead])

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [history.length, waiting.length])

  useEffect(() => {
    if (autoFocus) input.current?.focus()
  }, [autoFocus])

  const onSubmit = (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    send(body, customerId)
    setDraft('')
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) onSubmit(e)
  }

  const side = (m) => ((me.role === 'CUSTOMER') === fromCustomer(m) ? 'mine' : 'theirs')

  return (
    <div className="chat-thread">
      <ol className="chat-messages" aria-label="Messages" aria-live="polite">
        {history.length === 0 && waiting.length === 0 && (
          <li className="chat-empty">{me.role === 'CUSTOMER' ? 'Ask us anything. An Employee will answer here.' : 'No messages yet.'}</li>
        )}
        <AnimatePresence initial={false}>
          {[...history, ...waiting].map((m) => (
            <motion.li key={m.client_id} className={`chat-message ${side(m)}`}
              initial={{ opacity: 0, transform: 'translateY(6px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }}
              transition={{ duration: 0.18, ease: 'easeOut' }}>
              {m.sender && !fromCustomer(m) && m.sender.id !== me.id && <span className="chat-author">{m.sender.name}</span>}
              <span className="chat-body">{m.body}</span>
              <span className="chat-meta">
                {m.status === 'sending' ? 'Sending…' : m.status === 'failed' ? 'Not sent' : time.format(new Date(m.created_at))}
              </span>
              {m.status === 'failed' && (
                <span role="alert" className="chat-error">
                  {m.error}
                  <button type="button" className="icon-btn icon-btn-xs" aria-label="Dismiss" onClick={() => dismiss(m.client_id)}><X size={14} aria-hidden /></button>
                </span>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
        <li ref={end} aria-hidden className="chat-end" />
      </ol>
      <form className="chat-composer" onSubmit={onSubmit}>
        <label htmlFor={`chat-input-${customerId ?? 'mine'}`} className="visually-hidden">Message</label>
        <textarea id={`chat-input-${customerId ?? 'mine'}`} ref={input} className="form-control" rows={1} maxLength={MAX_BODY}
          placeholder="Write a message…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} />
        <button type="submit" className="chat-send" aria-label="Send" disabled={!draft.trim()}><SendHorizontal size={18} aria-hidden /></button>
      </form>
    </div>
  )
}
