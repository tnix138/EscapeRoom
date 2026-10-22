/**
 * حالت شروع پیش‌نمایش کوچه.
 *
 * پیش‌فرض «سه‌بعدی واقعی» است تا صحنهٔ اصلی نمایش داده شود؛ ولی برای دیدن
 * تغییرهای نمای کلاسیک (مثل چیدمان همسفران) کافی است آدرس با
 * `?mode=css` باز شود. هر مقدار ناشناخته هم به همان پیش‌فرض برمی‌گردد تا
 * آدرس‌های دستی هرگز صفحهٔ خالی نسازند.
 */

export type AlleyPreviewMode = 'css' | 'three';

export function previewModeFromParam(value: string | string[] | undefined): AlleyPreviewMode {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'css' ? 'css' : 'three';
}
