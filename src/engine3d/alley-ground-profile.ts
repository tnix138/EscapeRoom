'use client';

import { ALLEY_BRANCH } from './alley-layout';

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
 * پروفیلِ پلهٔ پیاده‌رو بر حسبِ فاصلۀ عرضی از محور (متر):
 * داخلِ سنگ‌فرش صفر، روی جدول به‌شکلِ پیوسته و از لبهٔ پیاده‌رو به بعد ۰٫۱۳ متر.
 */
function smoothHeight(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped) * ALLEY_SIDEWALK_HEIGHT;
}

/** از فاصلۀ عرضی تا لبهٔ پیاده‌رو: داخل صفر، روی جدول پیوسته، بیرون ۰٫۱۳ */
function stepFromCenter(distance: number, roadEdge: number, curbEdge: number): number {
  if (!Number.isFinite(distance)) return 0;
  const d = Math.abs(distance);
  if (d <= roadEdge) return 0;
  if (d >= curbEdge) return ALLEY_SIDEWALK_HEIGHT;
  return smoothHeight((d - roadEdge) / (curbEdge - roadEdge));
}

/** پلهٔ یک‌طرفه (برای پایهٔ جنوبی که فقط از یک سمت بالا می‌رود) */
function stepUpAt(value: number, start: number, end: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= start) return 0;
  if (value >= end) return ALLEY_SIDEWALK_HEIGHT;
  return smoothHeight((value - start) / (end - start));
}

export function alleyWalkableGroundAt(x: number, z: number = Number.NaN): number {
  if (!Number.isFinite(x)) return 0;
  const hasZ = Number.isFinite(z);

  // ۱) باندِ فرعیِ غربی: محورِ عرض z است، نه x
  if (hasZ && z >= ALLEY_BRANCH.northZ && x < ALLEY_BRANCH.groundEastX) {
    const branchWidth = ALLEY_BRANCH.southZ - ALLEY_BRANCH.northZ; // ۹٫۸
    const halfRoad = (branchWidth - 2 * ALLEY_BRANCH.sidewalkWidth) / 2; // ۳٫۲
    return stepFromCenter(z - ALLEY_BRANCH.centerZ, halfRoad, halfRoad + 0.27);
  }

  // ۲) پیاده‌روی جنوبیِ فرعی از دهانهٔ فرعی تا دیوارِ انتهای کوچه امتداد دارد و
  //    جلوی دیوارِ جنوبی یک پایهٔ مشترک برای هر دو بازو می‌سازد؛ اگر اینجا حساب
  //    نشود، بازیکن ۱۳ سانتی‌متر داخلِ سنگ‌فرشِ پایه فرو می‌رود.
  const apronEdge = ALLEY_BRANCH.southZ - ALLEY_BRANCH.sidewalkWidth;
  if (hasZ && x <= 6.25 && z >= apronEdge - 0.27) {
    return stepUpAt(z, apronEdge - 0.27, apronEdge);
  }

  // ۳) شاخهٔ اصلی: پیاده‌روهای دو طرف در عرضِ کوچه
  return stepFromCenter(x, 5.95, 6.22);
}

