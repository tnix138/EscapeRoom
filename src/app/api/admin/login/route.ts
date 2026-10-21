// POST /api/admin/login — ورود ادمین با username/password از env (فاز ۰۹)
// پاسخ موفق: نشست در کوکی httpOnly + بدنهٔ { ok: true, data: { session } }
import { z } from 'zod';
import { checkAndRecord } from '@/server/auth/rate-limit';
import {
  adminSessionCookie,
  authenticateAdmin,
  clientIp,
  readAdminConfig,
  signAdminSession,
} from '@/server/admin/session';
import { ADMIN_LOGIN_RATE_MAX, ADMIN_LOGIN_RATE_WINDOW_MS, adminLoginRateKey } from '../_lib/limits';
import { jsonError, jsonOk } from '../_lib/responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const config = readAdminConfig();
  if (!config) {
    return jsonError(
      'ADMIN_NOT_CONFIGURED',
      'پنل ادمین تنظیم نشده است؛ ADMIN_USERNAME، ADMIN_PASSWORD_HASH و ADMIN_SESSION_SECRET را تنظیم کنید.',
      503,
    );
  }

  const allowed = checkAndRecord(
    adminLoginRateKey(clientIp(req)),
    ADMIN_LOGIN_RATE_MAX,
    ADMIN_LOGIN_RATE_WINDOW_MS,
  );
  if (!allowed) {
    return jsonError('RATE_LIMITED', 'تلاش‌های ورود زیاد بود؛ یک دقیقه صبر کنید.', 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('VALIDATION_ERROR', 'بدنهٔ درخواست JSON معتبر نیست.', 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'نام کاربری و رمز عبور هر دو لازم‌اند.', 400);
  }

  const session = authenticateAdmin(parsed.data.username, parsed.data.password, config);
  if (!session) {
    // مطابق معیار فاز ۰۹: غیر ادمین ۴۰۳ می‌گیرد.
    return jsonError('FORBIDDEN', 'نام کاربری یا رمز عبور درست نیست.', 403);
  }

  const token = signAdminSession(session, config.sessionSecret);
  return jsonOk(
    { session },
    {
      headers: {
        'set-cookie': adminSessionCookie(token, session.expiresAt - session.createdAt),
        'cache-control': 'no-store',
      },
    },
  );
}
