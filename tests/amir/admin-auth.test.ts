// تست فاز ۰۹ — احراز هویت ادمین: ورود، خروج، کوکی httpOnly و رد غیر ادمین
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scryptSync } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

// مسیر دیتابیس موقت باید پیش از اولین استفادهٔ ریپازیتوری در env باشد
const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-admin-auth-'));
process.env.ESCAPEROOM_DB_PATH = path.join(tmpDir, 'auth.db');

import { POST as loginRoute } from '../../src/app/api/admin/login/route';
import { POST as logoutRoute } from '../../src/app/api/admin/logout/route';
import { GET as statsRoute } from '../../src/app/api/admin/stats/route';
import { resetRateLimits } from '../../src/server/auth/rate-limit';
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookie,
  authenticateAdmin,
  clearedAdminSessionCookie,
  readAdminConfig,
  readCookie,
  signAdminSession,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from '../../src/server/admin/session';
import { createAdminSession } from '../../src/contracts/admin';

const ADMIN_USERNAME = 'tohid-admin';
const ADMIN_PASSWORD = 'ramz-e-adeem-12345';
const ADMIN_SECRET = 'test-session-secret-for-admin-panel';
const TEST_IP = '203.0.113.7';

function hashPassword(password: string, salt = 'a1b2c3d4e5f60718'): string {
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}

afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

beforeEach(() => {
  process.env.ADMIN_USERNAME = ADMIN_USERNAME;
  process.env.ADMIN_PASSWORD_HASH = hashPassword(ADMIN_PASSWORD);
  process.env.ADMIN_SESSION_SECRET = ADMIN_SECRET;
  delete process.env.ADMIN_ROLE;
  resetRateLimits();
});

function loginRequest(body: unknown, ip = TEST_IP): Request {
  return new Request('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

interface LoginBody {
  ok: boolean;
  data?: { session: { username: string; role: string; expiresAt: number } };
  error?: { code: string; message: string };
}

async function login(ip = TEST_IP): Promise<{ cookie: string; body: LoginBody }> {
  const res = await loginRoute(loginRequest({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }, ip));
  const raw = res.headers.get('set-cookie') ?? '';
  return {
    cookie: raw.split(';')[0] ?? '',
    body: (await res.json()) as LoginBody,
  };
}

function statsRequest(cookie?: string): Request {
  return new Request('http://localhost/api/admin/stats', {
    headers: cookie ? { cookie } : {},
  });
}

describe('فاز ۰۹ — ورود ادمین', () => {
  it('با نام کاربری و رمز درست، جلسه در کوکی httpOnly ست می‌شود', async () => {
    const res = await loginRoute(
      loginRequest({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    );
    expect(res.status).toBe(200);

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${ADMIN_SESSION_COOKIE}=`);
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');

    const body = (await res.json()) as LoginBody;
    expect(body.ok).toBe(true);
    expect(body.data?.session.username).toBe(ADMIN_USERNAME);
    expect(body.data?.session.role).toBe('superadmin');
    expect(body.data?.session.expiresAt).toBeGreaterThan(Date.now());
  });

  it('رمز اشتباه ۴۰۳ می‌گیرد و کوکی ست نمی‌شود', async () => {
    const res = await loginRoute(
      loginRequest({ username: ADMIN_USERNAME, password: 'ramz-e-eshtebah' }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('set-cookie')).toBeNull();
    const body = (await res.json()) as LoginBody;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('FORBIDDEN');
  });

  it('نام کاربری ناشناس هم ۴۰۳ می‌گیرد (بدون افشای وجود کاربر)', async () => {
    const res = await loginRoute(
      loginRequest({ username: 'karbar-nashenas', password: ADMIN_PASSWORD }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as LoginBody;
    expect(body.error?.code).toBe('FORBIDDEN');
  });

  it('بدنهٔ ناقص ۴۰۰ می‌گیرد', async () => {
    const res = await loginRoute(loginRequest({ username: ADMIN_USERNAME }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as LoginBody;
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('بعد از ۵ تلاش ناموفق، تلاش ششم ۴۲۹ می‌گیرد', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await loginRoute(
        loginRequest({ username: ADMIN_USERNAME, password: 'eshtebah' }, '198.51.100.9'),
      );
      expect(res.status).toBe(403);
    }
    const blocked = await loginRoute(
      loginRequest({ username: ADMIN_USERNAME, password: 'eshtebah' }, '198.51.100.9'),
    );
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as LoginBody;
    expect(body.error?.code).toBe('RATE_LIMITED');
  });

  it('بدون تنظیم env پنل، ورود ۵۰۳ می‌دهد', async () => {
    delete process.env.ADMIN_PASSWORD_HASH;
    const res = await loginRoute(
      loginRequest({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as LoginBody;
    expect(body.error?.code).toBe('ADMIN_NOT_CONFIGURED');
  });
});

describe('فاز ۰۹ — خروج و محافظت از مسیرها', () => {
  it('خروج کوکی را با Max-Age=0 پاک می‌کند', async () => {
    const res = await logoutRoute();
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${ADMIN_SESSION_COOKIE}=;`);
    expect(setCookie).toContain('Max-Age=0');
    expect((await res.json()) as { ok: boolean }).toMatchObject({ ok: true });
  });

  it('بدون کوکی، آمار ۴۰۱ می‌گیرد', async () => {
    const res = await statsRoute(statsRequest());
    expect(res.status).toBe(401);
    const body = (await res.json()) as LoginBody;
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  it('کوکی با امضای دست‌کاری‌شده ۴۰۱ می‌گیرد', async () => {
    const { cookie } = await login();
    const tampered = `${cookie}x`;
    const res = await statsRoute(statsRequest(tampered));
    expect(res.status).toBe(401);
  });

  it('جلسهٔ منقضی‌شده ۴۰۱ می‌گیرد', async () => {
    const config = readAdminConfig();
    expect(config).not.toBeNull();
    const expired = createAdminSession({
      adminId: 'adm_test',
      username: ADMIN_USERNAME,
      role: 'superadmin',
      now: Date.now() - 9 * 60 * 60 * 1_000,
      ttlMs: 8 * 60 * 60 * 1_000,
    });
    const token = signAdminSession(expired, config!.sessionSecret);
    const res = await statsRoute(statsRequest(`${ADMIN_SESSION_COOKIE}=${token}`));
    expect(res.status).toBe(401);
  });

  it('کوکی معتبر به آمار دسترسی می‌دهد', async () => {
    const { cookie } = await login();
    const res = await statsRoute(statsRequest(cookie));
    expect(res.status).toBe(200);
    expect((await res.json()) as { ok: boolean }).toMatchObject({ ok: true });
  });
});

describe('فاز ۰۹ — توابع نشست', () => {
  it('هش scrypt درست را می‌پذیرد و هش خراب را رد می‌کند', () => {
    const stored = hashPassword(ADMIN_PASSWORD);
    expect(verifyAdminPassword(ADMIN_PASSWORD, stored)).toBe(true);
    expect(verifyAdminPassword('ramz-e-digar', stored)).toBe(false);
    expect(verifyAdminPassword(ADMIN_PASSWORD, 'md5$salt$hash')).toBe(false);
    expect(verifyAdminPassword(ADMIN_PASSWORD, '')).toBe(false);
  });

  it('احراز هویت نشست با نقش پیش‌فرض superadmin می‌سازد', () => {
    const config = readAdminConfig();
    const session = authenticateAdmin(ADMIN_USERNAME, ADMIN_PASSWORD, config!);
    expect(session).not.toBeNull();
    expect(session?.role).toBe('superadmin');
    expect(session?.expiresAt).toBeGreaterThan(session?.createdAt ?? 0);
    expect(authenticateAdmin('karbar-digar', ADMIN_PASSWORD, config!)).toBeNull();
  });

  it('توکن امضا و بازخوانی می‌شود و توکن دست‌کاری‌شده رد می‌شود', () => {
    const session = createAdminSession({
      adminId: 'adm_x',
      username: ADMIN_USERNAME,
      role: 'moderator',
    });
    const token = signAdminSession(session, ADMIN_SECRET);
    const restored = verifyAdminSessionToken(token, ADMIN_SECRET);
    expect(restored).toMatchObject({
      adminId: 'adm_x',
      username: ADMIN_USERNAME,
      role: 'moderator',
    });
    expect(verifyAdminSessionToken(token, 'secret-digar')).toBeNull();
    expect(verifyAdminSessionToken('not-a-jwt', ADMIN_SECRET)).toBeNull();
  });

  it('کوکی در حالت production پرچم Secure دارد و در حالت دیگر ندارد', () => {
    const prod = adminSessionCookie('token-value', 60_000, true);
    expect(prod).toContain('Secure');
    expect(prod).toContain('HttpOnly');
    expect(adminSessionCookie('token-value', 60_000, false)).not.toContain('Secure');
    expect(clearedAdminSessionCookie(false)).toContain('Max-Age=0');
  });

  it('readCookie مقدار کوکی را از هدر جدا می‌کند', () => {
    const req = new Request('http://localhost/x', {
      headers: { cookie: `a=1; ${ADMIN_SESSION_COOKIE}=abc.def.ghi; b=2` },
    });
    expect(readCookie(req, ADMIN_SESSION_COOKIE)).toBe('abc.def.ghi');
    expect(readCookie(req, 'mojood-nist')).toBeNull();
    expect(readCookie(new Request('http://localhost/x'), ADMIN_SESSION_COOKIE)).toBeNull();
  });
});
