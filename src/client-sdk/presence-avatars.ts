// src/client-sdk/presence-avatars.ts
// پل میان قاب حضور (HUD فاز ۱۲) و آواتارهای سه‌بعدی هم‌تیمی‌ها (فاز ۰۴ / قرارداد #104).
//
// چرا این فایل وجود دارد؟ `usePresenceFeed` فهرست هم‌تیمی‌ها را با شکل HUD
// (`position`, `yawDeg`, `name`) می‌دهد، در حالی که `RemotePlayerManager` شکل
// موتور (`transform`, `updatedAt`, `playerName`) می‌خواهد. بدون این تبدیل،
// آواتارها هیچ‌وقت در صحنه ساخته نمی‌شوند و بازیکن‌ها یکدیگر را نمی‌بینند.
import type { PlayerTransform } from '../engine3d/types';
import type { PresenceSnapshot } from '../engine3d/presence/types';

/** حداقل شکل موردنیاز از یک هم‌تیمی در قاب حضور (ساختار HUD فاز ۱۲). */
export interface PresenceAvatarInput {
  playerId: string;
  name?: string | null;
  seatIndex?: number | null;
  position?: { x: number; y: number; z: number } | null;
  yawDeg?: number | null;
  phase?: string | null;
  updatedAt?: number | null;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * تبدیل یک هم‌تیمی HUD به snapshot موتور.
 * موقعیت نامعتبر (NaN/بی‌نهایت/غایب) → `null` تا آواتار در مبدأ صحنه گیر نکند.
 */
export function toPresenceSnapshot(
  player: PresenceAvatarInput,
  now: number,
): PresenceSnapshot | null {
  if (!player || typeof player.playerId !== 'string' || player.playerId.length === 0) return null;
  const position = player.position;
  if (!position) return null;
  if (!isFiniteNumber(position.x) || !isFiniteNumber(position.y) || !isFiniteNumber(position.z)) {
    return null;
  }

  const yawDeg = isFiniteNumber(player.yawDeg) ? player.yawDeg : 0;
  const transform: PlayerTransform = {
    x: position.x,
    y: position.y,
    z: position.z,
    yawDeg,
    pitchDeg: 0,
  };

  return {
    playerId: player.playerId,
    transform,
    updatedAt: isFiniteNumber(player.updatedAt) && player.updatedAt > 0 ? player.updatedAt : now,
    playerName: player.name ?? null,
    seatIndex: isFiniteNumber(player.seatIndex) ? player.seatIndex : undefined,
    phase: player.phase ?? undefined,
  };
}

/**
 * تبدیل کل قاب حضور به snapshotهای موتور، حذف بازیکن محلی و حذف ورودی‌های ناقص.
 * خروجی همیشه یکتا بر اساس `playerId` است (آخرین نسخه برنده است).
 */
export function toPresenceSnapshots(
  players: readonly PresenceAvatarInput[],
  localPlayerId: string | null | undefined,
  now = Date.now(),
): PresenceSnapshot[] {
  const byId = new Map<string, PresenceSnapshot>();
  for (const player of players ?? []) {
    if (!player || player.playerId === localPlayerId) continue;
    const snapshot = toPresenceSnapshot(player, now);
    if (snapshot) byId.set(snapshot.playerId, snapshot);
  }
  return [...byId.values()];
}
