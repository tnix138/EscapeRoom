/**
 * side-drawer.ts — منطق خالص منوی کشویی کنار صفحه (بازبینی UI — امیرعلی)
 * ---------------------------------------------------------------------------
 * منو روی لبهٔ راست صفحه نشسته است (RTL: سمت شروع) و با کلیک روی زبانه‌اش باز
 * می‌شود؛ با کلیک دوباره به سمت راست بیرون می‌رود. کل منطقِ «چه کلاسی»، «چه
 * برچسبی» و «با کدام کلید فوکوس کجا برود» اینجا و بدون React است تا در تست
 * node سنجیده شود؛ کامپوننت فقط آن را رندر می‌کند.
 */

/** پهنای پنل؛ با viewport کوچک‌تر جمع می‌شود (هم‌خوان با CSS). */
export const SIDE_DRAWER_WIDTH = 'min(340px, calc(100vw - 58px))';

/** مدت انیمیشن باز/بسته شدن (ms) — همان مقدار CSS. */
export const SIDE_DRAWER_TRANSITION_MS = 320;

/** فاصلهٔ پلکانی ورود هر آیتم (ms). */
export const SIDE_DRAWER_ITEM_STAGGER_MS = 35;

/** شناسهٔ پنل برای aria-controls. */
export const SIDE_DRAWER_PANEL_ID = 'side-drawer-panel';

export type DrawerNavKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End' | 'Escape';

/** کلاس ریشه؛ `data-open` هم می‌گذاریم تا CSS بتواند بدون حدس کار کند. */
export function drawerRootClass(open: boolean): string {
  return `side-drawer-root ${open ? 'is-open' : 'is-closed'}`;
}

/** کلاس پنل. */
export function drawerPanelClass(open: boolean): string {
  return `side-drawer ${open ? 'is-open' : 'is-closed'}`;
}

/** کلاس زبانهٔ کنار صفحه. */
export function drawerTabClass(open: boolean): string {
  return `side-drawer-tab ${open ? 'is-open' : 'is-closed'}`;
}

/** برچسب دسترس‌پذیری زبانه؛ در حالت باز «بستن» و در حالت بسته «باز کردن». */
export function drawerTabLabel(open: boolean): string {
  return open ? 'بستن منو' : 'باز کردن منو';
}

/** متن کوتاه روی خود زبانه. */
export function drawerTabText(open: boolean): string {
  return open ? 'بستن' : 'منو';
}

/** نشانهٔ زبانه: کشو بسته = ☰، کشو باز = ✕ (هم‌جهت با «برو سمت راست»). */
export function drawerTabIcon(open: boolean): string {
  return open ? '✕' : '☰';
}

/** اعلان صفحه‌خوان برای باز/بسته شدن. */
export function drawerStateMessage(open: boolean): string {
  return open ? 'منوی بازی باز شد.' : 'منوی بازی بسته شد.';
}

/** آیا این کلید باید کشو را ببندد؟ */
export function isDrawerCloseKey(key: string): boolean {
  return key === 'Escape';
}

/**
 * مقصد فوکوس با کلیدهای جهت‌دار داخل فهرست.
 * `null` یعنی «این کلید مربوط به فهرست نیست؛ بگذار رفتار پیش‌فرض بماند».
 * حرکت دورانی است تا کاربر در انتهای فهرست گیر نکند.
 */
export function nextDrawerIndex(current: number, length: number, key: string): number | null {
  if (!Number.isFinite(length) || length <= 0) return null;
  const raw = Number.isFinite(current) ? Math.trunc(current) : 0;
  const index = Math.min(Math.max(raw, 0), length - 1);
  switch (key) {
    case 'ArrowDown':
      return (index + 1) % length;
    case 'ArrowUp':
      return (index - 1 + length) % length;
    case 'Home':
      return 0;
    case 'End':
      return length - 1;
    default:
      return null;
  }
}

/** استایل پلکانی هر آیتم؛ فقط یک متغیر CSS می‌دهد. */
export function drawerItemStyle(index: number): Record<string, string> {
  const safe = Number.isFinite(index) && index > 0 ? Math.trunc(index) : 0;
  return { '--drawer-item-index': String(Math.min(safe, 20)) };
}

/** متغیرهای ریشهٔ کشو (پهنا و زمان‌بندی) تا CSS و تست یک منبع داشته باشند. */
export function drawerRootStyle(): Record<string, string> {
  return {
    '--side-drawer-w': SIDE_DRAWER_WIDTH,
    '--side-drawer-ms': `${SIDE_DRAWER_TRANSITION_MS}ms`,
    '--side-drawer-stagger': `${SIDE_DRAWER_ITEM_STAGGER_MS}ms`,
  };
}

/** متن راهنمای پایین پنل. */
export const SIDE_DRAWER_HINT = 'با کلید خروج منو بسته می‌شود؛ برای جابه‌جایی بین گزینه‌ها از ↑ و ↓ استفاده کنید.';
