import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_LOGIN_PATH,
  ADMIN_PANEL_PENDING_MESSAGE,
  ADMIN_SESSION_ENDPOINT,
  isAdminLoginPath,
  landingAvailabilityFromStatus,
  loginPathFor,
  shouldRedirectToLogin,
} from '../../src/app/admin/login/login-rules';

/**
 * فاز ۰۹-ب — محافظ جلسهٔ پنل ادمین (Issue #95)
 * ---------------------------------------------------------------------------
 * قاعده: بازدیدکنندهٔ بدون جلسه به `/admin/login?next=…` می‌رود، ولی تا وقتی
 * سرویس امیر آماده نشده (۴۰۴/۵۰۳/خطای شبکه) هیچ ریدایرکتی انجام نمی‌شود؛
 * وگرنه پنل در حلقهٔ بی‌پایان گیر می‌کند.
 */

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const gateSource = read('../../src/app/admin/login/admin-session-gate.tsx');
const layout = read('../../src/app/admin/layout.tsx');
const page = read('../../src/app/admin/login/page.tsx');

describe('فاز ۰۹-ب — تصمیم ریدایرکت', () => {
  it('فقط ۴۰۱ و ۴۰۳ یعنی «جلسه ندارید»', () => {
    expect(shouldRedirectToLogin(401)).toBe(true);
    expect(shouldRedirectToLogin(403)).toBe(true);
    for (const status of [200, 204, 400, 404, 429, 500, 503]) {
      expect(shouldRedirectToLogin(status), String(status)).toBe(false);
    }
    expect(shouldRedirectToLogin(Number.NaN)).toBe(false);
  });

  it('مسیر ورود و صفحهٔ ورود درست تشخیص داده می‌شوند', () => {
    expect(ADMIN_LOGIN_PATH).toBe('/admin/login');
    expect(isAdminLoginPath('/admin/login')).toBe(true);
    expect(isAdminLoginPath('/admin/login/')).toBe(true);
    expect(isAdminLoginPath('/admin/login?next=%2Fadmin')).toBe(true);
    expect(isAdminLoginPath('/admin')).toBe(false);
    expect(isAdminLoginPath('/admin/rooms')).toBe(false);
    expect(isAdminLoginPath(null)).toBe(false);
  });

  it('مسیر بازگشت فقط برای صفحه‌های داخلی پنل ساخته می‌شود', () => {
    expect(loginPathFor('/admin/rooms')).toBe('/admin/login?next=%2Fadmin%2Frooms');
    expect(loginPathFor('/admin/players?page=2')).toBe('/admin/login?next=%2Fadmin%2Fplayers%3Fpage%3D2');
    // مسیر ناامن → فقط صفحهٔ ورود بدون next
    expect(loginPathFor('https://evil.example/admin')).toBe('/admin/login');
    expect(loginPathFor('/room/ABC')).toBe('/admin/login');
    expect(loginPathFor('//evil.example/admin')).toBe('/admin/login');
    expect(loginPathFor(undefined)).toBe('/admin/login');
  });

  it('آدرس بررسی جلسه از یک ثابت خوانده می‌شود', () => {
    expect(ADMIN_SESSION_ENDPOINT).toBe('/api/admin/session');
  });

  it('نبود داشبورد (/admin) به ۴۰۴ منتهی نمی‌شود، پیام صادقانه می‌دهد', () => {
    expect(landingAvailabilityFromStatus(200)).toBe('ready');
    expect(landingAvailabilityFromStatus(307)).toBe('ready');
    expect(landingAvailabilityFromStatus(404)).toBe('missing');
    expect(landingAvailabilityFromStatus(405)).toBe('missing');
    expect(landingAvailabilityFromStatus(500)).toBe('unknown');
    expect(landingAvailabilityFromStatus(0)).toBe('unknown');
    expect(ADMIN_PANEL_PENDING_MESSAGE).toMatch(/[\u0600-\u06FF]/);
    expect(ADMIN_PANEL_PENDING_MESSAGE).not.toMatch(/[A-Za-z]/);
    expect(page).toContain('probeLanding(landing)');
    expect(page).toContain("if (availability === 'missing')");
    expect(page).toContain('ADMIN_PANEL_PENDING_MESSAGE');
    // خطای شبکه/مهلت نباید مدیر را زمین‌گیر کند؛ fail-open.
    expect(page).toContain("return 'unknown';");
  });
});

describe('فاز ۰۹-ب — کامپوننت محافظ', () => {
  it('کلاینتی است و فقط یک بار با GET جلسه را می‌سنجد', () => {
    expect(gateSource.startsWith("'use client';")).toBe(true);
    expect(gateSource).toContain('fetch(ADMIN_SESSION_ENDPOINT');
    expect(gateSource).toContain("method: 'GET'");
    expect(gateSource).toContain("credentials: 'same-origin'");
    expect(gateSource).toContain('shouldRedirectToLogin(response.status)');
  });

  it('در صفحهٔ ورود و در حالت خاموش هیچ درخواستی نمی‌فرستد', () => {
    expect(gateSource).toContain('isAdminLoginPath(pathname)');
    expect(gateSource).toContain('if (!enabled');
  });

  it('خطای شبکه را fail-open مدیریت می‌کند و حلقهٔ ریدایرکت نمی‌سازد', () => {
    expect(gateSource).toContain('.catch(() => {');
    expect(gateSource).toContain('window.location.pathname === ADMIN_LOGIN_PATH');
    expect(gateSource).not.toContain('dangerouslySetInnerHTML');
    expect(gateSource).not.toContain('localStorage');
    expect(gateSource).not.toContain('document.cookie');
  });

  it('در چیدمان ادمین رندر شده است', () => {
    expect(layout).toContain("import AdminSessionGate from './login/admin-session-gate'");
    expect(layout).toContain('<AdminSessionGate />');
  });
});
