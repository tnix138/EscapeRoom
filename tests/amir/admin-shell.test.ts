// تست فاز ۰۹-ب — پوستهٔ پنل ادمین: صفحهٔ ورود، چیدمان و هدایت بازدیدکنندهٔ بدون جلسه
// پس از ادغام، صفحهٔ ورود و چیدمان نسخهٔ امیرعلی است؛ این تست‌ها رفتار را قفل می‌کنند.
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) as string } : undefined,
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  useRouter: () => ({ replace: () => undefined, refresh: () => undefined, push: () => undefined }),
}));

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminLoginPage from '../../src/app/admin/login/page';
import AdminLayout from '../../src/app/admin/layout';
import { ADMIN_LOGIN_PATH, requireAdminPage } from '../../src/app/admin/guard';
import {
  ADMIN_COOKIE_NAME,
  signAdminSession,
  verifyAdminCredentials,
} from '../../src/server/auth/admin-session';

const SECRET = 'admin-shell-test-session-secret';
const USERNAME = 'shell-admin';
const PASSWORD = 'ramz-e-shell-12345';

beforeEach(() => {
  process.env.ADMIN_USERNAME = USERNAME;
  process.env.ADMIN_PASSWORD_HASH = createHash('sha256').update(PASSWORD, 'utf8').digest('hex');
  process.env.ADMIN_SESSION_SECRET = SECRET;
  delete process.env.ADMIN_ROLE;
  cookieJar.clear();
});

function validToken(): string {
  const session = verifyAdminCredentials(USERNAME, PASSWORD);
  if (!session) throw new Error('جلسهٔ تست ساخته نشد');
  return signAdminSession(session, SECRET);
}

describe('فاز ۰۹-ب — صفحهٔ ورود و چیدمان', () => {
  it('صفحهٔ ورود فرم فارسی را بدون خطا رندر می‌کند', () => {
    const html = renderToStaticMarkup(createElement(AdminLoginPage));
    expect(html.length).toBeGreaterThan(100);
    // فرم ورود باید فیلدهای نام کاربری و گذرواژه داشته باشد
    expect(html).toMatch(/username|نام کاربری/);
    expect(html).toMatch(/password/);
  });

  it('چیدمان ادمین فرزندان را رندر می‌کند', () => {
    const html = renderToStaticMarkup(
      AdminLayout({ children: createElement('span', null, 'محتوای تست') }),
    );
    expect(html).toContain('محتوای تست');
  });
});

describe('فاز ۰۹-ب — محافظت از مسیرهای ادمین', () => {
  it('بدون جلسه به /admin/login هدایت می‌شود', async () => {
    await expect(requireAdminPage()).rejects.toThrow(`REDIRECT:${ADMIN_LOGIN_PATH}`);
  });

  it('با جلسهٔ معتبر نشست برمی‌گردد', async () => {
    cookieJar.set(ADMIN_COOKIE_NAME, validToken());
    const session = await requireAdminPage();
    expect(session).toMatchObject({ username: USERNAME, role: 'superadmin' });
  });

  it('کوکی دست‌کاری‌شده یا منقضی به صفحهٔ ورود برمی‌گردد', async () => {
    cookieJar.set(ADMIN_COOKIE_NAME, `${validToken()}x`);
    await expect(requireAdminPage()).rejects.toThrow(`REDIRECT:${ADMIN_LOGIN_PATH}`);
  });

  it('وقتی env ادمین تنظیم نشده باشد، ریدایرکت به ورود انجام می‌شود', async () => {
    delete process.env.ADMIN_SESSION_SECRET;
    cookieJar.set(ADMIN_COOKIE_NAME, validToken());
    await expect(requireAdminPage()).rejects.toThrow(`REDIRECT:${ADMIN_LOGIN_PATH}`);
  });
});
