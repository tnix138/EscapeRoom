// تست فاز ۰۹-ب — پوستهٔ پنل ادمین: رندر صفحهٔ ورود و هدایت بازدیدکنندهٔ بدون جلسه
// (فایل‌های این تست در محدودهٔ Issue #95 است؛ نسخهٔ فعلی پوستهٔ کارآمد توحید است
// و هر وقت امیرعلی طرح نهایی را آورد، این تست‌ها باید سبز بمانند.)
import { scryptSync } from 'node:crypto';
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
  useRouter: () => ({ replace: () => undefined, refresh: () => undefined }),
}));

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminLoginPage from '../../src/app/admin/login/page';
import AdminLayout from '../../src/app/admin/layout';
import AdminDashboardPage from '../../src/app/admin/page';
import { ADMIN_LOGIN_PATH, requireAdminPage } from '../../src/app/admin/guard';
import {
  ADMIN_SESSION_COOKIE,
  adminIdFor,
  signAdminSession,
} from '../../src/server/admin/session';
import { createAdminSession } from '../../src/contracts/admin';

const SECRET = 'admin-shell-test-session-secret';
const USERNAME = 'shell-admin';
const PASSWORD = 'ramz-e-shell-12345';
const salt = '0badc0de0badc0de';

beforeEach(() => {
  process.env.ADMIN_USERNAME = USERNAME;
  process.env.ADMIN_PASSWORD_HASH = `scrypt$${salt}$${scryptSync(PASSWORD, salt, 64).toString('hex')}`;
  process.env.ADMIN_SESSION_SECRET = SECRET;
  cookieJar.clear();
});

function validToken(ttlMs = 60 * 60 * 1_000): string {
  return signAdminSession(
    createAdminSession({
      adminId: adminIdFor(USERNAME),
      username: USERNAME,
      role: 'superadmin',
      ttlMs,
    }),
    SECRET,
  );
}

describe('فاز ۰۹-ب — صفحهٔ ورود و چیدمان', () => {
  it('صفحهٔ ورود فرم فارسی را بدون خطا رندر می‌کند', () => {
    const element = AdminLoginPage();
    expect(element).toBeTruthy();

    const html = renderToStaticMarkup(element);
    expect(html).toContain('ورود به پنل ادمین');
    expect(html).toContain('نام کاربری');
    expect(html).toContain('رمز عبور');
    expect(html).toContain('type="password"');
  });

  it('چیدمان ادمین فرزندان را داخل خود رندر می‌کند', () => {
    const html = renderToStaticMarkup(
      AdminLayout({ children: createElement('span', null, 'محتوای تست') }),
    );
    expect(html).toContain('محتوای تست');
  });
});

describe('فاز ۰۹-ب — محافظت از مسیرهای ادمین', () => {
  it('بدون جلسه، بازدیدکننده به /admin/login هدایت می‌شود', async () => {
    await expect(requireAdminPage()).rejects.toThrow(`REDIRECT:${ADMIN_LOGIN_PATH}`);
  });

  it('با جلسهٔ معتبر، نشست برگردانده می‌شود', async () => {
    cookieJar.set(ADMIN_SESSION_COOKIE, validToken());
    const session = await requireAdminPage();
    expect(session).toMatchObject({ username: USERNAME, role: 'superadmin' });
  });

  it('با کوکی دست‌کاری‌شده یا منقضی، دوباره به صفحهٔ ورود برمی‌گردد', async () => {
    cookieJar.set(ADMIN_SESSION_COOKIE, `${validToken()}x`);
    await expect(requireAdminPage()).rejects.toThrow(`REDIRECT:${ADMIN_LOGIN_PATH}`);

    cookieJar.set(
      ADMIN_SESSION_COOKIE,
      validToken(-1 * 60 * 1_000), // یک دقیقه پیش منقضی شده
    );
    await expect(requireAdminPage()).rejects.toThrow(`REDIRECT:${ADMIN_LOGIN_PATH}`);
  });

  it('وقتی env ادمین تنظیم نشده باشد، به صفحهٔ ورود هدایت می‌شود', async () => {
    delete process.env.ADMIN_USERNAME;
    cookieJar.set(ADMIN_SESSION_COOKIE, validToken());
    await expect(requireAdminPage()).rejects.toThrow(`REDIRECT:${ADMIN_LOGIN_PATH}`);
  });

  it('صفحهٔ داشبورد بدون جلسه رندر نمی‌شود و به ورود می‌رود', async () => {
    await expect(AdminDashboardPage()).rejects.toThrow(`REDIRECT:${ADMIN_LOGIN_PATH}`);
  });
});
