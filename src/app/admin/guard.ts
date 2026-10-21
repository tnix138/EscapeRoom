// src/app/admin/guard.ts — نگهبان صفحات پنل ادمین (فاز ۰۹)
// اگر نشست معتبر نباشد، کاربر به صفحهٔ ورود هدایت می‌شود؛ تصمیم نهایی همیشه
// در API گرفته می‌شود، پس این نگهبان فقط تجربهٔ کاربری را بهتر می‌کند.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_SESSION_COOKIE, readAdminConfig, verifyAdminSessionToken } from '@/server/admin/session';

export const ADMIN_LOGIN_PATH = '/admin/login';

export async function requireAdminPage() {
  const config = readAdminConfig();
  if (!config) redirect(ADMIN_LOGIN_PATH);

  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) redirect(ADMIN_LOGIN_PATH);

  const session = verifyAdminSessionToken(token, config.sessionSecret);
  if (!session) redirect(ADMIN_LOGIN_PATH);
  return session;
}
