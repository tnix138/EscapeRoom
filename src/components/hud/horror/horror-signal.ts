/**
 * horror-signal.ts — مدل سیگنال ترس سه‌سطحی (فاز ۰۷-ب — امیرعلی)
 * ---------------------------------------------------------------------------
 * قرارداد Issue #91: HUD ترس فقط یک prop ساده می‌گیرد و به موتور سه‌بعدی
 * وابسته نیست:
 *
 *   type HorrorIntensity = 'calm' | 'tense' | 'panic'
 *
 * تا وقتی فایل قرارداد مشترک `src/contracts/horror.ts` ساخته نشده، این نوع
 * اینجا تعریف شده و همان شکل را دارد؛ وقتی قرارداد آمد، فقط import عوض می‌شود.
 *
 * قواعد:
 *  - **fail-safe**: هر مقدار ناشناخته/خالی/عدد/شیء → `calm` (هیچ‌وقت HUD
 *    بازیکن را در حالت وحشت گیر نمی‌اندازد).
 *  - هر سطح، برچسب فارسی، اعلان صفحه‌خوان و شدت افکت خودش را دارد؛ رنگ تنها
 *    حامل معنا نیست.
 *  - در `prefers-reduced-motion` لرزش و تپش صفر می‌شوند، ولی متن و لبهٔ قرمز
 *    می‌مانند (اطلاع‌رسانی بدون حرکت).
 */

export type HorrorIntensity = 'calm' | 'tense' | 'panic';

export const HORROR_LEVELS: readonly HorrorIntensity[] = ['calm', 'tense', 'panic'] as const;

export interface HorrorLevelStyle {
  /** برچسب کوتاه فارسی روی نشانگر. */
  label: string;
  /** جملهٔ کامل برای صفحه‌خوان. */
  announcement: string;
  /** ۰ تا ۱ — شدت تپش قرمز. */
  pulse: number;
  /** شدت مه تیرهٔ گوشه‌ها. */
  vignette: number;
  /** شدت دانهٔ فیلم. */
  grain: number;
  /** لرزش لبه‌ها (پیکسل). */
  shakePx: number;
  /** دورهٔ تپش قلب (میلی‌ثانیه). */
  heartbeatMs: number;
}

export const HORROR_LEVEL_STYLE: Readonly<Record<HorrorIntensity, HorrorLevelStyle>> = {
  calm: {
    label: 'آرام',
    announcement: 'سالن آرام است؛ صدای محیط پشت پرده شنیده می‌شود.',
    pulse: 0.08,
    vignette: 0.16,
    grain: 0.05,
    shakePx: 0,
    heartbeatMs: 1_400,
  },
  tense: {
    label: 'دلواپس',
    announcement: 'دلواپسی بالا گرفته؛ سایه‌ها نزدیک‌تر شده‌اند.',
    pulse: 0.34,
    vignette: 0.42,
    grain: 0.14,
    shakePx: 1.5,
    heartbeatMs: 950,
  },
  panic: {
    label: 'وحشت',
    announcement: 'وحشت — ضربان قلب تند شده و لبه‌های دید می‌لرزد.',
    pulse: 0.68,
    vignette: 0.72,
    grain: 0.26,
    shakePx: 3,
    heartbeatMs: 620,
  },
};

/** هر مقدار ناشناخته‌ای به «آرام» برمی‌گردد (fail-safe). */
export function normalizeHorrorLevel(value: unknown): HorrorIntensity {
  if (typeof value !== 'string') return 'calm';
  const normalized = value.trim().toLowerCase();
  return (HORROR_LEVELS as readonly string[]).includes(normalized)
    ? (normalized as HorrorIntensity)
    : 'calm';
}

/** شدت عددی ۰ تا ۱ برای آنیمیشن‌ها و پالس. */
export function horrorLevelIntensity(level: unknown): number {
  const style = HORROR_LEVEL_STYLE[normalizeHorrorLevel(level)];
  return Math.min(1, Math.max(0, style.pulse));
}

/** فاصلهٔ ضربان قلب بر اساس سطح (برای هماهنگی صدا — بدون import از audio). */
export function horrorHeartbeatMs(level: unknown): number {
  return HORROR_LEVEL_STYLE[normalizeHorrorLevel(level)].heartbeatMs;
}

/** اعلان صفحه‌خوان برای سطح جاری. */
export function describeHorrorLevel(level: unknown): string {
  return HORROR_LEVEL_STYLE[normalizeHorrorLevel(level)].announcement;
}

/**
 * اعلان فقط هنگام تغییر سطح؛ سطح یکسان اعلان تکراری نمی‌سازد.
 * سطح ناشناخته مثل `calm` رفتار می‌کند.
 */
export function horrorLevelChangeMessage(previous: unknown, next: unknown): string {
  const before = normalizeHorrorLevel(previous);
  const after = normalizeHorrorLevel(next);
  if (before === after) return '';
  return describeHorrorLevel(after);
}

/** پل از مدل زمان‌محور HUD (`fearAt`) به سیگنال سه‌سطحی قرارداد. */
export function horrorLevelFromFear(fear: number): HorrorIntensity {
  if (!Number.isFinite(fear)) return 'calm';
  if (fear >= 0.64) return 'panic';
  if (fear >= 0.32) return 'tense';
  return 'calm';
}

/** آیا این سطح باید حرکتی داشته باشد؟ (برای احترام به کاهش حرکت) */
export function isMotionLevel(level: unknown): boolean {
  return normalizeHorrorLevel(level) !== 'calm';
}

/**
 * متغیرهای CSS لایهٔ ترس برای یک سطح؛ کامپوننت و تست هر دو از همین‌جا
 * می‌خوانند تا «کلاس/استایل درست برای هر سه سطح» یک منبع حقیقت داشته باشد.
 * خروجی همیشه سه سطح را پوشش می‌دهد و مقدار ناشناخته → calm.
 */
export function horrorSignalCssVars(level: unknown): Record<string, string> {
  const style = HORROR_LEVEL_STYLE[normalizeHorrorLevel(level)];
  return {
    '--horror-signal-pulse': style.pulse.toFixed(3),
    '--horror-signal-vignette': style.vignette.toFixed(3),
    '--horror-signal-grain': style.grain.toFixed(3),
    '--horror-signal-shake': `${style.shakePx}px`,
    '--horror-signal-heartbeat': `${style.heartbeatMs}ms`,
  };
}
