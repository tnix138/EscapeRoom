/**
 * index.ts — خروجی‌های HUD حضور (فاز ۱۲ — امیرعلی)
 *
 * دو لایهٔ مستقل:
 *  1. `PresenceHud` — نمایش، فقط از داده‌های آماده تغذیه می‌شود (بدون شبکه).
 *  2. `usePresenceFeed` — اتصال به قرارداد #104 (POST `/presence` + SSE
 *     `presence_update`). در نبود سرویس فاز ۰۳ کاملاً بی‌صدا خاموش می‌ماند.
 *
 * نمونهٔ اتصال در نمای سه‌بعدی (بدون تغییر فایل‌های موتور):
 *
 * ```tsx
 * const presence = usePresenceFeed({ roomCode, playerId, transform, phase });
 * <PresenceHud
 *   local={{ position: transform, yawDeg: transform.yawDeg, pitchDeg: transform.pitchDeg }}
 *   players={presence.presences}
 *   names={names}
 *   localPlayerId={playerId}
 *   now={presence.serverNow ?? undefined}
 * />
 * ```
 */
export { default as PresenceHud } from './PresenceHud';
export type { PresenceHudProps } from './PresenceHud';
export * from './presence-hud';
export * from './presence-contract';
export { usePresenceFeed } from './use-presence-feed';
export type { PresenceFeedState, UsePresenceFeedOptions } from './use-presence-feed';
