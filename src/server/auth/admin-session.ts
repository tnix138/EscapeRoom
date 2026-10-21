// src/server/auth/admin-session.ts
// جلسهٔ ادمین (قرارداد ۵ — فاز ۰۹): توکن امضاشدهٔ HMAC در کوکی httpOnly.
//
// چرا HMAC و نه JWT کتابخانه‌ای؟ قرارداد فقط «JWT در کوکی httpOnly» را الزام
// می‌کند و ما هیچ وابستگی تازه‌ای اضافه نمی‌کنیم؛ ساختار
// `header.payload.signature` با base64url و HMAC-SHA256 دقیقاً همان چیزی است
// که `jose` می‌سازد، ولی با `node:crypto` و بدون بستهٔ جدید.
//
// پیکربندی (همه از env، هیچ اعتبارنامه‌ای در کد نیست):
//   ADMIN_USERNAME       — نام کاربری مدیر
//   ADMIN_PASSWORD_HASH  — sha256 هگز گذرواژه (توصیه‌شده)
//   ADMIN_PASSWORD       — گذرواژهٔ خام فقط برای اجرای محلی
//   ADMIN_ROLE           — superadmin | moderator | viewer (پیش‌فرض superadmin)
//   ADMIN_SESSION_SECRET — کلید امضای جلسه (الزامی در production)
// اگر هیچ‌کدام تنظیم نشده باشد، ورود ۵۰۳ می‌دهد (fail-closed)، نه ۲۰۰.
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AdminRole } from '../../app/admin/login/login-rules';

export const ADMIN_COOKIE_NAME = 'orf_admin_session';
/** عمر جلسه: ۸ ساعت — یک شیفت کاری. */
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** سقف تلاش ورود: ۵ بار در دقیقه برای هر IP. */
export const ADMIN_LOGIN_RATE_LIMIT_MAX = 5;
export const ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS = 60_000;

export interface AdminSession {
  adminId: string;
  username: string;
  role: AdminRole;
  createdAt: number;
  expiresAt: number;
}

export interface AdminCredentials {
  username: string;
  passwordHash: string;
  role: AdminRole;
}

export interface AdminConfig {
  credentials: AdminCredentials | null;
  secret: string | null;
}

const ROLES: readonly AdminRole[] = ['superadmin', 'moderator', 'viewer'];

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function parseRole(value: string): AdminRole {
  const role = value.toLowerCase() as AdminRole;
  return ROLES.includes(role) ? role : 'superadmin';
}

/** خواندن پیکربندی از env؛ تست‌ها می‌توانند env را قبل از فراخوانی ست کنند. */
export function readAdminConfig(
  env: Record<string, string | undefined> = process.env,
): AdminConfig {
  const username = (env.ADMIN_USERNAME ?? '').trim();
  const hash = (env.ADMIN_PASSWORD_HASH ?? '').trim().toLowerCase();
  const plain = env.ADMIN_PASSWORD ?? '';
  const passwordHash = hash || (plain ? sha256Hex(plain) : '');
  const secret = (env.ADMIN_SESSION_SECRET ?? '').trim();
  return {
    credentials: username && passwordHash ? { username, passwordHash, role: parseRole((env.ADMIN_ROLE ?? '').trim()) } : null,
    secret: secret || null,
  };
}

export function isAdminConfigured(config: AdminConfig = readAdminConfig()): boolean {
  return config.credentials !== null && config.secret !== null;
}

/**
 * بررسی نام کاربری + گذرواژه با مقایسهٔ ثابت‌زمان.
 * حتی وقتی نام کاربری غلط است، هش گذرواژه محاسبه و مقایسه می‌شود تا زمان
 * پاسخ تفاوت معناداری نداشته باشد (ضد timing attack).
 */
export function verifyAdminCredentials(
  username: string,
  password: string,
  config: AdminConfig = readAdminConfig(),
): AdminSession | null {
  const credentials = config.credentials;
  if (!credentials) return null;
  const usernameMatches = safeEqual(username.trim(), credentials.username);
  const passwordMatches = safeEqual(sha256Hex(password), credentials.passwordHash);
  if (!usernameMatches || !passwordMatches) return null;
  const now = Date.now();
  return {
    adminId: `admin-${sha256Hex(credentials.username).slice(0, 12)}`,
    username: credentials.username,
    role: credentials.role,
    createdAt: now,
    expiresAt: now + ADMIN_SESSION_TTL_MS,
  };
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('base64url');
}

/** امضای جلسه به شکل `header.payload.signature` (JWT HS256). */
export function signAdminSession(session: AdminSession, secret: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      sub: session.adminId,
      username: session.username,
      role: session.role,
      iat: Math.floor(session.createdAt / 1000),
      exp: Math.floor(session.expiresAt / 1000),
      jti: randomUUID(),
    }),
  );
  const body = `${header}.${payload}`;
  return `${body}.${sign(body, secret)}`;
}

/** اعتبارسنجی امضا و انقضا؛ هر خطایی → null (بدون استثنا). */
export function verifyAdminSessionToken(
  token: string | null | undefined,
  secret: string,
  now = Date.now(),
): AdminSession | null {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];
  const expected = sign(`${header}.${payload}`, secret);
  if (!safeEqual(signature, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    const username = typeof parsed.username === 'string' ? parsed.username : '';
    const role = typeof parsed.role === 'string' && ROLES.includes(parsed.role as AdminRole)
      ? (parsed.role as AdminRole)
      : 'viewer';
    const exp = typeof parsed.exp === 'number' ? parsed.exp * 1000 : 0;
    const iat = typeof parsed.iat === 'number' ? parsed.iat * 1000 : 0;
    if (!username || exp <= now) return null;
    return {
      adminId: typeof parsed.sub === 'string' && parsed.sub ? parsed.sub : 'admin',
      username,
      role,
      createdAt: iat,
      expiresAt: exp,
    };
  } catch {
    return null;
  }
}

/** خواندن توکن جلسه از هدر Cookie (بدون وابستگی به Next). */
export function readCookieValue(cookieHeader: string | null, name = ADMIN_COOKIE_NAME): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    return decodeURIComponent(part.slice(index + 1).trim());
  }
  return null;
}

/** رشتهٔ Set-Cookie جلسه؛ httpOnly + sameSite=lax و در production secure. */
export function adminSessionCookie(token: string, maxAgeMs = ADMIN_SESSION_TTL_MS): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const maxAge = Math.max(0, Math.floor(maxAgeMs / 1000));
  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** کوکی پاک‌کننده (خروج). */
export function clearAdminSessionCookie(): string {
  return adminSessionCookie('', 0);
}
