import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// Trailing slash so page.goto('./') stays under a sub-path deploy such as /portfolio/.
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/?$/, '/');

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Static site: serve the repo root as-is. Skipped when BASE_URL points at a deployed site.
  webServer: process.env.BASE_URL ? undefined : {
    command: `npx serve -l ${PORT} .`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
