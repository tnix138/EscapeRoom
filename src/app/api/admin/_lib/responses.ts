// src/app/api/admin/_lib/responses.ts — پاسخ‌های مشترک پنل ادمین (فاز ۰۹)
// هم‌شکل با قرارداد ۴ (ApiError): { ok: false, error: { code, message } }
import { NextResponse } from 'next/server';
import { canModerate, type AdminSession } from '@/contracts/admin';
import { readAdminConfig, readAdminSession } from '@/server/admin/session';

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

/** احراز نشست ادمین؛ برای عملیات مدیریتی نقش moderator/superadmin لازم است. */
export function requireAdmin(req: Request, options: { moderate?: boolean } = {}): AdminAuthResult {
  const config = readAdminConfig();
  if (!config) {
    return {
      ok: false,
      response: jsonError(
        'ADMIN_NOT_CONFIGURED',
        'پنل ادمین تنظیم نشده است؛ ADMIN_USERNAME، ADMIN_PASSWORD_HASH و ADMIN_SESSION_SECRET را تنظیم کنید.',
        503,
      ),
    };
  }
  const session = readAdminSession(req, config);
  if (!session) {
    return {
      ok: false,
      response: jsonError('UNAUTHORIZED', 'برای دیدن این صفحه باید وارد شوید.', 401),
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
