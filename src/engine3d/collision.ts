'use client';

/**
 * collision.ts — برخورد و مرزهای فیزیکی کوچهٔ تماشاخانه (علیرضا)
 * پیاده‌سازی خالص بدون Three.js برای تست واحد سریع در Node:
 * - دیوارهای ساختمان‌های چپ و راست کوچه
 * - نمای تماشاخانه، ویترین تابلوی اعلانات و اتاقک گیشهٔ برنجی
 * - دسته‌های جعبه‌های چوبی، پالت‌ها و بشکه‌ها
 * - پایهٔ تیرهای چراغ برق کنار جدول
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

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const ALLEY_STATIC_OBSTACLES: AABB[] = [
  // دیوار نمای ساختمان‌های چپ و راست کوچه
  { minX: -9.5, maxX: -8.65, minZ: -18, maxZ: 9 },
  { minX: 8.65, maxX: 9.5, minZ: -18, maxZ: 9 },
  // نمای تماشاخانه و ستون‌های سنگی انتهای شمالی
  { minX: -9.2, maxX: 9.2, minZ: -18, maxZ: -13.2 },
  // ویترین چوبی-برنجی تابلوی اعلانات روی دیوار چپ (امکان نزدیک شدن مستقیم برای خواندن متن)
  { minX: -9.0, maxX: -7.9, minZ: -3.6, maxZ: -0.4 },
  // پیشخوان و اتاقک گیشهٔ برنجی سمت راست (امکان نزدیک شدن مستقیم برای خواندن جدول)
  { minX: 7.05, maxX: 9.0, minZ: -3.15, maxZ: 0.15 },
  // دسته جعبه‌های چوبی A (پیاده‌روی چپ — جنوب)
  { minX: -8.55, maxX: -6.45, minZ: 2.35, maxZ: 4.45 },
  // دسته جعبه‌ها و بشکه B (پیاده‌روی راست — میانه)
  { minX: 6.45, maxX: 8.55, minZ: -7.75, maxZ: -5.2 },
  // دسته جعبه‌ها و بشکه C (پیاده‌روی چپ — شمال)
  { minX: -8.55, maxX: -6.35, minZ: -11.0, maxZ: -8.6 },
  // دسته جعبه‌های چوبی D (پیاده‌روی راست — نزدیک دروازهٔ پشتی)
  { minX: 6.5, maxX: 8.55, minZ: 4.65, maxZ: 6.5 },
  // پایهٔ ۳ تیر چراغ برق کنار جدول
  { minX: 5.62, maxX: 6.28, minZ: 3.28, maxZ: 3.92 },
  { minX: -6.28, maxX: -5.62, minZ: -4.12, maxZ: -3.48 },
  { minX: 5.62, maxX: 6.28, minZ: -10.52, maxZ: -9.88 },
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
    // اسلاید نرم کنار دیوار و جعبه‌ها
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
