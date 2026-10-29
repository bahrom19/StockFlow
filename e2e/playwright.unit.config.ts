import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './helpers',
  testMatch: 'api-base.spec.ts',
  // Dedicated output directory (resolved relative to this config, i.e.
  // e2e/test-results-unit): keeps UNIT-A runs from cleaning/overwriting the
  // main suite's e2e/test-results evidence (F2).
  outputDir: './test-results-unit',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'off',
  },
});