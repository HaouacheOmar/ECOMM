import { AnimatePresence, motion } from 'motion/react'
import { useLocation, useOutlet } from 'react-router-dom'

// Route transition for a workspace's content area: short fade/rise in, faster fade out.
export default function AnimatedOutlet() {
  const location = useLocation()
  const outlet = useOutlet()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, transform: 'translateY(8px)' }}
        animate={{ opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.2, ease: 'easeOut' } }}
        exit={{ opacity: 0, transition: { duration: 0.12, ease: 'easeIn' } }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  )
}
