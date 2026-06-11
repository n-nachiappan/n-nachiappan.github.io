const { defineConfig, devices } = require('@playwright/test');

// The tests load the real, deployable HTML file through a local static server, so what is tested is exactly
// what gets published — there is no separate copy of the model logic to drift out of sync.
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node scripts/serve.mjs',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
