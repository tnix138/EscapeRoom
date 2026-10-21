/**
 * index.ts — خروجی‌های HUD حضور (فاز ۱۲ — امیرعلی)
 *
 * نمونهٔ اتصال در نمای سه‌بعدی (بدون تغییر فایل‌های موتور):
 *
 * ```tsx
 * const { remotePlayers } = usePresence({ roomCode, seatToken, playerId, transform });
 * <PresenceHud
 *   local={transform ? { position: transform, yawDeg: transform.yawDeg, pitchDeg: transform.pitchDeg } : null}
 *   players={remotePlayers}
 *   localPlayerId={playerId}
 *   now={serverNow}
 * />
 * ```
 */
export { default as PresenceHud } from './PresenceHud';
export type { PresenceHudProps } from './PresenceHud';
export * from './presence-hud';
