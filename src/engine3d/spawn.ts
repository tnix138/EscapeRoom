'use client';

/**
 * spawn.ts — مدیریت نقاط اسپاون و بازگشت بازیکن (علیرضا — موج ۵)
 * - اسپاون اولیه بر اساس seatIndex (کمی متفاوت برای حس حضور چندنفره)
 * - ذخیره موقعیت در localStorage برای reconnect
 * - بازگشت امن پس از Refresh
 */

import type { PlayerSpawn, PlayerTransform, WorldBounds } from './types';
import { DEFAULT_ALLEY_SPAWN, DEFAULT_ALLEY_BOUNDS } from './types';

const STORAGE_KEY = (roomCode: string, playerId: string) => `orfeo:spawn:${roomCode}:${playerId}`;

export function getSpawnForSeat(seatIndex: number): PlayerSpawn {
  // پخش بازیکنان در عرض کوچه برای جلوگیری از هم‌پوشانی
  const spread = (seatIndex % 3) - 1; // -1, 0, 1
  return {
    position: {
      x: DEFAULT_ALLEY_SPAWN.position.x + spread * 0.8,
      y: DEFAULT_ALLEY_SPAWN.position.y,
      z: DEFAULT_ALLEY_SPAWN.position.z + seatIndex * 0.15,
    },
    yawDeg: DEFAULT_ALLEY_SPAWN.yawDeg + spread * 8,
  };
}

export function saveTransform(roomCode: string, playerId: string, transform: PlayerTransform): void {
  try {
    localStorage.setItem(STORAGE_KEY(roomCode, playerId), JSON.stringify(transform));
  } catch {
    /* ignore storage errors */
  }
}

export function loadTransform(roomCode: string, playerId: string, bounds: WorldBounds = DEFAULT_ALLEY_BOUNDS): PlayerTransform | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(roomCode, playerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerTransform;
    if (
      typeof parsed.x !== 'number' ||
      typeof parsed.y !== 'number' ||
      typeof parsed.z !== 'number' ||
      typeof parsed.yawDeg !== 'number'
    )
      return null;
    // اعتبارسنجی مرز
    if (
      parsed.x < bounds.minX ||
      parsed.x > bounds.maxX ||
      parsed.z < bounds.minZ ||
      parsed.z > bounds.maxZ
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearTransform(roomCode: string, playerId: string): void {
  try {
    localStorage.removeItem(STORAGE_KEY(roomCode, playerId));
  } catch {
    /* ignore */
  }
}

/**
 * محاسبه transform نهایی با در نظر گرفتن ذخیره قبلی
 */
export function resolveInitialTransform(
  roomCode: string,
  playerId: string,
  seatIndex: number,
): PlayerTransform {
  const saved = loadTransform(roomCode, playerId);
  if (saved) return saved;
  const spawn = getSpawnForSeat(seatIndex);
  return {
    x: spawn.position.x,
    y: spawn.position.y,
    z: spawn.position.z,
    yawDeg: spawn.yawDeg,
    pitchDeg: 0,
  };
}
