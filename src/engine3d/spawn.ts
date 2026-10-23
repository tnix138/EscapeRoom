'use client';

/**
 * spawn.ts — مدیریت نقاط اسپاون و بازگشت بازیکن (علیرضا — موج ۵)
 * - اسپاون اولیه بر اساس seatIndex (کمی متفاوت برای حس حضور چندنفره)
 * - ذخیره موقعیت در localStorage برای reconnect
 * - بازگشت امن پس از Refresh
 */

import type { PlayerSpawn, PlayerTransform, WorldBounds } from './types';
import { DEFAULT_ALLEY_SPAWN, DEFAULT_ALLEY_BOUNDS } from './types';
import { ALLEY_STATIC_OBSTACLES, sanitizePosition, type AABB } from './collision';
import { resolveHumanLook } from './characters/human-presets';
import { getHumanEyeHeight } from './characters/human-head-shape';

const STORAGE_KEY = (roomCode: string, playerId: string) => `orfeo:spawn:${roomCode}:${playerId}`;

/** ارتفاع دقیق چشم کاراکتر یک بازیکن از کف پا بر اساس هویت و صندلی او (متر) */
export function resolvePlayerEyeHeight(
  playerId: string,
  seatIndex: number,
  playerName?: string,
): number {
  const look = resolveHumanLook(
    playerId,
    seatIndex,
    playerName ? { name: playerName } : undefined,
  );
  return getHumanEyeHeight(look);
}

export function getSpawnForSeat(
  seatIndex: number,
  eyeHeight = DEFAULT_ALLEY_SPAWN.position.y,
): PlayerSpawn {
  // پخش بازیکنان در عرض کوچه برای جلوگیری از هم‌پوشانی
  const spread = (seatIndex % 3) - 1; // -1, 0, 1
  return {
    position: {
      x: DEFAULT_ALLEY_SPAWN.position.x + spread * 0.8,
      y: eyeHeight,
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

export function loadTransform(
  roomCode: string,
  playerId: string,
  bounds: WorldBounds = DEFAULT_ALLEY_BOUNDS,
  obstacles: readonly AABB[] = ALLEY_STATIC_OBSTACLES,
): PlayerTransform | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(roomCode, playerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerTransform;
    if (
      typeof parsed.x !== 'number' ||
      typeof parsed.y !== 'number' ||
      typeof parsed.z !== 'number' ||
      typeof parsed.yawDeg !== 'number' ||
      !Number.isFinite(parsed.x) ||
      !Number.isFinite(parsed.y) ||
      !Number.isFinite(parsed.z) ||
      !Number.isFinite(parsed.yawDeg)
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
    // اگر مختصات ذخیره‌شده قبلی روی لبه یا داخل مانعی گیر کرده بود، به نقطهٔ آزاد بیرون رانده شود
    const safe = sanitizePosition(parsed.x, parsed.z, bounds, 0.35, obstacles);
    return {
      ...parsed,
      x: safe.x,
      z: safe.z,
      pitchDeg: typeof parsed.pitchDeg === 'number' && Number.isFinite(parsed.pitchDeg) ? parsed.pitchDeg : 0,
    };
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

export interface ResolveInitialTransformOptions {
  playerName?: string;
  groundHeightAt?: (x: number, z: number) => number;
}

/**
 * محاسبه transform نهایی با در نظر گرفتن ذخیره قبلی و کالیبراسیون دقیق ارتفاع چشم کاراکتر
 */
export function resolveInitialTransform(
  roomCode: string,
  playerId: string,
  seatIndex: number,
  options: ResolveInitialTransformOptions = {},
): PlayerTransform {
  const eyeHeight = resolvePlayerEyeHeight(playerId, seatIndex, options.playerName);
  const saved = loadTransform(roomCode, playerId);
  if (saved) {
    const groundY = options.groundHeightAt ? options.groundHeightAt(saved.x, saved.z) : 0;
    return {
      ...saved,
      y: groundY + eyeHeight,
    };
  }
  const spawn = getSpawnForSeat(seatIndex, eyeHeight);
  const groundY = options.groundHeightAt
    ? options.groundHeightAt(spawn.position.x, spawn.position.z)
    : 0;
  return {
    x: spawn.position.x,
    y: groundY + spawn.position.y,
    z: spawn.position.z,
    yawDeg: spawn.yawDeg,
    pitchDeg: 0,
  };
}
