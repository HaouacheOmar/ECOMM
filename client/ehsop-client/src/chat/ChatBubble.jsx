import { MessageCircle, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useChatMessagesQuery } from './chatApi.js'
import ChatThread from './ChatThread.jsx'
import './chat.css'

// The Customer's floating support chat, on every storefront page.
export default function ChatBubble() {
  const [open, setOpen] = useState(false)
  const { data } = useChatMessagesQuery()
  const unread = data?.results.filter((m) => !m.is_read && m.sender.role !== 'CUSTOMER').length ?? 0

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const label = unread ? `Support chat, ${unread} unread` : 'Support chat'
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section className="chat-panel surface" role="dialog" aria-label="Support chat"
            initial={{ opacity: 0, transform: 'translateY(16px) scale(0.96)' }}
            animate={{ opacity: 1, transform: 'translateY(0px) scale(1)', transition: { type: 'spring', bounce: 0.2, visualDuration: 0.3 } }}
            exit={{ opacity: 0, transform: 'translateY(12px) scale(0.98)', transition: { duration: 0.15, ease: 'easeIn' } }}>
            <header className="chat-panel-header">
              <div>
                <h2 className="h6 mb-0">Support</h2>
                <p className="small text-body-secondary mb-0">We usually answer within minutes.</p>
              </div>
              <button type="button" className="icon-btn ms-auto" aria-label="Close chat" onClick={() => setOpen(false)}><X size={20} aria-hidden /></button>
            </header>
            <ChatThread autoFocus />
          </motion.section>
        )}
      </AnimatePresence>
      <button type="button" className="chat-fab" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}>
        <MessageCircle size={24} aria-hidden />
        {unread > 0 && !open && <span className="chat-fab-badge" aria-hidden>{unread}</span>}
      </button>
    </>
  )
}
