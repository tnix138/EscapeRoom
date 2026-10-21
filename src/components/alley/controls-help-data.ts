/** دادهٔ خالص راهنمای کنترل‌ها — جدا از کامپوننت تا در تست‌های node قابل استفاده باشد. */

export interface ControlHelpRow {
  readonly keys: readonly string[];
  readonly label: string;
}

export const CONTROL_HELP_ROWS: readonly ControlHelpRow[] = [
  { keys: ['W', 'A', 'S', 'D', '↑', '↓'], label: 'حرکت و گام به پهلو؛ ↑ و ↓ هم جلو و عقب می‌برند' },
  { keys: ['ماوس', '← →'], label: 'چرخاندن دید — کشیدن ماوس؛ در نمای کلاسیک ← → هم می‌چرخاند' },
  { keys: ['Shift'], label: 'دویدن آرام برای رسیدن به در' },
  { keys: ['E'], label: 'تعامل با پوستر، جدول ردیف‌ها و قفل در' },
  { keys: ['Esc'], label: 'آزاد کردن نشانگر ماوس و بستن پنجره‌ها' },
  { keys: ['H'], label: 'باز و بسته کردن همین راهنما' },
];

/** ردیف مخصوص صفحه‌های لمسی؛ فقط وقتی اشاره‌گر درشت است نمایش داده می‌شود. */
export const TOUCH_HELP_ROW: ControlHelpRow = {
  keys: ['لمس'],
  label: 'کشیدن انگشت روی صحنه دید را می‌چرخاند؛ برای راه‌رفتن در نمای سه‌بعدی صفحه‌کلید لازم است',
};

export function getControlHelpRows(coarsePointer: boolean): readonly ControlHelpRow[] {
  return coarsePointer ? [TOUCH_HELP_ROW, ...CONTROL_HELP_ROWS] : CONTROL_HELP_ROWS;
}

export function isControlHelpRoute(pathname: string | null | undefined) {
  if (!pathname) return false;
  return pathname.startsWith('/room/') || pathname === '/preview/alley';
}

/** وقتی کاربر در حال تایپ است یا نشانگر ماوس را قفل کرده، بازکردن خودکار مزاحم است. */
export function isUserBusy(element: Element | null, pointerLocked: boolean): boolean {
  if (pointerLocked) return true;
  if (!element) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
}
