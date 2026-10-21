// POST /api/admin/login — ورود ادمین (قرارداد ۵، فاز ۰۹)
// بدنه: { username, password } → ۲۰۰ + کوکی httpOnly | ۴۰۰ | ۴۰۱ | ۴۲۹ | ۵۰۳
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ADMIN_LOGIN_RATE_LIMIT_MAX,
  ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS,
  adminSessionCookie,
  isAdminConfigured,
  readAdminConfig,
  signAdminSession,
  verifyAdminCredentials,
} from '../../../../server/auth/admin-session';
import { checkAndRecord } from '../../../../server/auth/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  username: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(128),
});

function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
  return `admin-login:${ip}`;
}

export async function POST(req: Request) {
  const config = readAdminConfig();
  // پیکربندی ناقص = قفل بسته؛ هرگز جلسهٔ بدون کلید صادر نمی‌شود.
  if (!isAdminConfigured(config) || !config.secret) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'ADMIN_NOT_CONFIGURED',
          message: 'ورود مدیریت پیکربندی نشده است؛ ADMIN_USERNAME و ADMIN_SESSION_SECRET را تنظیم کنید.',
        },
      },
      { status: 503 },
    );
  }

  if (!checkAndRecord(clientKey(req), ADMIN_LOGIN_RATE_LIMIT_MAX, ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json(
      { ok: false, error: { code: 'RATE_LIMITED', message: 'تلاش‌های ورود بیش از حد مجاز است؛ یک دقیقه صبر کنید.' } },
      { status: 429 },
    );
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'نام کاربری و گذرواژه را کامل وارد کنید.' } },
      { status: 400 },
    );
  }

  const session = verifyAdminCredentials(parsed.data.username, parsed.data.password, config);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'نام کاربری یا گذرواژه درست نیست.' } },
      { status: 401 },
    );
  }

  const token = signAdminSession(session, config.secret);
  const response = NextResponse.json({ ok: true, data: session });
  response.headers.append('Set-Cookie', adminSessionCookie(token));
  return response;
}
