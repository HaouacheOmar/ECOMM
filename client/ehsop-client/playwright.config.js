import { defineConfig } from '@playwright/test'

const CI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    // Locally use the installed Chrome; CI installs Playwright's Chromium.
    channel: CI ? undefined : 'chrome',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !CI,
  },
})
