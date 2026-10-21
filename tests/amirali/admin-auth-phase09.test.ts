import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_MS,
  adminSessionCookie,
  clearAdminSessionCookie,
  isAdminConfigured,
  readAdminConfig,
  readCookieValue,
  sha256Hex,
  signAdminSession,
  verifyAdminCredentials,
  verifyAdminSessionToken,
} from '../../src/server/auth/admin-session';
import { resetRateLimits } from '../../src/server/auth/rate-limit';
import { POST as loginRoute } from '../../src/app/api/admin/login/route';
import { POST as logoutRoute } from '../../src/app/api/admin/logout/route';
import { GET as sessionRoute } from '../../src/app/api/admin/session/route';

/**
 * فاز ۰۹-الف — احراز هویت ادمین (قرارداد ۵)
 * -------------------------------------------------------------------------
 * قفل می‌کند: امضای HMAC جلسه، رد توکن دست‌کاری‌شده/منقضی، کوکی httpOnly،
 * ۴۰۱ برای گذرواژهٔ غلط، ۴۲۹ برای تلاش زیاد و ۵۰۳ وقتی پیکربندی نیست
 * (fail-closed؛ هرگز جلسهٔ بدون کلید صادر نمی‌شود).
 */

const USERNAME = 'admin-orfeo';
const PASSWORD = 'secret-pass-123';
const SECRET = 'test-session-secret-0123456789';

const ENV_KEYS = ['ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH', 'ADMIN_PASSWORD', 'ADMIN_ROLE', 'ADMIN_SESSION_SECRET'] as const;
const saved: Record<string, string | undefined> = {};

function configure() {
  process.env.ADMIN_USERNAME = USERNAME;
  process.env.ADMIN_PASSWORD_HASH = sha256Hex(PASSWORD);
  process.env.ADMIN_ROLE = 'moderator';
  process.env.ADMIN_SESSION_SECRET = SECRET;
}

function unconfigure() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function loginRequest(body: unknown, ip = '10.0.0.1'): Request {
  return new Request('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  unconfigure();
  resetRateLimits();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key] as string;
  }
  resetRateLimits();
});

describe('فاز ۰۹-الف — پیکربندی و اعتبارنامه', () => {
  it('بدون env، پیکربندی ناقص است (fail-closed)', () => {
    const config = readAdminConfig({});
    expect(config.credentials).toBeNull();
    expect(config.secret).toBeNull();
    expect(isAdminConfigured(config)).toBe(false);
  });

  it('گذرواژهٔ خام به هش تبدیل و نقش ناشناخته به superadmin تبدیل می‌شود', () => {
    const config = readAdminConfig({
      ADMIN_USERNAME: 'a',
      ADMIN_PASSWORD: PASSWORD,
      ADMIN_ROLE: 'hacker',
    });
    expect(config.credentials?.passwordHash).toBe(sha256Hex(PASSWORD));
    expect(config.credentials?.role).toBe('superadmin');
    expect(config.secret).toBeNull();
    expect(isAdminConfigured(config)).toBe(false);
  });

  it('گذرواژهٔ درست جلسه می‌سازد و گذرواژه/نام غلط جلسه نمی‌سازد', () => {
    configure();
    const session = verifyAdminCredentials(USERNAME, PASSWORD);
    expect(session).toMatchObject({ username: USERNAME, role: 'moderator' });
    expect(session!.expiresAt - session!.createdAt).toBe(ADMIN_SESSION_TTL_MS);
    expect(session!.adminId.startsWith('admin-')).toBe(true);

    expect(verifyAdminCredentials(USERNAME, `${PASSWORD}x`)).toBeNull();
    expect(verifyAdminCredentials('someone-else', PASSWORD)).toBeNull();
    expect(verifyAdminCredentials('', '')).toBeNull();
  });

  it('نام کاربری با فاصلهٔ اضافه پذیرفته می‌شود ولی گذرواژه trim نمی‌شود', () => {
    configure();
    expect(verifyAdminCredentials(`  ${USERNAME}  `, PASSWORD)).not.toBeNull();
    expect(verifyAdminCredentials(USERNAME, ` ${PASSWORD}`)).toBeNull();
  });
});

describe('فاز ۰۹-الف — امضا و اعتبارسنجی جلسه', () => {
  const session = {
    adminId: 'admin-abc',
    username: USERNAME,
    role: 'superadmin' as const,
    createdAt: 1_700_000_000_000,
    expiresAt: 1_700_000_000_000 + ADMIN_SESSION_TTL_MS,
  };

  it('توکن سه‌بخشی ساخته و با همان کلید تأیید می‌شود', () => {
    const token = signAdminSession(session, SECRET);
    expect(token.split('.')).toHaveLength(3);
    // `now` صریح داده می‌شود؛ جلسهٔ نمونه در گذشتهٔ ثابت ساخته شده است.
    const verified = verifyAdminSessionToken(token, SECRET, session.createdAt + 1_000);
    expect(verified).toMatchObject({ adminId: 'admin-abc', username: USERNAME, role: 'superadmin' });
    expect(verified?.expiresAt).toBe(Math.floor(session.expiresAt / 1000) * 1000);
  });

  it('توکن دست‌کاری‌شده، کلید اشتباه و ورودی خراب رد می‌شوند', () => {
    const token = signAdminSession(session, SECRET);
    const [header, payload, signature] = token.split('.') as [string, string, string];
    // تغییر نقش در payload بدون امضای تازه
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'admin-abc', username: USERNAME, role: 'superadmin', iat: 1, exp: 9_999_999_999 }),
    ).toString('base64url');
    expect(verifyAdminSessionToken(`${header}.${forgedPayload}.${signature}`, SECRET)).toBeNull();
    expect(verifyAdminSessionToken(token, 'another-secret')).toBeNull();
    for (const bad of ['', 'a.b', 'a.b.c.d', 'x.y.z', null, undefined]) {
      expect(verifyAdminSessionToken(bad as string, SECRET)).toBeNull();
    }
  });

  it('جلسهٔ منقضی رد می‌شود', () => {
    const token = signAdminSession({ ...session, expiresAt: 1_700_000_100_000 }, SECRET);
    expect(verifyAdminSessionToken(token, SECRET, 1_700_000_200_000)).toBeNull();
    expect(verifyAdminSessionToken(token, SECRET, 1_700_000_050_000)).not.toBeNull();
  });

  it('کوکی httpOnly با همان نام و max-age ساخته و پاک می‌شود', () => {
    const cookie = adminSessionCookie('tok.en.value');
    expect(cookie).toContain(`${ADMIN_COOKIE_NAME}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(clearAdminSessionCookie()).toContain('Max-Age=0');
  });
});

describe('فاز ۰۹-الف — خواندن کوکی', () => {
  it('از بین چند کوکی، فقط کوکی جلسه را برمی‌گرداند', () => {
    const header = `theme=dark; ${ADMIN_COOKIE_NAME}=abc%2Edef; other=1`;
    expect(readCookieValue(header)).toBe('abc.def');
    expect(readCookieValue('theme=dark')).toBeNull();
    expect(readCookieValue(null)).toBeNull();
    expect(readCookieValue('')).toBeNull();
    expect(readCookieValue(`${ADMIN_COOKIE_NAME}`)).toBeNull();
  });
});

describe('فاز ۰۹-الف — مسیرهای HTTP', () => {
  const okBody = { username: USERNAME, password: PASSWORD };

  it('بدون پیکربندی، ورود ۵۰۳ می‌دهد و کوکی صادر نمی‌کند', async () => {
    const response = await loginRoute(loginRequest(okBody));
    expect(response.status).toBe(503);
    expect(response.headers.get('set-cookie')).toBeNull();
    const payload = await response.json();
    expect(payload.error.code).toBe('ADMIN_NOT_CONFIGURED');
  });

  it('ورود درست ۲۰۰ + کوکی httpOnly می‌دهد و جلسه با همان کوکی تأیید می‌شود', async () => {
    configure();
    const response = await loginRoute(loginRequest(okBody));
    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('HttpOnly');
    const payload = await response.json();
    expect(payload.data).toMatchObject({ username: USERNAME, role: 'moderator' });

    const token = cookie.split(';')[0]!.split('=')[1]!;
    const sessionResponse = await sessionRoute(
      new Request('http://localhost/api/admin/session', {
        headers: { cookie: `${ADMIN_COOKIE_NAME}=${token}` },
      }),
    );
    expect(sessionResponse.status).toBe(200);
    expect((await sessionResponse.json()).data.username).toBe(USERNAME);
  });

  it('گذرواژهٔ غلط ۴۰۱ و بدنهٔ خراب ۴۰۰ می‌گیرد', async () => {
    configure();
    const wrong = await loginRoute(loginRequest({ ...okBody, password: 'nope' }, '10.0.0.2'));
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).error.code).toBe('INVALID_CREDENTIALS');

    for (const bad of [null, {}, { username: '' }, { username: USERNAME }, { username: 3, password: 'x' }]) {
      const response = await loginRoute(loginRequest(bad, '10.0.0.3'));
      expect(response.status).toBe(400);
    }
  });

  it('بیش از ۵ تلاش در دقیقه ۴۲۹ می‌گیرد', async () => {
    configure();
    for (let index = 0; index < 5; index += 1) {
      const response = await loginRoute(loginRequest({ ...okBody, password: 'bad' }, '10.9.9.9'));
      expect(response.status).toBe(401);
    }
    const limited = await loginRoute(loginRequest(okBody, '10.9.9.9'));
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe('RATE_LIMITED');
  });

  it('بررسی جلسه بدون کوکی یا با کوکی جعلی ۴۰۱ می‌دهد', async () => {
    configure();
    const none = await sessionRoute(new Request('http://localhost/api/admin/session'));
    expect(none.status).toBe(401);
    const fake = await sessionRoute(
      new Request('http://localhost/api/admin/session', {
        headers: { cookie: `${ADMIN_COOKIE_NAME}=a.b.c` },
      }),
    );
    expect(fake.status).toBe(401);
    expect((await fake.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('خروج کوکی را پاک می‌کند', async () => {
    const response = await logoutRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await response.json()).data.loggedOut).toBe(true);
  });
});
