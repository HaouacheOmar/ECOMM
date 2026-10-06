import { Circle } from 'lucide-react'

// Online green / Offline red, always with the label (never colour alone).
export default function Presence({ online }) {
  return (
    <span className={`presence ${online ? 'presence-online' : 'presence-offline'}`}>
      <Circle size={10} fill="currentColor" aria-hidden /> {online ? 'Online' : 'Offline'}
    </span>
  )
}
