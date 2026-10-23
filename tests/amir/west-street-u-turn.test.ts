import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import {
  ALLEY_BRANCH,
  ALLEY_ENTRANCE_STREET,
  ALLEY_LENGTHS,
  ALLEY_L_BOUNDS,
  ALLEY_MAIN,
  ALLEY_THEATER,
  ALLEY_WEST_STREET,
  isInBranch,
  isInWestStreet,
} from '@/engine3d/alley-layout';
import {
  ALLEY_STATIC_OBSTACLES,
  checkAABBCollision,
  resolveMovement,
  sanitizePosition,
} from '@/engine3d/collision';
import { alleyWalkableGroundAt } from '@/engine3d/alley-ground-profile';
import { DEFAULT_ALLEY_SPAWN } from '@/engine3d/types';

/**
 * خواستهٔ تازهٔ امیر:
 *   «کوچه‌ای که ساختمان و درب قرار گرفته رو تبدیل به خیابان کن و طولانی‌ترش کن؛
 *    یعنی L نباشد و از موقعیتِ ۲۶-۲۶ به سمتِ ۲۶-۰ هم ادامه داشته باشد.»
 *
 * یعنی انتهای غربیِ فرعی دیگر بن‌بست نیست: خیابان به سمتِ شمال می‌پیچد و تا
 * `z = ۰` بالا می‌رود؛ نقشه از L به **U** تبدیل می‌شود و سه بازو دارد.
 */

const RADIUS = 0.35;

describe('خیابانِ غربی: نقشه از L به U تبدیل شد (امیر)', () => {
  it('شاخهٔ سوم از گوشهٔ ۲۶-۲۶ تا ۲۶-۰ کشیده شده و فرعی بلندتر شده است', () => {
    const alley = createAlleyGeometry();

    expect(alley.group.getObjectByName('WestStreetGround')).toBeDefined();
    expect(alley.group.getObjectByName('WestStreetBuildingsWest')).toBeDefined();
    expect(alley.group.getObjectByName('WestStreetBuildingsEast')).toBeDefined();
    expect(alley.group.getObjectByName('WestStreetEndBuildings')).toBeDefined();
    expect(alley.group.getObjectByName('WestStreetSidewalkWest')).toBeDefined();
    expect(alley.group.getObjectByName('WestStreetSidewalkEast')).toBeDefined();

    // شاخهٔ غربی از باندِ فرعی (z = ۲۱٫۲) تا z = ۰ ادامه دارد
    expect(ALLEY_WEST_STREET.northZ).toBe(0);
    expect(ALLEY_WEST_STREET.southZ).toBeCloseTo(ALLEY_BRANCH.northZ, 6);
    expect(ALLEY_LENGTHS.westStreetLength).toBeCloseTo(21.2, 6);
    // عرضش دقیقاً مثلِ فرعی است
    expect(ALLEY_WEST_STREET.width).toBeCloseTo(
      ALLEY_BRANCH.southZ - ALLEY_BRANCH.northZ,
      6,
    );
    // فرعی از قبل بلندتر شده است (از −۳۲ به −۳۷٫۹ کشیده شد)
    expect(ALLEY_LENGTHS.branchLength).toBeGreaterThan(29);

    // کفِ خیابان تا نزدیکِ دیوارها کشیده شده (بدون حفرهٔ بی‌بافت)
    const ground = alley.group.getObjectByName('WestStreetGround') as THREE.Mesh<THREE.PlaneGeometry>;
    expect(ground.geometry.parameters.width).toBeGreaterThan(ALLEY_WEST_STREET.width);
    expect(ground.geometry.parameters.height).toBeGreaterThan(ALLEY_LENGTHS.westStreetLength);

    alley.dispose();
  });

  it('L نیست: خیابان از گوشه به سمتِ شمال باز است، سه بازو آزاد و بلوک میانی بسته', () => {
    const alley = createAlleyGeometry();
    // سه بازو باز
    for (const [x, z] of [
      [0, 0],
      [0, 25],
      [-20, 26],
      [-33, 20],
      [-33, 10],
      [-33, 1],
      [-30, 2],
    ] as const) {
      expect(sanitizePosition(x, z, ALLEY_L_BOUNDS, RADIUS).adjusted, `${x},${z}`).toBe(false);
      expect(checkAABBCollision(x, z, RADIUS, ALLEY_STATIC_OBSTACLES), `${x},${z}`).toBe(false);
    }

    // بلوکِ میانی و بیرونِ دیوارها بسته‌اند (L نبودن یعنی همین: گوشهٔ بیرون پر است،
    // نه مسیرِ بن‌بست)
    for (const [x, z] of [
      [-20, 10],
      [-12, 5],
      [-33, -1.5],
      [-38.6, 10],
      [-25, 21.0],
    ] as const) {
      const blocked =
        checkAABBCollision(x, z, RADIUS, ALLEY_STATIC_OBSTACLES) ||
        sanitizePosition(x, z, ALLEY_L_BOUNDS, RADIUS).adjusted;
      expect(blocked, `${x},${z}`).toBe(true);
    }

    // بن‌بستِ شمالی با درِ چوبی و فانوس سرِ جایش است و همان جنسِ دیوارِ بن‌بست
    expect(alley.group.getObjectByName('BranchDeadEnd')).toBeDefined();
    expect(alley.group.getObjectByName('BranchDeadEndDoor')).toBeDefined();
    expect(alley.group.getObjectByName('BranchDeadEndLanternLight')).toBeDefined();
    alley.dispose();
  });

  it('گام‌برداریِ خیابانِ غربی در محور x است و لبه‌هایش پلهٔ نرم دارد', () => {
    // وسطِ سواره‌رو
    expect(alleyWalkableGroundAt(ALLEY_WEST_STREET.centerX, 10)).toBeCloseTo(0, 6);
    // پیاده‌روهای شرقی و غربی
    expect(alleyWalkableGroundAt(ALLEY_WEST_STREET.westSidewalkCenterX, 10)).toBeCloseTo(0.13, 6);
    expect(alleyWalkableGroundAt(ALLEY_WEST_STREET.eastSidewalkCenterX, 10)).toBeCloseTo(0.13, 6);
    // همان نقاط در فرعی (محورِ عرض z) هم درست‌اند
    expect(alleyWalkableGroundAt(-20, ALLEY_BRANCH.centerZ)).toBeCloseTo(0, 6);
    expect(alleyWalkableGroundAt(-20, ALLEY_BRANCH.southSidewalkCenterZ)).toBeCloseTo(0.13, 6);
  });

  it('کمک‌تابع‌های نقشه، شاخهٔ تازه را می‌شناسند', () => {
    expect(isInWestStreet(-33, 10)).toBe(true);
    expect(isInWestStreet(-33, 25)).toBe(false); // آن‌جا باندِ فرعی است
    expect(isInWestStreet(-20, 10)).toBe(false);
    expect(isInBranch(-33, 26)).toBe(true);
    // مرزِ غربیِ نقشه حالا دیوارِ خیابانِ غربی است
    expect(ALLEY_L_BOUNDS.minX).toBeCloseTo(ALLEY_WEST_STREET.westX, 6);
    expect(ALLEY_L_BOUNDS.minX).toBeLessThan(ALLEY_THEATER.westEdgeX);
  });

  it('بازیکن می‌تواند از فرعی به خیابانِ غربی بپیچد و تا انتهای شمالی برود', () => {
    // از میانهٔ فرعی، پشتِ سرِ گوشه، به سمتِ شمال غرب
    const path: Array<[number, number]> = [
      [-20, 26],
      [-33, 26],
      [-33, 18],
      [-33, 6],
      [-33, 1],
    ];
    let current = { x: path[0][0], z: path[0][1], y: 1.65, yawDeg: 0, pitchDeg: 0 };
    for (const [x, z] of path.slice(1)) {
      const result = resolveMovement(current, x, z, ALLEY_L_BOUNDS, RADIUS);
      expect(result.collided, `${x},${z}`).toBe(false);
      expect(result.hitWall, `${x},${z}`).toBe(false);
      current = { ...current, x: result.clampedX, z: result.clampedZ };
      // بازیکن واقعاً به همان نقطه رسیده است (گیر نکرده)
      expect(Math.hypot(current.x - x, current.z - z)).toBeLessThan(0.05);
    }

    // اسپاون و مسیرِ ورودی دست‌نخورده‌اند
    const spawn = sanitizePosition(
      DEFAULT_ALLEY_SPAWN.position.x,
      DEFAULT_ALLEY_SPAWN.position.z,
      ALLEY_L_BOUNDS,
      RADIUS,
    );
    expect(spawn.adjusted).toBe(false);

    // خیابانِ جلوی درِ تماشاخانه هم سرِ جایش است (جلوی در باز است)
    expect(
      checkAABBCollision(
        ALLEY_THEATER.doorX,
        ALLEY_THEATER.wallZ + 1.5,
        RADIUS,
        ALLEY_STATIC_OBSTACLES,
      ),
    ).toBe(false);
    expect(ALLEY_ENTRANCE_STREET.westEdgeX).toBeGreaterThan(ALLEY_THEATER.westEdgeX);
    expect(ALLEY_MAIN.southZ).toBe(31);
  });
});
