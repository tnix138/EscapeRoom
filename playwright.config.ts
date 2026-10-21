/**
 * playwright.config.ts — پیکربندی تست‌های E2E تیم (فعلاً: سناریوی چندنفره علیرضا)
 * -----------------------------------------------------------------------------------
 * اجرا:  npx playwright install chromium   (یک‌بار روی ماشین توسعه/CI)
 *        npm run test:e2e:alireza
 * سرور تست روی پورت اختصاصی ۳۱۰۰ با دیتابیس SQLite موقت و جدا از داده توسعه بالا می‌آید.
 * در محیط‌هایی بدون مرورگر سیستمی می‌توان با متغیر E2E_CHROMIUM_PATH مسیر باینری کرومیوم داد.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    locale: 'fa-IR',
    launchOptions: process.env.E2E_CHROMIUM_PATH
      ? { executablePath: process.env.E2E_CHROMIUM_PATH, args: ['--no-sandbox'] }
      : { args: ['--no-sandbox'] },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      STORAGE_DRIVER: 'sqlite',
      ESCAPEROOM_DB_PATH: `.data/e2e-${Date.now()}.db`,
    },
  },
});
