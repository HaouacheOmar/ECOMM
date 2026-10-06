import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // In Docker on Windows, file change events don't cross the bind mount, so poll instead.
  server: { watch: { usePolling: process.env.VITE_POLL === '1' } },
})
