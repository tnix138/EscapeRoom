'use client';

/**
 * alley-ground-profile.ts — پروفایل ارتفاعی کف کوچه، مشترک بین زمین و هالهٔ نور (علیرضا)
 *
 * کف کوچه یک تاج بسیار ملایم دارد تا آب باران به جوی کنار جدول هدایت شود.
 * پیش‌تر این فرمول فقط داخل `alley-geometry.ts` بود؛ حالا هالهٔ نورِ نرمِ زیر
 * چراغ‌های برق هم که روی زمین می‌نشیند از همین منبع استفاده می‌کند تا دقیقاً
 * روی سطح سنگ‌فرش بخوابد و نه چند سانتی‌متر بالاتر یا پایین‌تر از آن.
 */

/** حداکثر برآمدگی تاج در محور مرکزی کوچه (متر) */
export const ALLEY_GROUND_CROWN_HEIGHT = 0.045;

/** نیم‌عرض بخش تاج‌دار کف (متر) — بیرون از آن کف تخت است */
export const ALLEY_GROUND_CROWN_HALF_WIDTH = 6.2;

/** ارتفاع تاج کف در مختصات جهانی x (متر) */
export function alleyGroundCrownAt(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return (
    Math.max(0, 1 - Math.pow(x / ALLEY_GROUND_CROWN_HALF_WIDTH, 2)) * ALLEY_GROUND_CROWN_HEIGHT
  );
}

/** ارتفاع سطح پیاده‌روهای چپ و راست کوچه نسبت به کف پایه (متر) */
export const ALLEY_SIDEWALK_HEIGHT = 0.13;

/**
 * ارتفاع سطح گام‌برداری بازیکن در عرض کوچه (متر):
 * در مسیر سنگ‌فرش میانی (|x| <= 5.95) صفر است و هنگام بالا رفتن از جدول و پیاده‌رو
 * (|x| >= 6.22) به شکل پیوسته به ۰٫۱۳ متر می‌رسد تا کف کفش کاراکترها داخل پیاده‌رو فرو نرود.
 */
export function alleyWalkableGroundAt(x: number): number {
  if (!Number.isFinite(x)) return 0;
  const ax = Math.abs(x);
  if (ax <= 5.95) return 0;
  if (ax >= 6.22) return ALLEY_SIDEWALK_HEIGHT;
  const t = (ax - 5.95) / (6.22 - 5.95);
  const smooth = t * t * (3 - 2 * t);
  return smooth * ALLEY_SIDEWALK_HEIGHT;
}

