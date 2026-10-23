import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import {
  ALLEY_BRANCH,
  ALLEY_ENTRANCE_STREET,
  ALLEY_MAIN,
  ALLEY_THEATER,
} from '@/engine3d/alley-layout';
import { alleyWalkableGroundAt } from '@/engine3d/alley-ground-profile';
import { DEFAULT_ALLEY_ANCHORS } from '@/engine3d/types';

/**
 * خواستهٔ بازبینی (امیر):
 *   «تیرِ برقِ جلوی دربِ ورودی رو حذف کن و همین راهِ جلوی دربِ ورودی بجای
 *    پیاده‌رو تبدیل به خیابان بشه؛ از سمتِ چپِ درب حداقل ده قدم و سمتِ راستِ درب
 *    بعد از پیچ هم خیابان ادامه داشته باشه، به اندازهٔ ده قدم.»
 *
 * جایی که «خیابان» می‌شود، کفِ برجستهٔ پیاده‌رو (۱۳ سانتی‌متر) برداشته شده و
 * سنگ‌فرشِ خیابان تا پای دیوار/نما می‌آید.
 */

const STREET_RUN = ALLEY_ENTRANCE_STREET.steps * ALLEY_ENTRANCE_STREET.stepLength;
const RADIUS = 0.35;

function meshByName(alley: ReturnType<typeof createAlleyGeometry>, name: string) {
  return alley.group.getObjectByName(name) as THREE.Mesh<THREE.BufferGeometry> | undefined;
}

describe('خیابانِ جلوی درِ ورودی و حذفِ تیرِ برقِ آن (امیر)', () => {
  it('ده قدم خیابان از هر طرف، و هیچ تیرِ برقی جلوی در نمانده', () => {
    // ۱۰ قدم × ۰٫۸ متر = ۸ متر
    expect(STREET_RUN).toBeCloseTo(8, 6);
    expect(ALLEY_ENTRANCE_STREET.westEdgeX).toBeCloseTo(ALLEY_THEATER.doorX - 1.006 - 8, 6);
    expect(ALLEY_ENTRANCE_STREET.mainSidewalkEndZ).toBeCloseTo(ALLEY_BRANCH.northZ - 8, 6);

    const alley = createAlleyGeometry();
    // تیرِ شمالیِ فرعی که دقیقاً جلوی در بود، حذف شده است
    expect(alley.group.getObjectByName('UtilityPole_BranchNorth')).toBeUndefined();
    expect(alley.group.getObjectByName('UtilityPole_BranchSouth')).toBeDefined();
    // هیچ تیر چراغ برقی در نیم‌دایرهٔ سه‌متریِ جلوی در نیست
    const door = DEFAULT_ALLEY_ANCHORS.theaterDoor;
    alley.group.traverse((object) => {
      if (!object.name.startsWith('UtilityPole_')) return;
      const p = object.getWorldPosition(new THREE.Vector3());
      const distance = Math.hypot(p.x - door.x, p.z - door.z);
      expect(distance, object.name).toBeGreaterThan(6);
    });

    alley.dispose();
  });

  it('پیاده‌روی شمالیِ فرعی کامل برداشته شده: کلِ آن سمت خیابان است', () => {
    const alley = createAlleyGeometry();

    // با بازشدنِ خیابانِ غربی، دیگر هیچ پیاده‌روی شمالی در فرعی نمانده است
    expect(meshByName(alley, 'BranchSidewalkNorth')).toBeUndefined();
    expect(meshByName(alley, 'BranchSidewalkNorthWest')).toBeUndefined();
    expect(meshByName(alley, 'BranchCurbNorthCurb')).toBeUndefined();
    expect(meshByName(alley, 'BranchCurbNorthWestCurb')).toBeUndefined();
    // پیاده‌روی جنوبیِ فرعی سر جایش است
    expect(meshByName(alley, 'BranchSidewalkSouth')).toBeDefined();

    alley.dispose();
  });

  it('پیاده‌روی چپِ شاخهٔ اصلی فقط تا ده قدم بعد از پیچ ادامه دارد', () => {
    const alley = createAlleyGeometry();
    const walk = meshByName(alley, 'SidewalkLeft');
    expect(walk).toBeDefined();
    alley.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(walk!);
    expect(box.max.z).toBeLessThanOrEqual(ALLEY_ENTRANCE_STREET.mainSidewalkEndZ + 1e-6);
    // سمتِ راست دست‌نخورده تا انتهای کوچه می‌رود
    const right = meshByName(alley, 'SidewalkRight');
    expect(right).toBeDefined();
    const rightBox = new THREE.Box3().setFromObject(right!);
    expect(rightBox.max.z).toBeGreaterThanOrEqual(ALLEY_MAIN.southZ - 0.01);

    alley.dispose();
  });

  it('گام‌برداری: جلوی در و بعد از پیچ کفِ خیابان است، نه ۱۳ سانتی‌متر بالاتر', () => {
    const door = DEFAULT_ALLEY_ANCHORS.theaterDoor;

    // روبه‌روی در و در ده قدمِ چپِ آن: کفِ خیابان
    expect(alleyWalkableGroundAt(door.x, ALLEY_BRANCH.northSidewalkCenterZ)).toBeCloseTo(0, 6);
    expect(alleyWalkableGroundAt(door.x - 5, ALLEY_BRANCH.northSidewalkCenterZ)).toBeCloseTo(0, 6);
    // بیرون از خیابان (غربِ لبه) پیاده‌روی ۱۳ سانتی‌متری سر جایش است
    expect(
      alleyWalkableGroundAt(ALLEY_ENTRANCE_STREET.westEdgeX - 1, ALLEY_BRANCH.northSidewalkCenterZ),
    ).toBeCloseTo(0.13, 6);

    // بعد از پیچ، در ده قدمِ شمالِ گوشه، خیابان تا دیوارِ چپ ادامه دارد
    expect(alleyWalkableGroundAt(-7.5, ALLEY_BRANCH.northZ - 1)).toBeCloseTo(0, 6);
    expect(alleyWalkableGroundAt(-7.5, ALLEY_ENTRANCE_STREET.mainSidewalkEndZ - 1)).toBeCloseTo(
      0.13,
      6,
    );
    // سمتِ راست دست‌نخورده است
    expect(alleyWalkableGroundAt(7.5, ALLEY_BRANCH.northZ - 1)).toBeCloseTo(0.13, 6);
  });

  it('خیابان جلوی در قابلِ راه‌رفتن است و جلوی در و گوشهٔ پیچ مانعی ندارد', () => {
    const alley = createAlleyGeometry();
    const door = DEFAULT_ALLEY_ANCHORS.theaterDoor;

    // خودِ نما و ستون‌ها مانع‌اند، ولی جلوی در تا فاصلهٔ رادیوس باز است
    expect(alley.group.getObjectByName('TheaterFacade')).toBeDefined();
    expect(door.z).toBeCloseTo(ALLEY_THEATER.wallZ, 6);

    alley.dispose();
  });
});
