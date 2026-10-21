/**
 * index.ts — خروجی‌های HUD ترس (فاز ۰۷ — امیرعلی)
 *
 * سه قطعهٔ مستقل، همه بدون import از `src/engine3d/**`:
 *  - `HorrorSignalHud` — نشانگر سه‌سطحی calm/tense/panic (تصمیم #91).
 *  - `HorrorHud` — HUD موجود فاز ۰۷-الف (نبض، معیار ترس).
 *  - `JumpScareOverlay` — پوشش پرش ترس، با احترام به reduced-motion.
 *
 * نمونهٔ اتصال:
 * ```tsx
 * <HorrorSignalHud level={horrorLevel} showBadge={false} />
 * ```
 */
export { default as HorrorSignalHud } from './HorrorSignalHud';
export type { HorrorSignalHudProps } from './HorrorSignalHud';
export * from './horror-signal';
export { default as HorrorHud } from './HorrorHud';
export * from './horror-hud';
export { default as JumpScareOverlay } from './JumpScareOverlay';
