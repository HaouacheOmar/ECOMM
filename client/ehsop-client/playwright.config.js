import { defineConfig } from '@playwright/test'

const CI = !!process.env.CI
// Python that runs the Django server (repo venv locally, system python in CI).
export const PYTHON = process.env.E2E_PYTHON ?? (process.platform === 'win32' ? '..\\venv\\Scripts\\python.exe' : 'python')

// E2E runs its own backend (8001) and Vite (5174) so it never collides with dev servers on 8000/5173.
const API_PORT = 8001
const WEB_PORT = 5174

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: 1,
  reporter: CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // Locally use the installed Chrome; CI installs Playwright's Chromium.
    channel: CI ? undefined : 'chrome',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `${PYTHON} manage.py runserver ${API_PORT} --noreload`,
      cwd: '../../server',
      url: `http://localhost:${API_PORT}/api/schema/`,
      reuseExistingServer: !CI,
      env: {
        // Short access tokens so tests exercise the transparent refresh.
        JWT_ACCESS_SECONDS: '5',
        CHAT_OFFLINE_GRACE: '2',
        FRONTEND_ORIGIN: `http://localhost:${WEB_PORT}`,
      },
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !CI,
      env: { VITE_API_URL: `http://localhost:${API_PORT}/api/` },
    },
  ],
})
