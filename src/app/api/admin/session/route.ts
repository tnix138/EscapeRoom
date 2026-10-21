// GET /api/admin/session — بررسی جلسهٔ فعلی (قرارداد ۵، فاز ۰۹)
// ۲۰۰ + session اگر کوکی معتبر است؛ ۴۰۱ اگر نیست. محافظ `AdminSessionGate`
// فقط بر اساس ۴۰۱/۴۰۳ ریدایرکت می‌کند.
import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  readAdminConfig,
  readCookieValue,
  verifyAdminSessionToken,
} from '../../../../server/auth/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { secret } = readAdminConfig();
  const token = readCookieValue(req.headers.get('cookie'), ADMIN_COOKIE_NAME);
  const session = secret ? verifyAdminSessionToken(token, secret) : null;
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'جلسهٔ مدیریت معتبر نیست.' } },
      { status: 401 },
    );
  }
  return NextResponse.json({ ok: true, data: session });
}
