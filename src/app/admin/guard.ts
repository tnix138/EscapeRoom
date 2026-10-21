// src/app/admin/guard.ts — نگهبان صفحات پنل ادمین (فاز ۰۹)
// اگر نشست معتبر نباشد، کاربر به صفحهٔ ورود هدایت می‌شود؛ تصمیم نهایی همیشه
// در API گرفته می‌شود، پس این نگهبان فقط تجربهٔ کاربری را بهتر می‌کند.
// توکن روی همان کوکی httpOnly و همان ماژول مشترک `src/server/auth/admin-session.ts`.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ADMIN_COOKIE_NAME,
  readAdminConfig,
  verifyAdminSessionToken,
} from '@/server/auth/admin-session';

export const ADMIN_LOGIN_PATH = '/admin/login';

export async function requireAdminPage() {
  const config = readAdminConfig();
  if (!config.credentials || !config.secret) redirect(ADMIN_LOGIN_PATH);

  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value ?? null;
  if (!token) redirect(ADMIN_LOGIN_PATH);

  const session = verifyAdminSessionToken(token, config.secret);
  if (!session) redirect(ADMIN_LOGIN_PATH);
  return session;
}
