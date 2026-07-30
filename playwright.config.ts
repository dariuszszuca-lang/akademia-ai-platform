import { defineConfig } from '@playwright/test'
import { assertPlaywrightLaunchAllowed } from './e2e/current-release/guard'

assertPlaywrightLaunchAllowed(process.env)

export default defineConfig({
  testDir: './e2e/current-release',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 10 * 60_000,
  globalTimeout: 45 * 60_000,
  reporter: 'line',
  outputDir: 'Temp/current-release-playwright-artifacts',
  use: {
    baseURL:
      process.env.CURRENT_RELEASE_BASE_URL ??
      'http://127.0.0.1:3000',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})
