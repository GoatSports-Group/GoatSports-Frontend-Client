import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: 'e2e-results',
  // The boot splash holds the first route until the session is ready (GOAT-DESIGN §6); under a busy dev
  // server that takes longer than the default 5s, so page-level assertions would fail before the app exists.
  expect: { timeout: 15_000 },
  // Tests that open two or three pages need room for each page's first render.
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: 'http://127.0.0.1:4200',
    // Reduced motion makes the boot splash use its static CSS layer instead of the Three.js scene, which
    // otherwise runs WebGL in every parallel browser and starves the machine (pages never leave the splash).
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run start -- --host 127.0.0.1 --port 4200',
    url: 'http://127.0.0.1:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] }
    }
  ]
});
