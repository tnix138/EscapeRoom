import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import { ALLEY_BRANCH, ALLEY_LENGTHS, ALLEY_MAIN, isInBranch } from '@/engine3d/alley-layout';
import {
  ALLEY_STATIC_OBSTACLES,
  checkAABBCollision,
  sanitizePosition,
} from '@/engine3d/collision';
import { alleyWalkableGroundAt } from '@/engine3d/alley-ground-profile';
import { DEFAULT_ALLEY_BOUNDS, DEFAULT_ALLEY_SPAWN } from '@/engine3d/types';

/**
 * خواستهٔ بازبینی (امیر):
 * «توی کوچه پشت سرمون نرده کشیده شده؛ اون نرده رو بردار، کوچه رو دوبرابر کن و
 *  انتهای کوچه یه فرعی به سمتِ چپ درست کن که کوچه L بشه.»
 *
 * این تست هر سه خواسته را هم‌زمان و از سه زاویه می‌سنجد:
 *  ۱) هندسهٔ صحنه (گروه‌ها و اندازهٔ مش‌ها)
 *  ۲) برخورد و مرزهای راه‌رفتن (کجا آزاد و کجا بسته است)
 *  ۳) ارتفاع گام‌برداری روی پیاده‌روِ شاخهٔ اصلی و فرعی
 */

const RADIUS = 0.35;

describe('کوچهٔ L‌شکل: حذف نرده، دوبرابر شدن طول و فرعیِ چپ (امیر)', () => {
  it('نرده/دروازهٔ آهنیِ پشتِ سر کامل برداشته شده و هیچ سدی پشت بازیکن نمانده', () => {
    const alley = createAlleyGeometry();

    expect(alley.group.getObjectByName('AlleyBackGate')).toBeUndefined();
    // مسیر پشتِ اسپاون تا انتهای کوچه باز است (نه دروازه، نه پایهٔ آجری)
    for (const z of [8.85, 10, 14, 18, 21]) {
      expect(checkAABBCollision(0, z, RADIUS, ALLEY_STATIC_OBSTACLES), `z=${z}`).toBe(false);
      expect(
        sanitizePosition(0, z, DEFAULT_ALLEY_BOUNDS, RADIUS).adjusted,
        `z=${z}`,
      ).toBe(false);
    }

    // انتهای کوچه دیگر «لبهٔ دنیا» نیست: بن‌بستِ فرعی با درِ چوبی و دیوار بسته است
    expect(alley.group.getObjectByName('BranchDeadEnd')).toBeDefined();
    expect(alley.group.getObjectByName('BranchDeadEndWall')).toBeDefined();
    expect(alley.group.getObjectByName('BranchDeadEndDoor')).toBeDefined();

    alley.dispose();
  });

  it('طولِ شاخهٔ اصلی کوچه حداقل دو برابرِ قبل (~۲۳ متر) شده است', () => {
    // پیش از این تغییر: از نمای تئاتر (z = −۱۳٫۲) تا دروازهٔ پشتی (z = +۸٫۸۵)
    const previousLength = 8.85 - -13.2;
    expect(ALLEY_LENGTHS.mainLength).toBeGreaterThanOrEqual(previousLength * 2 - 1);

    const alley = createAlleyGeometry();
    const ground = alley.group.getObjectByName('Ground') as THREE.Mesh<THREE.PlaneGeometry>;
    expect(ground).toBeDefined();
    const groundDepth = ground.geometry.parameters.height;
    // کف زیرِ ساختمان‌ها هم کشیده شده تا هیچ حفرهٔ بی‌بافتی نماند
    expect(groundDepth).toBeGreaterThan(ALLEY_MAIN.southZ - ALLEY_MAIN.northZ);
    expect(ground.position.z).toBeGreaterThan(0);
    expect(alley.bounds.maxZ).toBeCloseTo(ALLEY_MAIN.southZ, 6);

    // ساختمان‌های دو طرف تا انتهای تازه ادامه دارند
    expect(alley.group.getObjectByName('BuildingLeft_4')).toBeDefined();
    expect(alley.group.getObjectByName('BuildingRight_4')).toBeDefined();
    expect(alley.group.getObjectByName('BuildingRight_5')).toBeDefined();

    alley.dispose();
  });

  it('انتهای کوچه به سمتِ چپ (= −X) فرعی می‌خورد و نقشه L می‌شود', () => {
    // «چپ» از نگاهِ بازیکنِ اسپاون با yaw صفر (رو به −Z) همان سمتِ منفی x است
    expect(ALLEY_BRANCH.westX).toBeLessThan(-ALLEY_MAIN.innerX);
    expect(ALLEY_BRANCH.southZ).toBeCloseTo(ALLEY_MAIN.southZ, 6);
    // فرعی در انتهای کوچه است، نه میانهٔ آن
    expect(ALLEY_BRANCH.northZ).toBeGreaterThan(ALLEY_MAIN.northZ + ALLEY_LENGTHS.mainLength * 0.6);

    const alley = createAlleyGeometry();
    expect(alley.group.getObjectByName('BranchGround')).toBeDefined();
    expect(alley.group.getObjectByName('BranchBuildingsNorth')).toBeDefined();
    expect(alley.group.getObjectByName('BranchBuildingsSouth')).toBeDefined();
    expect(alley.group.getObjectByName('BranchSidewalkNorth')).toBeDefined();
    expect(alley.group.getObjectByName('BranchSidewalkSouth')).toBeDefined();

    // داخلِ فرعی آزاد است و انتهایش بسته
    for (const x of [-9.2, -14, -22, -30.5]) {
      expect(checkAABBCollision(x, ALLEY_BRANCH.centerZ, RADIUS, ALLEY_STATIC_OBSTACLES), `x=${x}`).toBe(
        false,
      );
    }
    expect(checkAABBCollision(ALLEY_BRANCH.westX - 0.2, ALLEY_BRANCH.centerZ, RADIUS, ALLEY_STATIC_OBSTACLES)).toBe(true);
    expect(checkAABBCollision(0, ALLEY_MAIN.southZ + 0.5, RADIUS, ALLEY_STATIC_OBSTACLES)).toBe(true);

    alley.dispose();
  });

  it('شکلِ L واقعاً حفظ می‌شود: گوشهٔ بیرونِ L بسته است، هر دو بازو باز', () => {
    // گوشهٔ شمال‌غربی (بیرونِ L، پشتِ دیوارِ چپ) نباید قابل عبور باشد
    for (const [x, z] of [
      [-12, 0],
      [-20, 10],
      [-10, 20.8],
      [-33, 26],
    ] as const) {
      expect(checkAABBCollision(x, z, RADIUS, ALLEY_STATIC_OBSTACLES), `${x},${z}`).toBe(true);
    }

    // شاخهٔ اصلی و فرعی هر دو آزاد
    for (const [x, z] of [
      [0, -12],
      [0, 0],
      [0, 20],
      [4.6, 26],
      [-12, 24],
      [-26, 29],
    ] as const) {
      expect(checkAABBCollision(x, z, RADIUS, ALLEY_STATIC_OBSTACLES), `${x},${z}`).toBe(false);
    }

    // مرزهای محیطی هم کلِ L را پوشش می‌دهند
    expect(DEFAULT_ALLEY_BOUNDS.minX).toBeLessThanOrEqual(ALLEY_BRANCH.westX + 1);
    expect(DEFAULT_ALLEY_BOUNDS.maxZ).toBeGreaterThanOrEqual(ALLEY_MAIN.southZ - 1);

    // اسپاون همچنان آزاد و بدون اصلاح است
    const spawnSafe = sanitizePosition(
      DEFAULT_ALLEY_SPAWN.position.x,
      DEFAULT_ALLEY_SPAWN.position.z,
      DEFAULT_ALLEY_BOUNDS,
      RADIUS,
    );
    expect(spawnSafe.adjusted).toBe(false);
    expect(spawnSafe.x).toBeCloseTo(DEFAULT_ALLEY_SPAWN.position.x, 6);
    expect(spawnSafe.z).toBeCloseTo(DEFAULT_ALLEY_SPAWN.position.z, 6);
  });

  it('ارتفاع گام‌برداری در فرعی از zp عرضِ فرعی حساب می‌شود، نه از x', () => {
    // سنگ‌فرشِ میانیِ فرعی، همسطحِ کف
    expect(alleyWalkableGroundAt(-15, ALLEY_BRANCH.centerZ)).toBeCloseTo(0, 6);
    // پیاده‌روی شمالی و جنوبیِ فرعی ۱۳ سانتی‌متر بالاتر
    expect(alleyWalkableGroundAt(-15, ALLEY_BRANCH.northSidewalkCenterZ)).toBeCloseTo(0.13, 6);
    expect(alleyWalkableGroundAt(-15, ALLEY_BRANCH.southSidewalkCenterZ)).toBeCloseTo(0.13, 6);
    // همان x در شاخهٔ اصلی (جایی که |x| بزرگ است و z در باند فرعی نیست) باید صفر باشد
    expect(alleyWalkableGroundAt(-4, 10)).toBeCloseTo(0, 6);
    // پیاده‌روی شاخهٔ اصلی در امتدادِ تازه هم مثل قبل کار می‌کند
    expect(alleyWalkableGroundAt(7.5, 22)).toBeCloseTo(0.13, 6);
    expect(alleyWalkableGroundAt(0, 22)).toBeCloseTo(0, 6);
    // پایهٔ جنوبی (جلوی دیوارِ بن‌بست) در هر دو بازو ۱۳ سانتی‌متر بالاست
    expect(alleyWalkableGroundAt(0, ALLEY_BRANCH.southZ - 0.5)).toBeCloseTo(0.13, 6);
    expect(alleyWalkableGroundAt(-25, ALLEY_BRANCH.southZ - 0.5)).toBeCloseTo(0.13, 6);
  });

  it('کمک‌تابعِ isInBranch فقط باندِ فرعی را می‌شناسد', () => {
    expect(isInBranch(-12, 26)).toBe(true);
    expect(isInBranch(-12, 10)).toBe(false);
    expect(isInBranch(0, 26)).toBe(false);
    expect(isInBranch(6, 26)).toBe(false);
  });
});
