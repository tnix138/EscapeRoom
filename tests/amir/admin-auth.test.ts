// تست فاز ۰۹ — احراز هویت ادمین روی ماژول مشترک `src/server/auth/admin-session.ts`
// (پس از ادغام شاخهٔ توحید با شاخهٔ امیرعلی؛ هر دو قالب هش و هر دو مسیر پوشش داده می‌شوند)
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash, scryptSync } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
}));

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-admin-auth-'));
process.env.ESCAPEROOM_DB_PATH = path.join(tmpDir, 'auth.db');

import { POST as loginRoute } from '../../src/app/api/admin/login/route';
import { POST as logoutRoute } from '../../src/app/api/admin/logout/route';
import { GET as sessionRoute } from '../../src/app/api/admin/session/route';
import { GET as statsRoute } from '../../src/app/api/admin/stats/route';
import { resetRateLimits } from '../../src/server/auth/rate-limit';
import {
  ADMIN_COOKIE_NAME,
  adminSessionCookie,
  isAdminConfigured,
  readAdminConfig,
  readCookieValue,
  signAdminSession,
  verifyAdminCredentials,
  verifyAdminSessionToken,
} from '../../src/server/auth/admin-session';
import { requireAdminPage, ADMIN_LOGIN_PATH } from '../../src/app/admin/guard';

const ADMIN_USERNAME = 'tohid-admin';
const ADMIN_PASSWORD = 'ramz-e-adeem-12345';
const ADMIN_SECRET = 'test-session-secret-for-admin-panel';
const TEST_IP = '203.0.113.7';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function scryptHash(password: string, salt = 'a1b2c3d4e5f60718'): string {
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}

afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

beforeEach(() => {
  process.env.ADMIN_USERNAME = ADMIN_USERNAME;
  process.env.ADMIN_PASSWORD_HASH = sha256Hex(ADMIN_PASSWORD);
  process.env.ADMIN_SESSION_SECRET = ADMIN_SECRET;
  delete process.env.ADMIN_ROLE;
  delete process.env.ADMIN_PASSWORD;
  cookieJar.clear();
  resetRateLimits();
});

function loginRequest(body: unknown, ip = TEST_IP): Request {
  return new Request('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

interface ErrorBody {
  ok: boolean;
  error?: { code: string; message: string };
  data?: { username?: string; role?: string; expiresAt?: number };
}

async function login(ip = TEST_IP): Promise<{ cookie: string; body: ErrorBody }> {
  const res = await loginRoute(loginRequest({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }, ip));
  const raw = res.headers.get('set-cookie') ?? '';
  return { cookie: raw.split(';')[0] ?? '', body: (await res.json()) as ErrorBody };
}

describe('فاز ۰۹ — ورود ادمین (endpoint)', () => {
  it('با اطلاعات درست ۲۰۰ و کوکی httpOnly برمی‌گرداند', async () => {
    const res = await loginRoute(
      loginRequest({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    );
    expect(res.status).toBe(200);

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${ADMIN_COOKIE_NAME}=`);
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');

    const body = (await res.json()) as ErrorBody;
    expect(body.ok).toBe(true);
    expect(body.data?.username).toBe(ADMIN_USERNAME);
    expect(body.data?.role).toBe('superadmin');
  });

  it('گذرواژهٔ اشتباه ۴۰۱ می‌گیرد و کوکی ست نمی‌شود', async () => {
    const res = await loginRoute(
      loginRequest({ username: ADMIN_USERNAME, password: 'ramz-e-eshtebah' }),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
    const body = (await res.json()) as ErrorBody;
    expect(body.error?.code).toBe('INVALID_CREDENTIALS');
  });

  it('نام کاربری ناشناس هم ۴۰۱ می‌گیرد (بدون افشای وجود کاربر)', async () => {
    const res = await loginRoute(
      loginRequest({ username: 'karbar-nashenas', password: ADMIN_PASSWORD }),
    );
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorBody).error?.code).toBe('INVALID_CREDENTIALS');
  });

  it('بدنهٔ ناقص ۴۰۰ می‌گیرد', async () => {
    const res = await loginRoute(loginRequest({ username: ADMIN_USERNAME }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorBody).error?.code).toBe('VALIDATION_ERROR');
  });

  it('بعد از ۵ تلاش ناموفق، تلاش ششم ۴۲۹ می‌گیرد', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await loginRoute(
        loginRequest({ username: ADMIN_USERNAME, password: 'eshtebah' }, '198.51.100.9'),
      );
      expect(res.status).toBe(401);
    }
    const blocked = await loginRoute(
      loginRequest({ username: ADMIN_USERNAME, password: 'eshtebah' }, '198.51.100.9'),
    );
    expect(blocked.status).toBe(429);
    expect(((await blocked.json()) as ErrorBody).error?.code).toBe('RATE_LIMITED');
  });

  it('بدون پیکربندی env، ورود ۵۰۳ می‌دهد (fail-closed)', async () => {
    delete process.env.ADMIN_SESSION_SECRET;
    const res = await loginRoute(
      loginRequest({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    );
    expect(res.status).toBe(503);
    expect(((await res.json()) as ErrorBody).error?.code).toBe('ADMIN_NOT_CONFIGURED');
  });

  it('هش scrypt ساخته‌شده با npm run hash:admin هم پذیرفته می‌شود', async () => {
    process.env.ADMIN_PASSWORD_HASH = scryptHash(ADMIN_PASSWORD);
    resetRateLimits();
    const res = await loginRoute(
      loginRequest({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }, '198.51.100.20'),
    );
    expect(res.status).toBe(200);
  });

  it('گذرواژهٔ خام محلی (ADMIN_PASSWORD) فقط وقتی هش نیست کار می‌کند', () => {
    delete process.env.ADMIN_PASSWORD_HASH;
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
    expect(verifyAdminCredentials(ADMIN_USERNAME, ADMIN_PASSWORD)).not.toBeNull();
    expect(verifyAdminCredentials(ADMIN_USERNAME, 'ghalat')).toBeNull();
  });
});

describe('فاز ۰۹ — خروج و بررسی جلسه', () => {
  it('خروج کوکی را با Max-Age=0 پاک می‌کند', async () => {
    const res = await logoutRoute();
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${ADMIN_COOKIE_NAME}=;`);
    expect(setCookie).toContain('Max-Age=0');
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it('بدون کوکی، بررسی جلسه ۴۰۱ می‌دهد', async () => {
    const res = await sessionRoute(new Request('http://localhost/api/admin/session'));
    expect(res.status).toBe(401);
  });

  it('با کوکی معتبر، بررسی جلسه ۲۰۰ می‌دهد', async () => {
    const { cookie } = await login();
    const res = await sessionRoute(
      new Request('http://localhost/api/admin/session', { headers: { cookie } }),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as ErrorBody).data?.username).toBe(ADMIN_USERNAME);
  });

  it('کوکی دست‌کاری‌شده ۴۰۱ می‌گیرد', async () => {
    const { cookie } = await login();
    const res = await sessionRoute(
      new Request('http://localhost/api/admin/session', { headers: { cookie: `${cookie}x` } }),
    );
    expect(res.status).toBe(401);
  });
});

describe('فاز ۰۹ — محافظت از endpointهای ادمین و صفحات', () => {
  it('آمار بدون نشست ۴۰۱ و با نشست ۲۰۰ می‌دهد', async () => {
    const anonymous = await statsRoute(new Request('http://localhost/api/admin/stats'));
    expect(anonymous.status).toBe(401);

    const { cookie } = await login();
    const authed = await statsRoute(
      new Request('http://localhost/api/admin/stats', { headers: { cookie } }),
    );
    expect(authed.status).toBe(200);
  });

  it('نقش viewer به عملیات مدیریتی ۴۰۳ می‌گیرد', async () => {
    process.env.ADMIN_ROLE = 'viewer';
    resetRateLimits();
    const { cookie } = await login('198.51.100.30');
    const { DELETE } = await import('../../src/app/api/admin/players/[id]/route');
    const res = await DELETE(
      new Request('http://localhost/api/admin/players/seat-1', {
        method: 'DELETE',
        headers: { cookie },
      }),
      { params: Promise.resolve({ id: 'seat-1' }) },
    );
    expect(res.status).toBe(403);
    expect(((await res.json()) as ErrorBody).error?.code).toBe('FORBIDDEN');
  });

  it('صفحهٔ ادمین بدون نشست به /admin/login می‌رود و با نشست باز می‌شود', async () => {
    await expect(requireAdminPage()).rejects.toThrow(`REDIRECT:${ADMIN_LOGIN_PATH}`);

    const { cookie } = await login('198.51.100.31');
    const token = readCookieValue(cookie, ADMIN_COOKIE_NAME);
    expect(token).toBeTruthy();
    cookieJar.set(ADMIN_COOKIE_NAME, token as string);
    const session = await requireAdminPage();
    expect(session).toMatchObject({ username: ADMIN_USERNAME, role: 'superadmin' });
  });

  it('پیکربندی ناقص = قفل بسته و ریدایرکت به ورود', async () => {
    delete process.env.ADMIN_USERNAME;
    cookieJar.set(ADMIN_COOKIE_NAME, 'a.b.c');
    expect(isAdminConfigured(readAdminConfig())).toBe(false);
    await expect(requireAdminPage()).rejects.toThrow(`REDIRECT:${ADMIN_LOGIN_PATH}`);
  });
});

describe('فاز ۰۹ — توابع جلسه', () => {
  it('توکن امضا و بازخوانی می‌شود و توکن دست‌کاری‌شده رد می‌شود', () => {
    const config = readAdminConfig();
    const session = verifyAdminCredentials(ADMIN_USERNAME, ADMIN_PASSWORD, config);
    expect(session).not.toBeNull();
    const token = signAdminSession(session!, ADMIN_SECRET);
    expect(verifyAdminSessionToken(token, ADMIN_SECRET)).toMatchObject({
      username: ADMIN_USERNAME,
      role: 'superadmin',
    });
    expect(verifyAdminSessionToken(token, 'secret-digar')).toBeNull();
    expect(verifyAdminSessionToken('not-a-jwt', ADMIN_SECRET)).toBeNull();
    expect(verifyAdminSessionToken(null, ADMIN_SECRET)).toBeNull();
  });

  it('کوکی در production پرچم Secure دارد و در حالت دیگر ندارد', () => {
    const previous = process.env.NODE_ENV;
    try {
      // @ts-expect-error — NODE_ENV فقط در زمان اجرا قابل تغییر است
      process.env.NODE_ENV = 'production';
      expect(adminSessionCookie('t', 60_000)).toContain('Secure');
      // @ts-expect-error
      process.env.NODE_ENV = 'test';
      expect(adminSessionCookie('t', 60_000)).not.toContain('Secure');
    } finally {
      // @ts-expect-error
      process.env.NODE_ENV = previous;
    }
  });
});
