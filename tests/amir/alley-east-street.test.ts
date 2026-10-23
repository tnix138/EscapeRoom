import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import {
  ALLEY_BRANCH,
  ALLEY_EAST,
  ALLEY_EAST_ROWS,
  ALLEY_L_BOUNDS,
  ALLEY_MAIN,
  isInEastStreet,
} from '@/engine3d/alley-layout';
import { alleyWalkableGroundAt } from '@/engine3d/alley-ground-profile';
import {
  ALLEY_STATIC_OBSTACLES,
  checkAABBCollision,
  sanitizePosition,
} from '@/engine3d/collision';
import { DEFAULT_ALLEY_BOUNDS, DEFAULT_ALLEY_SPAWN } from '@/engine3d/types';

/**
 * خواستهٔ بازبینیِ امیر:
 *   «حالا می‌خوام سمتِ راستِ کوچهٔ اصلی هم قرینهٔ این کوچه‌ای که اضافه کردی اضافه
 *    بشه؛ یعنی بن‌بستِ دوم تبدیل به خیابان بشه.»
 *
 * پس سمتِ راست (= شرق) یک شاخهٔ قرینهٔ فرعیِ غربی می‌گیرد، با دو تفاوتِ خواسته‌شده:
 *   • **پهن‌تر از فرعی**: ۱۳ متر عرض با پیاده‌روی ۲٫۶ متری (فرعی ۹٫۸ با ۱٫۷)
 *   • **بدونِ بن‌بست**: نه دیوارِ انتهایی، نه درِ چوبی و نه فانوسی؛ کف و ساختمان‌ها
 *     تا دوردست ادامه دارند و بازیکن در مرزِ نقشه می‌ایستد، در حالی که خیابان در
 *     مه و ساختمان‌های دور محو می‌شود.
 */

function meshByName(alley: ReturnType<typeof createAlleyGeometry>, name: string) {
  return alley.group.getObjectByName(name) as THREE.Mesh<THREE.BufferGeometry> | undefined;
}

const EAST_BAND_CENTER = ALLEY_EAST.centerZ;

describe('خیابانِ شرقیِ باز — قرینهٔ فرعیِ غربی در سمتِ راست (امیر)', () => {
  it('قرینهٔ فرعی است ولی خیابان: پهن‌تر، از دیوارِ راست تا دوردست', () => {
    // دهانهٔ خیابان از دیوارِ راستِ شاخهٔ اصلی باز می‌شود، جاهای قبل از آن بسته است
    expect(ALLEY_EAST.westX).toBeCloseTo(ALLEY_MAIN.innerX, 6);
    expect(ALLEY_EAST.westX).toBeGreaterThan(0);
    // پیاده‌روی خیابان دقیقاً از لبهٔ پیاده‌روی راستِ شاخهٔ اصلی شروع می‌شود
    expect(ALLEY_EAST.walkWestX).toBeCloseTo(ALLEY_MAIN.curbX, 6);
    // عرضِ ۱۳ متریِ خیابان، بیشتر از ۹٫۸ مترِ فرعی و برابرِ عرضِ شاخهٔ اصلی
    expect(ALLEY_EAST.southZ - ALLEY_EAST.northZ).toBeCloseTo(ALLEY_EAST.width, 6);
    expect(ALLEY_EAST.width).toBeGreaterThan(ALLEY_BRANCH.southZ - ALLEY_BRANCH.northZ);
    // تقریباً همان عرضِ شاخهٔ اصلی (۱۳٫۲ متر) است، نه عرضِ فرعی
    expect(ALLEY_EAST.width).toBeGreaterThan(ALLEY_BRANCH.southZ - ALLEY_BRANCH.northZ + 3);
    // دو پیاده‌روی پهن‌تر از فرعی
    expect(ALLEY_EAST.sidewalkWidth).toBeGreaterThan(ALLEY_BRANCH.sidewalkWidth);
    // سنگ‌فرشِ میانی ۷٫۸ متر است و پیاده‌روها روی همان حساب می‌شوند
    const halfRoad = (ALLEY_EAST.width - 2 * ALLEY_EAST.sidewalkWidth) / 2;
    expect(ALLEY_EAST.roadHalfWidth).toBeCloseTo(halfRoad, 6);
    expect(ALLEY_EAST.northSidewalkCenterZ).toBeCloseTo(
      ALLEY_EAST.northZ + ALLEY_EAST.sidewalkWidth / 2,
      6,
    );
    expect(ALLEY_EAST.southSidewalkCenterZ).toBeCloseTo(
      ALLEY_EAST.southZ - ALLEY_EAST.sidewalkWidth / 2,
      6,
    );
    expect(ALLEY_EAST.centerZ).toBeCloseTo((ALLEY_EAST.northZ + ALLEY_EAST.southZ) / 2, 6);
    // انتهای شرقیِ خیابان بیرونِ مرزِ نقشه ادامه دارد (خیابان تمام نمی‌شود)
    expect(ALLEY_EAST.viewEndX).toBeGreaterThan(ALLEY_EAST.eastX);
    expect(ALLEY_EAST.groundEastX).toBeGreaterThan(ALLEY_EAST.viewEndX);
    // باندِ خیابان درست تشخیص داده می‌شود
    expect(isInEastStreet(ALLEY_EAST.walkWestX, EAST_BAND_CENTER)).toBe(true);
    expect(isInEastStreet(ALLEY_EAST.walkWestX - 1, EAST_BAND_CENTER)).toBe(false);
    expect(isInEastStreet(20, ALLEY_EAST.northZ - 1)).toBe(false);
    expect(isInEastStreet(20, Number.NaN)).toBe(false);
  });

  it('مرزِ نقشه تا انتهای خیابان باز است و اسپاون دست‌نخورده می‌ماند', () => {
    expect(ALLEY_L_BOUNDS.maxX).toBeCloseTo(ALLEY_EAST.eastX, 6);
    expect(DEFAULT_ALLEY_BOUNDS.maxX).toBeCloseTo(ALLEY_EAST.eastX, 6);
    // دو مرزِ دیگر همان کوچهٔ L را می‌سازند
    expect(ALLEY_L_BOUNDS.minX).toBeCloseTo(ALLEY_BRANCH.westX, 6);
    expect(ALLEY_L_BOUNDS.maxZ).toBeCloseTo(ALLEY_MAIN.southZ, 6);
    expect(DEFAULT_ALLEY_SPAWN.position.z).toBeLessThan(ALLEY_EAST.northZ);
  });

  it('بن‌بستِ دوم دیگر بن‌بست نیست: نه دیوار، نه در و نه فانوسی در شرق', () => {
    // هیچ شیئی به اسمِ بن‌بستِ شرقی/دیوارِ انتهاییِ شرقی ساخته نشده است
    const names: string[] = [];
    const alley = createAlleyGeometry();
    alley.group.traverse((object) => {
      if (object.name) names.push(object.name);
    });
    for (const name of names) {
      if (name.startsWith('EastDeadEnd') || name.startsWith('EastEndWall')) {
        throw new Error(`بن‌بستِ شرقی نباید ساخته شود: ${name}`);
      }
    }
    // آنچه در فرعیِ غربی «بن‌بست» بود (دیوار + در + فانوس) فقط همان یک نمونه است
    expect(names.filter((n) => n.startsWith('BranchDeadEnd')).length).toBeGreaterThan(0);

    // و روی زمین: کلِ دهانهٔ خیابان تا مرزِ نقشه قابلِ عبور است
    for (const x of [ALLEY_EAST.walkWestX + 1, 14, 22, 30.5, ALLEY_EAST.eastX]) {
      expect(checkAABBCollision(x, EAST_BAND_CENTER, 0.35, ALLEY_STATIC_OBSTACLES), `x=${x}`).toBe(
        false,
      );
    }
    // بازیکن فقط با مرزِ نقشه در انتهای خیابان می‌ایستد، نه با یک دیوار
    const atEdge = sanitizePosition(ALLEY_EAST.eastX + 5, EAST_BAND_CENTER, DEFAULT_ALLEY_BOUNDS);
    expect(atEdge.x).toBeCloseTo(ALLEY_EAST.eastX, 6);
    expect(atEdge.z).toBeCloseTo(EAST_BAND_CENTER, 6);

    alley.dispose();
  });

  it('دو طرفِ خیابان بسته است: بلوکِ شمالی و بلوکِ جنوبی', () => {
    // شمالِ خیابان: پیش از `northZ` هیچ راهی نیست — نه در دهانهٔ خیابان و نه
    // دورتر در امتدادِ شرقی
    expect(checkAABBCollision(12.0, 16.0, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(true);
    expect(checkAABBCollision(30.0, 15.0, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(true);
    // جنوبِ خیابان: پس از `southZ` هم مانع هست
    expect(checkAABBCollision(12.0, 32.5, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(true);
    expect(checkAABBCollision(30.0, 33.5, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(true);
    // ولی خودِ باندِ خیابان بینِ این دو دیوار باز است
    expect(checkAABBCollision(12.0, 20.0, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);
    expect(checkAABBCollision(30.0, 30.0, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);
  });

  it('کفِ خیابان از عرضش پروفیل می‌گیرد، نه از x', () => {
    // مرکزِ خیابان سنگ‌فرشِ هم‌سطحِ صفر است
    expect(alleyWalkableGroundAt(ALLEY_EAST.walkWestX + 2, EAST_BAND_CENTER)).toBeCloseTo(0, 6);
    expect(alleyWalkableGroundAt(ALLEY_EAST.eastX, EAST_BAND_CENTER)).toBeCloseTo(0, 6);
    // روی هر دو پیاده‌رو ۱۳ سانتی‌متر بالا می‌رود
    expect(
      alleyWalkableGroundAt(20, ALLEY_EAST.northSidewalkCenterZ),
    ).toBeCloseTo(0.13, 6);
    expect(
      alleyWalkableGroundAt(20, ALLEY_EAST.southSidewalkCenterZ),
    ).toBeCloseTo(0.13, 6);
    // روی جدول، پیوسته بینِ صفر و ۱۳ سانتی‌متر
    const onCurb = alleyWalkableGroundAt(20, ALLEY_EAST.centerZ - ALLEY_EAST.roadHalfWidth - 0.135);
    expect(onCurb).toBeGreaterThan(0);
    expect(onCurb).toBeLessThan(0.13);
    // پیش از دهانهٔ خیابان (z < northZ) همان پروفیلِ شاخهٔ اصلی است
    expect(alleyWalkableGroundAt(20, ALLEY_EAST.northZ - 1)).toBeCloseTo(0.13, 6);
  });

  it('هندسهٔ خیابان ساخته می‌شود: کف، پیاده‌روها، ردیف‌ها و ساختمان‌های دور', () => {
    const alley = createAlleyGeometry();
    alley.group.updateMatrixWorld(true);

    const ground = meshByName(alley, 'EastGround');
    expect(ground).toBeDefined();
    const groundBox = new THREE.Box3().setFromObject(ground!);
    // کف از لبهٔ سنگ‌فرشِ شاخهٔ اصلی تا دوردستِ خیابان کشیده شده است
    expect(groundBox.min.x).toBeCloseTo(ALLEY_EAST.groundWestX, 4);
    expect(groundBox.max.x).toBeCloseTo(ALLEY_EAST.groundEastX, 4);
    expect(groundBox.min.z).toBeCloseTo(ALLEY_EAST.northZ, 4);
    expect(groundBox.max.z).toBeCloseTo(ALLEY_EAST.southZ, 4);
    expect(groundBox.max.y).toBeLessThan(0.01); // کفِ تخت، بدونِ تاج
    // سنگ‌فرشِ خیابان همان بافتِ کوچهٔ اصلی است (هم‌رنگ و هم‌جنس)
    const mainGround = meshByName(alley, 'Ground') as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    const eastGround = ground as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    expect((eastGround.material as THREE.MeshStandardMaterial).map).toBe(
      (mainGround.material as THREE.MeshStandardMaterial).map,
    );

    // پیاده‌رو و جدول هر دو طرف تا انتهای دید ادامه دارند
    for (const [walkName, curbName, centerZ] of [
      ['EastSidewalkNorth', 'EastCurbNorth', ALLEY_EAST.northSidewalkCenterZ],
      ['EastSidewalkSouth', 'EastCurbSouth', ALLEY_EAST.southSidewalkCenterZ],
    ] as const) {
      const walk = meshByName(alley, walkName);
      expect(walk, walkName).toBeDefined();
      const box = new THREE.Box3().setFromObject(walk!);
      expect(box.min.x).toBeCloseTo(ALLEY_EAST.walkWestX, 3);
      expect(box.max.x).toBeCloseTo(ALLEY_EAST.viewEndX, 3);
      expect(walk!.position.z).toBeCloseTo(centerZ, 6);
      expect(box.max.y).toBeCloseTo(0.13, 4);
      const curb = meshByName(alley, curbName);
      expect(curb, curbName).toBeDefined();
      expect(curb!.position.y).toBeCloseTo(0.077, 6);
    }

    // ردیف‌ها مثلِ فرعی چرخیده‌اند (۹۰ درجه) تا نما رو به خیابان باشد
    const northRow = alley.group.getObjectByName('EastBuildingsNorth') as THREE.Group;
    const southRow = alley.group.getObjectByName('EastBuildingsSouth') as THREE.Group;
    expect(northRow).toBeDefined();
    expect(southRow).toBeDefined();
    expect(northRow.rotation.y).toBeCloseTo(ALLEY_EAST_ROWS.rotationY, 6);
    expect(southRow.rotation.y).toBeCloseTo(ALLEY_EAST_ROWS.rotationY, 6);
    expect(ALLEY_EAST_ROWS.rotationY).toBeCloseTo(Math.PI / 2, 6);

    // هر طرف چند ساختمانِ واقعی با نما روی دیوارِ خیابان
    const northBuildings = northRow.children.length;
    const southBuildings = southRow.children.length;
    expect(northBuildings).toBeGreaterThanOrEqual(4);
    expect(southBuildings).toBeGreaterThanOrEqual(4);
    for (const [row, isNorth] of [
      [northRow, true],
      [southRow, false],
    ] as const) {
      for (const child of row.children) {
        const box = new THREE.Box3().setFromObject(child);
        // نما روی دیوارِ خیابان است و فقط بالکن/قرنیز کمی بیرون می‌زند
        if (isNorth) {
          // ساختمان شمالِ خیابان است، پس نما لبهٔ جنوبیِ جعبه (بزرگ‌ترین z)
          expect(box.max.z).toBeGreaterThan(ALLEY_EAST.northZ - 0.05);
          expect(box.max.z).toBeLessThan(ALLEY_EAST.northZ + 1.3);
          expect(box.min.z).toBeLessThan(ALLEY_EAST.northZ);
        } else {
          // ساختمان جنوبِ خیابان است، پس نما لبهٔ شمالیِ جعبه (کوچک‌ترین z)
          expect(box.min.z).toBeLessThan(ALLEY_EAST.southZ + 0.05);
          expect(box.min.z).toBeGreaterThan(ALLEY_EAST.southZ - 1.3);
          expect(box.max.z).toBeGreaterThan(ALLEY_EAST.southZ);
        }
        // ساختمان‌ها از دهانهٔ خیابان تا دوردست پخش شده‌اند
        expect(box.min.x).toBeGreaterThan(ALLEY_EAST.walkWestX - 0.5);
        expect(box.max.x).toBeLessThanOrEqual(ALLEY_EAST.viewEndX + 12);
        expect(box.max.y).toBeGreaterThan(6); // ارتفاعِ چندطبقه
      }
    }

    // ساختمان‌های دور، پشتِ مرزِ بازیکن، دیدِ انتهای خیابان را می‌بندند
    const vanishing = alley.group.getObjectByName('EastVanishingBuildings') as THREE.Group;
    expect(vanishing).toBeDefined();
    expect(vanishing.children.length).toBeGreaterThanOrEqual(5);
    const vanishBox = new THREE.Box3().setFromObject(vanishing);
    expect(vanishBox.min.x).toBeGreaterThan(ALLEY_EAST.eastX);
    expect(vanishBox.min.z).toBeLessThan(ALLEY_EAST.northZ + 2);
    expect(vanishBox.max.z).toBeGreaterThan(ALLEY_EAST.southZ - 2);

    alley.dispose();
  });

  it('دو تیرِ چراغِ خیابان روی پیاده‌روها می‌نشینند و بازویشان به سمتِ مرکز است', () => {
    const alley = createAlleyGeometry();
    alley.group.updateMatrixWorld(true);

    const eastPole = alley.group.getObjectByName('UtilityPole_EastStreet') as THREE.Group;
    const farPole = alley.group.getObjectByName('UtilityPole_EastStreetFar') as THREE.Group;
    expect(eastPole).toBeDefined();
    expect(farPole).toBeDefined();

    // روی پیاده‌روی جنوبی و شمالی
    expect(eastPole.position.z).toBeCloseTo(ALLEY_EAST.southSidewalkCenterZ, 6);
    expect(farPole.position.z).toBeCloseTo(ALLEY_EAST.northSidewalkCenterZ, 6);
    expect(eastPole.position.x).toBeGreaterThan(ALLEY_EAST.walkWestX);
    expect(farPole.position.x).toBeGreaterThan(eastPole.position.x);

    // سرِ چراغ از تیر به سمتِ مرکزِ خیابان خم شده است
    const eastGlobe = eastPole.getObjectByName('LampBulb_EastStreet') as THREE.Mesh;
    const farGlobe = farPole.getObjectByName('LampBulb_EastStreetFar') as THREE.Mesh;
    const eastLamp = eastGlobe.getWorldPosition(new THREE.Vector3());
    const farLamp = farGlobe.getWorldPosition(new THREE.Vector3());
    expect(Math.abs(eastLamp.z - EAST_BAND_CENTER)).toBeLessThan(
      Math.abs(eastPole.position.z - EAST_BAND_CENTER),
    );
    expect(Math.abs(farLamp.z - EAST_BAND_CENTER)).toBeLessThan(
      Math.abs(farPole.position.z - EAST_BAND_CENTER),
    );

    // پایهٔ هر دو تیر مانعِ عبور است
    expect(
      checkAABBCollision(eastPole.position.x, eastPole.position.z, 0.2, ALLEY_STATIC_OBSTACLES),
    ).toBe(true);
    expect(
      checkAABBCollision(farPole.position.x, farPole.position.z, 0.2, ALLEY_STATIC_OBSTACLES),
    ).toBe(true);

    alley.dispose();
  });
});
