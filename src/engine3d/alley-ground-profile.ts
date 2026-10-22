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
