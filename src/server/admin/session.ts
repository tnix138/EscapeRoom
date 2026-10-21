// src/server/admin/session.ts — نشست ادمین بدون وابستگی بیرونی (فاز ۰۹)
// مرجع: قرارداد ۵ در docs/CONTRACTS.md — جلسه با JWT در کوکی httpOnly،
// رمز فقط به شکل هش scrypt در env می‌ماند (ساخت هش: npm run hash:admin -- 'رمز').
import { createHash, createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  ADMIN_SESSION_TTL_MS,
  createAdminSession,
  isAdminRole,
  isAdminSessionExpired,
  type AdminRole,
  type AdminSession,
} from '../../contracts/admin';

/** نام کوکی نشست ادمین؛ httpOnly و SameSite=Lax. */
export const ADMIN_SESSION_COOKIE = 'orf_admin_session';

const SCRYPT_KEYLEN = 64;
const JWT_ALG = 'HS256';

export interface AdminConfig {
  username: string;
  passwordHash: string;
  sessionSecret: string;
  role: AdminRole;
}

/** خواندن تنظیمات ادمین از env؛ اگر هر سه مقدار لازم نباشند null برمی‌گردد. */
export function readAdminConfig(env: NodeJS.ProcessEnv = process.env): AdminConfig | null {
  const username = env.ADMIN_USERNAME?.trim();
  const passwordHash = env.ADMIN_PASSWORD_HASH?.trim();
  const sessionSecret = env.ADMIN_SESSION_SECRET?.trim();
  if (!username || !passwordHash || !sessionSecret) return null;
  const rawRole = env.ADMIN_ROLE?.trim();
  return {
    username,
    passwordHash,
    sessionSecret,
    role: isAdminRole(rawRole) ? rawRole : 'superadmin',
  };
}

function safeEqualText(a: string, b: string): boolean {
  const left = createHash('sha256').update(a, 'utf8').digest();
  const right = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(left, right);
}

/** بررسی رمز خام با هش ذخیره‌شدهٔ `scrypt$<salt>$<hash>` (مقایسه ثابت‌زمان). */
export function verifyAdminPassword(password: string, stored: string): boolean {
  const [scheme, salt, expected] = String(stored ?? '').split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  const target = Buffer.from(expected, 'hex');
  return actual.length === target.length && timingSafeEqual(actual, target);
}

/** شناسهٔ پایدار ادمین از روی نام کاربری (بدون ذخیرهٔ چیز اضافه در env). */
export function adminIdFor(username: string): string {
  return `adm_${createHash('sha256').update(username, 'utf8').digest('hex').slice(0, 12)}`;
}

/**
 * احراز هویت با نام کاربری و رمز.
 * هر دو بررسی همیشه اجرا می‌شوند تا زمان پاسخ نام کاربری ناموجود را لو ندهد.
 */
export function authenticateAdmin(
  username: string,
  password: string,
  config: AdminConfig,
  now = Date.now(),
): AdminSession | null {
  const usernameOk = safeEqualText(username.trim(), config.username);
  const passwordOk = verifyAdminPassword(password, config.passwordHash);
  if (!usernameOk || !passwordOk) return null;
  return createAdminSession({
    adminId: adminIdFor(config.username),
    username: config.username,
    role: config.role,
    now,
    ttlMs: ADMIN_SESSION_TTL_MS,
  });
}

interface AdminTokenPayload {
  sub: string;
  username: string;
  role: AdminRole;
  iat: number;
  exp: number;
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data, 'utf8').digest('base64url');
}

/** ساخت JWT (HS256) برای نشست ادمین. */
export function signAdminSession(session: AdminSession, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: JWT_ALG, typ: 'JWT' }), 'utf8').toString(
    'base64url',
  );
  const payload: AdminTokenPayload = {
    sub: session.adminId,
    username: session.username,
    role: session.role,
    iat: Math.floor(session.createdAt / 1_000),
    exp: Math.floor(session.expiresAt / 1_000),
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const data = `${header}.${body}`;
  return `${data}.${sign(data, secret)}`;
}

/** بررسی امضا و انقضای توکن؛ در هر خطایی null برمی‌گردد. */
export function verifyAdminSessionToken(
  token: string,
  secret: string,
  now = Date.now(),
): AdminSession | null {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts as [string, string, string];
  const expected = sign(`${header}.${body}`, secret);
  if (!safeEqualText(signature, expected)) return null;

  let payload: Partial<AdminTokenPayload>;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AdminTokenPayload;
  } catch {
    return null;
  }
  if (
    typeof payload.sub !== 'string' ||
    typeof payload.username !== 'string' ||
    !isAdminRole(payload.role) ||
    typeof payload.exp !== 'number'
  ) {
    return null;
  }

  const session: AdminSession = {
    adminId: payload.sub,
    username: payload.username,
    role: payload.role,
    createdAt: (payload.iat ?? 0) * 1_000,
    expiresAt: payload.exp * 1_000,
  };
  if (isAdminSessionExpired(session, now)) return null;
  return session;
}

/** خواندن یک کوکی از هدر درخواست بدون وابستگی به next/headers. */
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    return decodeURIComponent(part.slice(index + 1).trim());
  }
  return null;
}

/** نشست معتبر از درخواست HTTP؛ برای route handlerها. */
export function readAdminSession(
  req: Request,
  config: AdminConfig,
  now = Date.now(),
): AdminSession | null {
  const token = readCookie(req, ADMIN_SESSION_COOKIE);
  if (!token) return null;
  return verifyAdminSessionToken(token, config.sessionSecret, now);
}

/** مقدار Set-Cookie برای ورود موفق. */
export function adminSessionCookie(
  token: string,
  ttlMs = ADMIN_SESSION_TTL_MS,
  secure = process.env.NODE_ENV === 'production',
): string {
  const maxAge = Math.max(1, Math.floor(ttlMs / 1_000));
  return [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

/** مقدار Set-Cookie برای خروج (پاک کردن کوکی). */
export function clearedAdminSessionCookie(
  secure = process.env.NODE_ENV === 'production',
): string {
  return [
    `${ADMIN_SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

/** IP درخواست برای سقف نرخ ورود (پشت پروکسی Vercel). */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
