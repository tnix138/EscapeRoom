// src/app/api/admin/_lib/responses.ts — پاسخ‌های مشترک پنل ادمین (فاز ۰۹)
// هم‌شکل با قرارداد ۴ (ApiError): { ok: false, error: { code, message } }
// احراز هویت روی همان ماژول مشترک `src/server/auth/admin-session.ts` است.
import { NextResponse } from 'next/server';
import { canModerate } from '@/contracts/admin';
import {
  ADMIN_COOKIE_NAME,
  readAdminConfig,
  readCookieValue,
  verifyAdminSessionToken,
  type AdminSession,
} from '@/server/auth/admin-session';

export function jsonOk<T>(data: T, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(
    { ok: true, data },
    { status: init?.status ?? 200, headers: init?.headers },
  );
}

export function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export type AdminAuthResult =
  | { ok: true; session: AdminSession }
  | { ok: false; response: NextResponse };

/** نشست معتبر از کوکی httpOnly؛ بدون وابستگی به next/headers. */
export function readRequestSession(req: Request): AdminSession | null {
  const config = readAdminConfig();
  if (!config.credentials || !config.secret) return null;
  const token = readCookieValue(req.headers.get('cookie'), ADMIN_COOKIE_NAME);
  return verifyAdminSessionToken(token, config.secret);
}

/**
 * احراز نشست ادمین برای route handlerها.
 * - پیکربندی ناقص → ۵۰۳ (fail-closed)
 * - بدون نشست یا نشست نامعتبر → ۴۰۱
 * - عملیات مدیریتی با نقش `viewer` → ۴۰۳ (قرارداد: غیر ادمین ۴۰۳)
 */
export function requireAdmin(req: Request, options: { moderate?: boolean } = {}): AdminAuthResult {
  const config = readAdminConfig();
  if (!config.credentials || !config.secret) {
    return {
      ok: false,
      response: jsonError(
        'ADMIN_NOT_CONFIGURED',
        'پنل ادمین تنظیم نشده است؛ ADMIN_USERNAME، ADMIN_PASSWORD_HASH و ADMIN_SESSION_SECRET را تنظیم کنید.',
        503,
      ),
    };
  }
  const session = readRequestSession(req);
  if (!session) {
    return {
      ok: false,
      response: jsonError('UNAUTHORIZED', 'برای انجام این کار باید وارد شوید.', 401),
    };
  }
  if (options.moderate && !canModerate(session.role)) {
    return {
      ok: false,
      response: jsonError('FORBIDDEN', 'نقش شما اجازهٔ این عملیات را ندارد.', 403),
    };
  }
  return { ok: true, session };
}
