/**
 * قواعد نمایش معما — موج ۶
 *
 * بدون DOM و بدون دسترسی به سرور؛ فقط ورودی‌های view عمومی را به وضعیت قابل‌نمایش
 * تبدیل می‌کند. هیچ‌جای این ماژول پاسخ درست را حدس نمی‌زند یا بازسازی نمی‌کند.
 */

import type { PlayActNumber, RowRomanCode, TheaterEmblemId } from './contracts';

export interface PunchSelection {
  emblem: TheaterEmblemId;
  actNumber: PlayActNumber;
  rowCode: RowRomanCode;
}

export const ACT_NUMBERS: PlayActNumber[] = [1, 2, 3, 4];
export const ROW_CODES: RowRomanCode[] = ['I', 'II', 'III', 'IV'];

export const ROW_LABELS: Record<RowRomanCode, string> = {
  I: 'ردیف اول',
  II: 'ردیف دوم',
  III: 'ردیف سوم',
  IV: 'ردیف چهارم',
};

export const ACT_LABELS: Record<PlayActNumber, string> = {
  1: 'پردهٔ اول',
  2: 'پردهٔ دوم',
  3: 'پردهٔ سوم',
  4: 'پردهٔ چهارم',
};

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** ارقام لاتین را فارسی می‌کند؛ مستقل از ICU. */
export function toPersianNumber(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

/** ارقام فارسی/عربی را لاتین می‌کند. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));
}

/**
 * ورودی قفل را به ارقام لاتین محدود می‌کند.
 * چسباندن کد با فاصله/خط تیره و ارقام فارسی هم پشتیبانی می‌شود.
 */
export function sanitizeDoorCode(value: string, required: number): string {
  const limit = Math.max(0, Math.trunc(required));
  return toLatinDigits(value).replace(/\D/g, '').slice(0, limit);
}

export interface DoorCodeProgress {
  /** ارقام لاتین، حداکثر به طول لازم. */
  code: string;
  filled: number;
  required: number;
  complete: boolean;
  /** برای رندر جای‌خالی هر رقم؛ true یعنی این خانه پر است. */
  slots: boolean[];
}

export function doorCodeProgress(code: string, required: number): DoorCodeProgress {
  const limit = Math.max(0, Math.trunc(required));
  const clean = sanitizeDoorCode(code, limit);
  return {
    code: clean,
    filled: clean.length,
    required: limit,
    complete: limit > 0 && clean.length === limit,
    slots: Array.from({ length: limit }, (_, index) => index < clean.length),
  };
}

/** متن وضعیت ورود ارقام برای صفحه‌خوان و زیر ورودی. */
export function describeDigitProgress(progress: DoorCodeProgress): string {
  if (progress.required === 0) return 'این قفل رمزی ندارد.';
  if (progress.complete) return 'همهٔ ارقام وارد شد؛ قفل آمادهٔ چرخیدن است.';
  return `${toPersianNumber(progress.filled)} از ${toPersianNumber(progress.required)} رقم وارد شده است.`;
}

export interface TeamTicketSummary {
  punched: number;
  total: number;
  remaining: number;
  allReady: boolean;
}

export function teamTicketSummary(
  players: ReadonlyArray<{ ticketPunched: boolean }>,
  fallbackTotal = 0,
): TeamTicketSummary {
  const total = players.length > 0 ? players.length : Math.max(0, Math.trunc(fallbackTotal));
  const punched = players.reduce((count, player) => count + (player.ticketPunched ? 1 : 0), 0);
  return {
    punched,
    total,
    remaining: Math.max(0, total - punched),
    allReady: total > 0 && punched >= total,
  };
}

/** وضعیت گروه برای صفحه‌خوان؛ رنگ تنها حامل معنا نیست. */
export function describeTeamReadiness(summary: TeamTicketSummary): string {
  if (summary.total === 0) return 'تعداد هم‌تیمی‌ها مشخص نیست.';
  if (summary.allReady) return `همهٔ ${toPersianNumber(summary.total)} بلیط پانچ شده‌اند؛ نوبت چرخاندن قفل است.`;
  return `هنوز ${toPersianNumber(summary.remaining)} بلیط پانچ نشده است.`;
}

/** آیا هر سه نشانه انتخاب شده‌اند؟ */
export function isPunchSelectionComplete(selection: Partial<PunchSelection>): boolean {
  return Boolean(
    selection.emblem
    && typeof selection.actNumber === 'number'
    && ACT_NUMBERS.includes(selection.actNumber as PlayActNumber)
    && selection.rowCode
    && ROW_CODES.includes(selection.rowCode as RowRomanCode),
  );
}

/** خلاصهٔ انتخاب فعلی برای نمایش کنار دکمهٔ پانچ. */
export function describePunchSelection(
  selection: PunchSelection,
  emblemLabel: string,
): string {
  return `${emblemLabel} · ${ACT_LABELS[selection.actNumber]} · ${ROW_LABELS[selection.rowCode]} (${selection.rowCode})`;
}

/** رقم فقط وقتی معتبر است که عدد صحیح ۰ تا ۹ باشد. */
export function isDigit(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 9;
}

/**
 * رقم طلاییِ «خودِ بازیکن» را فقط از view سرور برمی‌دارد.
 * اگر سرور هنوز چیزی نشان نداده باشد، null برمی‌گردد — حدس زدن ممنوع است.
 */
export function resolveOwnRevealedDigit(
  revealedDoorDigit: unknown,
  goldenDigit: unknown,
): number | null {
  if (isDigit(revealedDoorDigit)) return revealedDoorDigit;
  if (isDigit(goldenDigit)) return goldenDigit;
  return null;
}

/** پیام انتظار برای وقتی که سرور هنوز رقم را همگام نکرده است. */
export const DIGIT_PENDING_MESSAGE = 'در انتظار همگام‌سازی سرور… رقم شما پس از به‌روزرسانی اتاق نمایش داده می‌شود.';

/** برچسب دسترس‌پذیر برای کلیدهای صفحه‌کلید قفل. */
/**
 * برچسب دکمهٔ کشویی صفحه‌کلید قفل.
 * صفحه‌کلید پیش‌فرض باز است؛ بازیکن می‌تواند جمعش کند تا مودال قفل شلوغ نباشد
 * (فقط ورودی متنی و اسلات‌ها بمانند) و هر وقت خواست دوباره بازش کند.
 */
export function keypadToggleLabel(open: boolean): string {
  return open ? 'بستن صفحه‌کلید' : 'نمایش صفحه‌کلید';
}

/** متن وضعیت صفحه‌خوان برای دکمهٔ کشویی؛ تغییر وضعیت را یک‌بار اعلام می‌کند. */
export function keypadToggleHint(open: boolean): string {
  return open
    ? 'صفحه‌کلید باز است؛ با این دکمه بسته می‌شود.'
    : 'صفحه‌کلید بسته است؛ می‌توانید مستقیم کد را تایپ کنید یا با این دکمه بازش کنید.';
}

/** شناسهٔ بدنهٔ پاسخ معما برای aria-controls. */
export const PUZZLE_PANEL_ID = 'ticket-puzzle-body';

/** متن دکمهٔ کشوییِ «پاسخ معما» در بلیط. */
export function puzzleToggleLabel(open: boolean): string {
  return open ? 'بستن پاسخ معما' : 'باز کردن پاسخ معما';
}

/** راهنمای صفحه‌خوان/ابزارِ همان دکمه. */
export function puzzleToggleHint(open: boolean): string {
  return open
    ? 'پاسخ معما باز است؛ با این دکمه جمع می‌شود و بلیط جمع‌وجور می‌ماند.'
    : 'پاسخ معما بسته است؛ با این دکمه انتخاب نماد، پرده و ردیف باز می‌شود.';
}

/** نشانهٔ تصویری دکمه: باز = بستن، بسته = باز کردن. */
export function puzzleToggleIcon(open: boolean): string {
  return open ? '✕' : '✦';
}

export function keypadKeyLabel(key: string): string {
  if (key === 'clear') return 'پاک کردن همهٔ ارقام';
  if (key === 'delete') return 'حذف رقم آخر';
  if (key === 'submit') return 'چرخاندن قفل';
  return `رقم ${toPersianNumber(key)}`;
}

export const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'delete'] as const;
