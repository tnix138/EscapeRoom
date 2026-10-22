'use client';

/**
 * panorama-look.ts — جهت چرخش دید در «نمای کلاسیک» کوچه
 * ---------------------------------------------------------------------------
 * پیش‌تر کشیدن انگشت/ماوس به راست، دید را به چپ می‌برد (قرارداد «جابه‌جا کردن
 * عکس»)، در حالی که کلیدهای ← → و اسلایدر «جهت نگاه» دقیقاً برعکس کار می‌کردند:
 * ArrowRight ⇒ نمای راست. بازیکن همان کشیدن را «برعکس» می‌دید.
 *
 * قرارداد یکسان در کل بازی: **حرکت به راست = نگاه به راست**.
 * در این صحنه yaw مثبت یعنی نمای سمت راست (`activeView === 'right'`).
 */

export const PANORAMA_YAW_LIMIT_DEG = 42;
/** درجه به‌ازای هر پیکسل کشیدن */
export const PANORAMA_DRAG_SENSITIVITY = 0.22;

export function clampPanoramaYaw(yawDeg: number): number {
  return Math.min(PANORAMA_YAW_LIMIT_DEG, Math.max(-PANORAMA_YAW_LIMIT_DEG, yawDeg));
}

/** yaw جدید بعد از کشیدن افقی؛ dx مثبت = کشیدن به راست = نمای راست. */
export function panoramaYawFromDrag(
  yawDeg: number,
  dx: number,
  sensitivity = PANORAMA_DRAG_SENSITIVITY,
): number {
  return clampPanoramaYaw(yawDeg + dx * sensitivity);
}

/** همان گام کلید ← → (برای یکدستی با کشیدن) */
export function panoramaYawFromKey(yawDeg: number, key: 'ArrowLeft' | 'ArrowRight', step = 9): number {
  return clampPanoramaYaw(yawDeg + (key === 'ArrowRight' ? step : -step));
}

/** نمای فعال برای برچسب و شاخص‌ها */
export function panoramaView(yawDeg: number): 'left' | 'center' | 'right' {
  if (yawDeg < -12) return 'left';
  if (yawDeg > 12) return 'right';
  return 'center';
}
