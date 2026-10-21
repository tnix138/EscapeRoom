/** دادهٔ خالص راهنمای کنترل‌ها — جدا از کامپوننت تا در تست‌های node قابل استفاده باشد. */
export const CONTROL_HELP_ROWS = [
  { keys: ['W', 'A', 'S', 'D', '↑', '↓'], label: 'حرکت و گام به پهلو؛ ↑ و ↓ هم جلو و عقب می‌برند' },
  { keys: ['ماوس', '← →'], label: 'چرخاندن دید — کشیدن ماوس؛ در نمای کلاسیک ← → هم می‌چرخاند' },
  { keys: ['Shift'], label: 'دویدن آرام برای رسیدن به در' },
  { keys: ['E'], label: 'تعامل با پوستر، جدول ردیف‌ها و قفل در' },
  { keys: ['Esc'], label: 'آزاد کردن نشانگر ماوس و بستن پنجره‌ها' },
  { keys: ['H'], label: 'باز و بسته کردن همین راهنما' },
] as const;

export function isControlHelpRoute(pathname: string | null | undefined) {
  if (!pathname) return false;
  return pathname.startsWith('/room/') || pathname === '/preview/alley';
}
