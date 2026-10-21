'use client';

/**
 * collision.ts — برخورد و مرزهای ساده کوچه (علیرضا — موج ۴)
 * پیاده‌سازی خالص بدون Three.js برای تست واحد.
 */

import type { WorldBounds, PlayerTransform } from './types';

export interface CollisionResult {
  collided: boolean;
  clampedX: number;
  clampedZ: number;
  hitWall: boolean;
}

export function clampToBounds(
  x: number,
  z: number,
  bounds: WorldBounds,
): { x: number; z: number; hitWall: boolean } {
  const clampedX = Math.min(bounds.maxX, Math.max(bounds.minX, x));
  const clampedZ = Math.min(bounds.maxZ, Math.max(bounds.minZ, z));
  const hitWall = clampedX !== x || clampedZ !== z;
  return { x: clampedX, z: clampedZ, hitWall };
}

/**
 * برخورد ساده با دیوارهای کوچه + موانع ثابت (در تئاتر، گیشه).
 * در موج ۴ موانع به صورت AABB مستطیلی ساده هستند.
 */
export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const ALLEY_STATIC_OBSTACLES: AABB[] = [
  // نمای تئاتر (در بسته) — کمی جلوتر از دیوار انتها
  { minX: -3.2, maxX: 3.2, minZ: -15.5, maxZ: -13.2 },
  // تابلوی اعلانات چپ — برآمدگی کوچک
  { minX: -9, maxX: -6.2, minZ: -4, maxZ: 0 },
  // گیشه راست
  { minX: 6.2, maxX: 9, minZ: -3.5, maxZ: 0.5 },
];

export function checkAABBCollision(x: number, z: number, radius: number, obstacles: AABB[]): boolean {
  for (const box of obstacles) {
    const closestX = Math.max(box.minX, Math.min(x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
    const dx = x - closestX;
    const dz = z - closestZ;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

export function resolveMovement(
  prev: PlayerTransform,
  nextX: number,
  nextZ: number,
  bounds: WorldBounds,
  radius = 0.35,
): CollisionResult {
  const bounded = clampToBounds(nextX, nextZ, bounds);
  let finalX = bounded.x;
  let finalZ = bounded.z;
  let collided = bounded.hitWall;

  if (checkAABBCollision(finalX, finalZ, radius, ALLEY_STATIC_OBSTACLES)) {
    // سعی کن فقط روی یک محور حرکت کنی (اسلاید کنار دیوار)
    const tryX = !checkAABBCollision(finalX, prev.z, radius, ALLEY_STATIC_OBSTACLES);
    const tryZ = !checkAABBCollision(prev.x, finalZ, radius, ALLEY_STATIC_OBSTACLES);
    if (tryX) {
      finalZ = prev.z;
      collided = true;
    } else if (tryZ) {
      finalX = prev.x;
      collided = true;
    } else {
      finalX = prev.x;
      finalZ = prev.z;
      collided = true;
    }
  }

  return { collided, clampedX: finalX, clampedZ: finalZ, hitWall: collided };
}
