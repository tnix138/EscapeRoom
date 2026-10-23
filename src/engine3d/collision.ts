'use client';

/**
 * collision.ts — برخورد و مرزهای فیزیکی کوچهٔ تماشاخانه (علیرضا / بازبینی رفع گیرکردن)
 * پیاده‌سازی خالص بدون Three.js برای تست واحد سریع در Node:
 * - دیوارهای ساختمان‌های چپ و راست کوچه (تا انتهای جنوبیِ شاخهٔ اصلی)
 * - بلوکِ غربیِ شهر (گوشهٔ بیرونِ L) تا بازیکن از مستطیلِ مرزی به فرعیِ خیالی نرود
 * - دیوارِ انتهای جنوبی و دیوارِ بن‌بستِ فرعیِ غربی
 * - نمای تماشاخانه، ویترین تابلوی اعلانات و اتاقک گیشهٔ برنجی
 * - دسته‌های جعبه‌های چوبی، پالت‌ها و بشکه‌ها (همراه با دستهٔ تازهٔ فرعی)
 * - پایهٔ تیرهای چراغ برق کنار جدول
 * - حل پیوستهٔ برخورد دایره با AABB (MTV + گام‌بندی) تا بازیکن هرگز روی گوشه‌ها یا دیوارها گیر نکند
 *
 * کوچه L‌شکل است: مرزها یک مستطیلِ محیطی‌اند و شکلِ L را همین موانع می‌سازند
 * (منبعِ اعداد: `alley-layout.ts`).
 */

import type { WorldBounds, PlayerTransform } from './types';
import {
  ALLEY_GUIDE_BOARD_SURFACE_X,
  ALLEY_GUIDE_COLLISION_DEPTH,
  ALLEY_GUIDE_WALL_X,
} from './alley-guide-layout';
import { ALLEY_BRANCH, ALLEY_MAIN, ALLEY_THEATER, ALLEY_WEST_STREET } from './alley-layout';

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
  // دیوار نمای ساختمان‌های سمت راست (شرق) — تا انتهای جنوبیِ کوچه
  { minX: ALLEY_MAIN.innerX, maxX: 9.5, minZ: -18, maxZ: 32.5 },
  // بلوکِ میانیِ شهر: بینِ شاخهٔ اصلی (شرق) و خیابانِ غربی (غرب)، شمالِ فرعی.
  // همین بلوک است که نقشه را از مستطیل به «U» تبدیل می‌کند.
  { minX: ALLEY_WEST_STREET.eastX, maxX: -ALLEY_MAIN.innerX, minZ: -18, maxZ: ALLEY_BRANCH.northZ },
  // بلوکِ شمالی: بالای انتهای شمالیِ خیابانِ غربی (بن‌بستِ درِ چوبی در z = ۰)
  { minX: -60, maxX: ALLEY_WEST_STREET.eastX, minZ: -18, maxZ: ALLEY_WEST_STREET.northZ },
  // دیوارِ غربی: از گوشهٔ شمال‌غربیِ خیابان تا انتهای جنوب‌غربیِ فرعی
  { minX: -60, maxX: ALLEY_WEST_STREET.westX, minZ: ALLEY_WEST_STREET.northZ, maxZ: 36 },
  // دیوارِ انتهای جنوبیِ هر دو بازو (دهانهٔ فرعی بسته نمی‌شود)
  { minX: -ALLEY_MAIN.innerX, maxX: 9.5, minZ: ALLEY_BRANCH.southZ, maxZ: 36 },
  // انتهای شمالیِ شاخهٔ اصلی (ردیفِ ساختمان‌هایی که جای نمای قبلیِ تئاتر را گرفته‌اند)
  { minX: -9.2, maxX: 9.2, minZ: -18, maxZ: -13.2 },
  // چهار ستونِ سنگیِ نمای تماشاخانه که از دیوارِ شمالیِ فرعی بیرون زده‌اند
  // (نما حالا در ابتدای پیچِ L است؛ بدنه‌اش داخلِ بلوکِ غربی می‌افتد)
  ...[-5.2, -2.55, 2.55, 5.2].map((offset) => {
    const x = ALLEY_THEATER.doorX + offset;
    return {
      minX: x - 0.45,
      maxX: x + 0.45,
      minZ: ALLEY_THEATER.wallZ - 0.15,
      maxZ: ALLEY_THEATER.wallZ + 0.5,
    };
  }),
  // ویترین چوبی-برنجی تابلوی اعلانات روی دیوار چپ (امکان نزدیک شدن مستقیم برای خواندن متن)
  {
    minX: ALLEY_GUIDE_WALL_X.left - ALLEY_GUIDE_COLLISION_DEPTH.behindWall,
    maxX: ALLEY_GUIDE_BOARD_SURFACE_X.playbill + ALLEY_GUIDE_COLLISION_DEPTH.beyondSurface,
    minZ: -3.6,
    maxZ: -0.4,
  },
  // پیشخوان و اتاقک گیشهٔ برنجی سمت راست — قرینهٔ دقیق تابلو چپ، چون گیشه هم
  // اکنون با همان فاصلهٔ پوستر به دیوار راست چسبیده است
  {
    minX: ALLEY_GUIDE_BOARD_SURFACE_X.rowChart - ALLEY_GUIDE_COLLISION_DEPTH.beyondSurface,
    maxX: ALLEY_GUIDE_WALL_X.right + ALLEY_GUIDE_COLLISION_DEPTH.behindWall,
    minZ: -3.15,
    maxZ: 0.15,
  },
  // دسته جعبه‌های چوبی A (پیاده‌روی چپ — جنوب)
  { minX: -8.55, maxX: -6.45, minZ: 2.35, maxZ: 4.45 },
  // دسته جعبه‌ها و بشکه B (پیاده‌روی راست — میانه)
  { minX: 6.45, maxX: 8.55, minZ: -7.75, maxZ: -5.2 },
  // دسته جعبه‌ها و بشکه C (پیاده‌روی چپ — شمال)
  { minX: -8.55, maxX: -6.35, minZ: -11.0, maxZ: -8.6 },
  // دسته جعبه‌های چوبی D (پیاده‌روی راست — جنوبِ گیشه)
  { minX: 6.5, maxX: 8.55, minZ: 4.65, maxZ: 6.5 },
  // دسته جعبه‌های چوبی E (پیاده‌روی چپ، در امتدادِ تازهٔ جنوبی)
  { minX: -8.55, maxX: -6.55, minZ: 12.6, maxZ: 14.6 },
  // دسته جعبه، بشکه و پالتِ فرعی (پیاده‌روی جنوبیِ فرعی)
  { minX: -19.1, maxX: -16.4, minZ: 28.4, maxZ: 30.5 },
  // دسته جعبه و بشکهٔ خیابانِ غربی (پیاده‌روی غربی)
  { minX: -37.85, maxX: -36.4, minZ: 10.2, maxZ: 12.1 },
  // پایهٔ چهار چراغ برق گالوانیزه — دو جفت رو‌به‌روی هم روی جدول‌های چپ و راست
  // جفت جنوبی (z = +۳٫۶)
  { minX: -6.28, maxX: -5.62, minZ: 3.27, maxZ: 3.93 },
  { minX: 5.62, maxX: 6.28, minZ: 3.27, maxZ: 3.93 },
  // جفت شمالی (z = −۷٫۰)
  { minX: -6.28, maxX: -5.62, minZ: -7.33, maxZ: -6.67 },
  { minX: 5.62, maxX: 6.28, minZ: -7.33, maxZ: -6.67 },
];

const COLLISION_EPS = 1e-4;
const PUSH_ITERATIONS = 5;

export function checkAABBCollision(
  x: number,
  z: number,
  radius: number,
  obstacles: readonly AABB[],
): boolean {
  for (const box of obstacles) {
    const closestX = Math.max(box.minX, Math.min(x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
    const dx = x - closestX;
    const dz = z - closestZ;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

/**
 * اگر مختصات داخل یا مماس با مانع باشد، با کمترین بردار جابه‌جایی (MTV) به بیرون هدایت می‌شود.
 * این تابع هم اسلاید نرم دور گوشه‌های گرد جعبه‌ها/تیرها را تضمین می‌کند و هم مانع از گیر کردن
 * ابدی بازیکن در مختصات ذخیره‌شده یا کنج دو مانع می‌شود.
 */
export function sanitizePosition(
  rawX: number,
  rawZ: number,
  bounds: WorldBounds,
  radius = 0.35,
  obstacles: readonly AABB[] = ALLEY_STATIC_OBSTACLES,
): { x: number; z: number; adjusted: boolean } {
  const safeR = Math.max(0, radius);
  const initialClamp = clampToBounds(
    Number.isFinite(rawX) ? rawX : 0,
    Number.isFinite(rawZ) ? rawZ : 0,
    bounds,
  );
  let x = initialClamp.x;
  let z = initialClamp.z;
  let adjusted = initialClamp.hitWall || !Number.isFinite(rawX) || !Number.isFinite(rawZ);

  for (let pass = 0; pass < PUSH_ITERATIONS; pass++) {
    let movedInPass = false;

    for (const box of obstacles) {
      const closestX = Math.max(box.minX, Math.min(x, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
      const dx = x - closestX;
      const dz = z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq >= safeR * safeR) continue;

      adjusted = true;
      movedInPass = true;

      if (distSq > 1e-12) {
        const dist = Math.sqrt(distSq);
        const push = safeR - dist + COLLISION_EPS;
        x += (dx / dist) * push;
        z += (dz / dist) * push;
      } else {
        // مرکز دایره داخل جعبه افتاده است: نزدیک‌ترین خروجیِ آزاد را انتخاب کن
        const candidates = [
          { nx: box.minX - safeR - COLLISION_EPS, nz: z, cost: Math.abs(x - (box.minX - safeR)) },
          { nx: box.maxX + safeR + COLLISION_EPS, nz: z, cost: Math.abs(box.maxX + safeR - x) },
          { nx: x, nz: box.minZ - safeR - COLLISION_EPS, cost: Math.abs(z - (box.minZ - safeR)) },
          { nx: x, nz: box.maxZ + safeR + COLLISION_EPS, cost: Math.abs(box.maxZ + safeR - z) },
        ];
        const validFree = candidates.filter(
          (c) =>
            c.nx >= bounds.minX &&
            c.nx <= bounds.maxX &&
            c.nz >= bounds.minZ &&
            c.nz <= bounds.maxZ &&
            !checkAABBCollision(c.nx, c.nz, safeR, obstacles),
        );
        const inBounds = candidates.filter(
          (c) =>
            c.nx >= bounds.minX &&
            c.nx <= bounds.maxX &&
            c.nz >= bounds.minZ &&
            c.nz <= bounds.maxZ,
        );
        const pool = validFree.length > 0 ? validFree : inBounds.length > 0 ? inBounds : candidates;
        pool.sort((a, b) => a.cost - b.cost);
        x = pool[0].nx;
        z = pool[0].nz;
      }

      const rebounded = clampToBounds(x, z, bounds);
      x = rebounded.x;
      z = rebounded.z;
    }

    if (!movedInPass) break;
  }

  return { x, z, adjusted };
}

export function resolveMovement(
  prev: PlayerTransform,
  nextX: number,
  nextZ: number,
  bounds: WorldBounds,
  radius = 0.35,
  obstacles: readonly AABB[] = ALLEY_STATIC_OBSTACLES,
): CollisionResult {
  const safeR = Math.max(0, radius);
  // اگر نقطهٔ شروع به هر دلیلی داخل مانع باشد، ابتدا آزادش کن تا هرگز قفل نشود
  const safeStart = sanitizePosition(prev.x, prev.z, bounds, safeR, obstacles);

  const totalDx = nextX - safeStart.x;
  const totalDz = nextZ - safeStart.z;
  const distance = Math.hypot(totalDx, totalDz);

  if (distance === 0) {
    return {
      collided: safeStart.adjusted,
      clampedX: safeStart.x,
      clampedZ: safeStart.z,
      hitWall: safeStart.adjusted,
    };
  }

  // گام‌بندی ریز برای جلوگیری از رد شدن از موانع باریک در افت فریم
  const maxStep = Math.max(0.08, safeR * 0.45);
  const steps = Math.max(1, Math.ceil(distance / maxStep));
  let curX = safeStart.x;
  let curZ = safeStart.z;
  let collided = safeStart.adjusted;

  for (let i = 1; i <= steps; i++) {
    const stepTargetX = curX + totalDx / steps;
    const stepTargetZ = curZ + totalDz / steps;
    const stepRes = sanitizePosition(stepTargetX, stepTargetZ, bounds, safeR, obstacles);
    if (stepRes.adjusted) collided = true;

    if (!checkAABBCollision(stepRes.x, stepRes.z, safeR, obstacles)) {
      curX = stepRes.x;
      curZ = stepRes.z;
    } else {
      // محافظ نهایی در کنج‌های بسیار تنگ: اسلاید تک‌محوره روی نقطهٔ امن فعلی
      collided = true;
      const slideX = sanitizePosition(stepTargetX, curZ, bounds, safeR, obstacles);
      const slideZ = sanitizePosition(curX, stepTargetZ, bounds, safeR, obstacles);
      if (!checkAABBCollision(slideX.x, slideX.z, safeR, obstacles)) {
        curX = slideX.x;
        curZ = slideX.z;
      } else if (!checkAABBCollision(slideZ.x, slideZ.z, safeR, obstacles)) {
        curX = slideZ.x;
        curZ = slideZ.z;
      } else {
        break;
      }
    }
  }

  return { collided, clampedX: curX, clampedZ: curZ, hitWall: collided };
}
