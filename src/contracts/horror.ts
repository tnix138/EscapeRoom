// src/contracts/horror.ts — قرارداد مشترک اتمسفر ترس (فاز ۰۷)
// سمت سه‌بعدی/صدا (علیرضا) این سیگنال را تولید می‌کند و سمت HUD (امیرعلی) فقط
// آن را مصرف می‌کند. هیچ‌کدام به فایل دیگری وابسته نیستند.
import { z } from 'zod';

export const HORROR_INTENSITIES = ['calm', 'tense', 'panic'] as const;
export type HorrorIntensity = (typeof HORROR_INTENSITIES)[number];

/** سیگنال کوتاه ترس که بین موتور سه‌بعدی و HUD رد و بدل می‌شود. */
export interface HorrorSignal {
  level: HorrorIntensity;
  /** ساعت سرور/کلاینت هنگام تولید سیگنال (میلی‌ثانیه) */
  at: number;
}

/** سطح‌ها به ترتیب شدت؛ برای مقایسه و بیشینه‌گیری امن. */
export const HORROR_RANK: Record<HorrorIntensity, number> = {
  calm: 0,
  tense: 1,
  panic: 2,
};

/** آستانه‌های پیش‌فرض تبدیل «تهدید نرمال‌شده» به سطح. */
export const HORROR_THRESHOLDS = {
  tense: 0.4,
  panic: 0.75,
} as const;

/** بازهٔ فاصله (متر) که از آرام به وحشت می‌رسد. */
export const HORROR_DISTANCE = {
  nearM: 4,
  farM: 16,
} as const;

export function isHorrorIntensity(value: unknown): value is HorrorIntensity {
  return typeof value === 'string' && (HORROR_INTENSITIES as readonly string[]).includes(value);
}

/** سطح ناشناخته به امن‌ترین حالت برمی‌گردد تا HUD هیچ‌وقت نشکند. */
export function normalizeHorrorIntensity(value: unknown): HorrorIntensity {
  return isHorrorIntensity(value) ? value : 'calm';
}

export function clampThreat(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** تبدیل تهدید نرمال‌شده (۰ تا ۱) به سطح ترس. */
export function horrorLevelFromThreat(threat: number): HorrorIntensity {
  const normalized = clampThreat(threat);
  if (normalized >= HORROR_THRESHOLDS.panic) return 'panic';
  if (normalized >= HORROR_THRESHOLDS.tense) return 'tense';
  return 'calm';
}

/**
 * تبدیل فاصله تا خطر به سطح ترس.
 * نزدیک‌تر از `nearM` → panic، دورتر از `farM` → calm.
 */
export function horrorLevelFromDistance(
  distanceM: number,
  options: { nearM?: number; farM?: number } = {},
): HorrorIntensity {
  const nearM = options.nearM ?? HORROR_DISTANCE.nearM;
  const farM = options.farM ?? HORROR_DISTANCE.farM;
  if (!Number.isFinite(distanceM)) return 'calm';
  if (farM <= nearM) return distanceM <= nearM ? 'panic' : 'calm';
  const threat = (farM - distanceM) / (farM - nearM);
  return horrorLevelFromThreat(threat);
}

/** سطح شدیدتر را برمی‌گرداند (برای ترکیب چند منبع ترس). */
export function maxHorrorIntensity(
  a: HorrorIntensity,
  b: HorrorIntensity,
): HorrorIntensity {
  return HORROR_RANK[a] >= HORROR_RANK[b] ? a : b;
}

export function createHorrorSignal(
  level: HorrorIntensity,
  at: number = Date.now(),
): HorrorSignal {
  return { level: normalizeHorrorIntensity(level), at };
}

export const horrorSignalSchema = z.object(
  {
    level: z.enum(HORROR_INTENSITIES, {
      errorMap: () => ({ message: 'سطح ترس باید یکی از calm، tense یا panic باشد.' }),
    }),
    at: z
      .number({ invalid_type_error: 'زمان سیگنال ترس باید عدد باشد.' })
      .int('زمان سیگنال ترس باید عدد صحیح باشد.')
      .nonnegative('زمان سیگنال ترس نمی‌تواند منفی باشد.'),
  },
  { required_error: 'سیگنال ترس الزامی است.', invalid_type_error: 'سیگنال ترس معتبر نیست.' },
);

/** برای مصرف‌کننده‌هایی که ورودی نامطمئن (مثلاً از شبکه) می‌گیرند. */
export function parseHorrorSignal(input: unknown): HorrorSignal | null {
  const result = horrorSignalSchema.safeParse(input);
  return result.success ? result.data : null;
}
