// src/app/api/admin/_lib/limits.ts — سقف‌های نرخ پنل ادمین (فاز ۰۹)

/** سقف تلاش ورود: ۵ بار در دقیقه برای هر IP */
export const ADMIN_LOGIN_RATE_MAX = 5;
export const ADMIN_LOGIN_RATE_WINDOW_MS = 60_000;

export function adminLoginRateKey(ip: string): string {
  return `admin-login:${ip}`;
}
