/**
 * panel-focus.ts — هماهنگی پنل‌های شناور صحنه
 * -----------------------------------------------------------------------
 * روی گوشی، نجوای گروهی (لبهٔ چپ)، همراهِ تماشاخانه (لبهٔ راست) و کاوش
 * (پایین-چپ) به تب‌های باریک تبدیل می‌شوند. اگر بازیکن دو تب را پشت سر هم
 * باز کند، دو کشوی عریض روی هم می‌افتند و صحنه دیده نمی‌شود. هر پنل هنگام
 * «باز شدن» یک رویداد می‌فرستد و بقیه خودشان را می‌بندند.
 *
 * این ماژول هیچ وابستگی‌ای ندارد تا مستقل تست شود.
 */

export const PANEL_OPEN_EVENT = 'orfeo:panel-open';

export type ScenePanelId = 'whisper' | 'companion' | 'exploration';

/** به بقیهٔ پنل‌ها اعلام می‌کند این پنل باز شد. */
export function announcePanelOpen(id: ScenePanelId): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PANEL_OPEN_EVENT, { detail: { id } }));
}

/**
 * با باز شدن هر پنل دیگری، `onOtherOpen` صدا زده می‌شود.
 * خروجی، تابع لغو اشتراک است.
 */
export function onOtherPanelOpen(id: ScenePanelId, onOtherOpen: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ id?: ScenePanelId }>).detail;
    if (!detail || detail.id === id) return;
    onOtherOpen();
  };
  window.addEventListener(PANEL_OPEN_EVENT, handler);
  return () => window.removeEventListener(PANEL_OPEN_EVENT, handler);
}
