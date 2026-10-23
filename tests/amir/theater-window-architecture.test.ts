import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { CURTAIN } from '@/engine3d/alley-window-curtain';
import {
  WINDOW_ARCHITECTURE as A,
  WINDOW_BOTTOM_Y,
  WINDOW_TOP_Y,
  buildTheaterWindowArchitecture,
} from '@/engine3d/theater-window-architecture';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';

/**
 * خواستۀ امیر — دورِ پنجره‌های بالای دربِ ورودی:
 *   «کنار هر پنجره دو نیم‌ستون از دیوار بیرون بزند و از پایین تا بالای پنجره
 *    بیاید، و بالای پنجره یک سنگِ افقی روی همان دو ستون بنشیند؛ حالتِ سایبان.»
 * پیش‌تر این سه پنجره فقط یک قابِ برنجی و شیشۀ سرخ داشتند — هیچ برجستگی و
 * هیچ سایه‌بانی روی نما نبود.
 */

const shaftName = (i: number, side: 'L' | 'R') => `TheaterWindowPilaster_${i}_${side}`;
const shaftMaterial = new THREE.MeshStandardMaterial({ color: 0x877c74 });
const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x67625c });

/** صفحۀ نصب = جلوی قابِ برنجی (پنجره‌ها ۰٫۰۲ بعد از لنگرِ در، ضخامتِ قاب ۰٫۱۲) */
const MOUNT_Z = -14.02 + A.frameDepth / 2;

function buildGroup(index: number = 0, x: number = CURTAIN.windowXs[0], mountZ: number = MOUNT_Z) {
  return buildTheaterWindowArchitecture({ index, x, mountZ, shaftMaterial, trimMaterial });
}

function worldBox(mesh: THREE.Object3D, group: THREE.Group) {
  group.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(mesh);
}

/** ستون‌های آزادِ ورودی (همان اعدادِ `alley-geometry`) با سرستونِ برنجی */
const FREE_COLUMNS = [-5.2, -2.55, 2.55, 5.2] as const;
const FREE_COLUMN_RADIUS = 0.35;
const FREE_CAPITAL_HALF_WIDTH = 0.46;

describe('معماریِ پنجره‌های سردر — دو نیم‌ستون', () => {
  it('برای هر پنجره دو نیم‌ستون و پایه/سرستونِ سنگی ساخته می‌شود', () => {
    const group = buildGroup();
    expect(group.children.length).toBe(8);
    for (const side of ['L', 'R'] as const) {
      for (const name of [
        shaftName(0, side),
        `TheaterWindowPilasterBase_0_${side}`,
        `TheaterWindowPilasterCapital_0_${side}`,
      ]) {
        expect(group.getObjectByName(name)).toBeDefined();
      }
    }
    expect(group.getObjectByName('TheaterWindowAwning_0')).toBeDefined();
    expect(group.getObjectByName('TheaterWindowAwningLip_0')).toBeDefined();
  });

  it('نیم‌ستون است، نه ستونِ گرد: نیم‌استوانهٔ تخت روی دیوار', () => {
    const group = buildGroup();
    for (const side of ['L', 'R'] as const) {
      const shaft = group.getObjectByName(shaftName(0, side)) as THREE.Mesh<THREE.CylinderGeometry>;
      expect(shaft.geometry.type).toBe('CylinderGeometry');
      const p = shaft.geometry.parameters;
      // دقیقاً نیمِ استوانه و بی‌درپوش (بدون کاسۀ اضافی)
      expect(p.thetaStart).toBeCloseTo(-Math.PI / 2, 6);
      expect(p.thetaLength).toBeCloseTo(Math.PI, 6);
      expect(p.openEnded).toBe(true);
      expect(p.radialSegments).toBeGreaterThanOrEqual(10);
      // سرِ ستون کمی باریک‌تر از پایش
      expect(p.radiusTop).toBeLessThan(p.radiusBottom);
    }
  });

  it('از کفِ پنجره تا سرِ پنجره می‌آید — نه کوتاه‌تر، نه بلندتر', () => {
    const group = buildGroup();
    for (const side of ['L', 'R'] as const) {
      const base = worldBox(group.getObjectByName(`TheaterWindowPilasterBase_0_${side}`)!, group);
      const capital = worldBox(
        group.getObjectByName(`TheaterWindowPilasterCapital_0_${side}`)!,
        group,
      );
      const shaft = worldBox(group.getObjectByName(shaftName(0, side))!, group);
      // پایه دقیقاً روی کفِ پنجره و سرستون دقیقاً زیرِ لبهٔ بالای آن
      expect(base.min.y).toBeCloseTo(WINDOW_BOTTOM_Y, 2);
      expect(capital.max.y).toBeCloseTo(WINDOW_TOP_Y, 2);
      // بدنهٔ ستون بین پایه و سرستون، بدون شکاف (حداکثر ۵ میلی‌متر)
      expect(shaft.min.y).toBeGreaterThanOrEqual(base.max.y - 0.005);
      expect(shaft.max.y).toBeLessThanOrEqual(capital.min.y + 0.005);
      expect(shaft.max.y - shaft.min.y).toBeGreaterThan(2.6);
    }
  });

  it('نیم‌ستون‌ها کنارِ پنجره‌اند (نه روی شیشه) و از دیوار بیرون زده‌اند', () => {
    const group = buildGroup(1, 0);
    const halfGlass = 1.48 / 2;
    const halfFrame = A.frameWidth / 2;
    for (const side of [-1, 1] as const) {
      const shaft = group.getObjectByName(shaftName(1, side < 0 ? 'L' : 'R'))!;
      const box = worldBox(shaft, group);
      const inner = side < 0 ? -box.max.x : box.min.x;
      const outer = side < 0 ? -box.min.x : box.max.x;
      // لبۀ داخلی هرگز به پردهٔ مخمل نمی‌رسد (وگرنه پارچه را می‌پوشاند)
      expect(inner).toBeGreaterThan(CURTAIN.curtainWidth / 2);
      // ولی آن‌قدر بیرون هم نیست که از پنجره جدا بیفتد: روی لبۀ شیشۀ سرخ
      expect(inner).toBeLessThan(halfGlass);
      // لبۀ بیرونی از لبهٔ شیشه بیرون است (کنارِ پنجره) ولی از قابِ برنجی
      // بیرون نمی‌زند، وگرنه به سرستونِ ستون‌های آزاد می‌رسید
      expect(outer).toBeGreaterThan(halfGlass);
      expect(outer).toBeLessThan(halfFrame);
      expect(outer).toBeCloseTo(A.pilasterOffset + A.radiusBottom, 6);
      // برون‌زدگی: بیش از ۱۵ سانتی‌متر جلوتر از صفحۀ نصب (جلوی قاب)
      expect(box.max.z).toBeGreaterThan(MOUNT_Z + 0.15);
      // و پشتش از صفحهٔ نصب بیرون نمی‌زند، نه اینکه در دیوار فرو رفته باشد
      expect(box.min.z).toBeLessThan(MOUNT_Z);
      expect(box.min.z).toBeGreaterThan(MOUNT_Z - 0.04);
    }
  });

  it('به ستون‌های آزادِ ورودی و سرستون‌های برنجی‌شان نمی‌خورد', () => {
    for (const windowX of CURTAIN.windowXs) {
      for (const index of [0, 1, 2]) {
        const group = buildGroup(index, windowX);
        const box = new THREE.Box3().setFromObject(group);
        for (const colX of FREE_COLUMNS) {
          // فاصلۀ افقیِ محورِ ستونِ آزاد تا پهنای گروه باید از شعاعش بیشتر باشد
          const gap = Math.max(box.min.x - colX, colX - box.max.x);
          expect(gap).toBeGreaterThan(FREE_COLUMN_RADIUS);
          // و از بلوکِ سرستونِ برنجیِ همان ستون هم دور بماند
          const capital = new THREE.Box3(
            new THREE.Vector3(colX - FREE_CAPITAL_HALF_WIDTH, 8.77, -14.68),
            new THREE.Vector3(colX + FREE_CAPITAL_HALF_WIDTH, 9.13, -13.82),
          );
          expect(box.intersectsBox(capital)).toBe(false);
        }
      }
    }
  });
});

describe('معماریِ پنجره‌های سردر — سنگِ افقیِ سایه‌بان', () => {
  it('سایبان روی سرِ هر دو نیم‌ستون می‌نشیند، نه شناور', () => {
    const group = buildGroup(2, CURTAIN.windowXs[2]);
    const awning = worldBox(group.getObjectByName('TheaterWindowAwning_2')!, group);
    for (const side of ['L', 'R'] as const) {
      const capital = worldBox(
        group.getObjectByName(`TheaterWindowPilasterCapital_2_${side}`)!,
        group,
      );
      // کفِ سایبان روی سرِ ستون‌ها (اختلافِ کمتر از ۲ سانتی‌متر، فقط درزِ نازک)
      expect(Math.abs(awning.min.y - capital.max.y)).toBeLessThan(0.02);
      // و در پهنا ستون را کامل می‌پوشاند
      expect(awning.min.x).toBeLessThanOrEqual(capital.min.x + 1e-6);
      expect(awning.max.x).toBeGreaterThanOrEqual(capital.max.x - 1e-6);
      // ستون در محدودهٔ پهنای سایبان است (سایبان دو ستون را به هم می‌بندد)
      expect(capital.min.x).toBeGreaterThanOrEqual(awning.min.x - 1e-6);
      expect(capital.max.x).toBeLessThanOrEqual(awning.max.x + 1e-6);
    }
  });

  it('سایبان از بالای قاب بیرون است و ۵۰ سانتی‌متر به سمتِ کوچه پیش می‌آید', () => {
    const group = buildGroup();
    const awning = worldBox(group.getObjectByName('TheaterWindowAwning_0')!, group);
    const lip = worldBox(group.getObjectByName('TheaterWindowAwningLip_0')!, group);
    // کاملاً بالای پنجره: هیچ‌جای سایبان زیرِ لبهٔ بالای قاب نیست
    expect(awning.min.y).toBeGreaterThan(WINDOW_TOP_Y);
    // و از قاب جلوتر است تا واقعاً روی شیشه سایه بیندازد
    expect(awning.max.z - MOUNT_Z).toBeGreaterThan(0.4);
    // لبۀ چکه زیرِ لبۀ جلویی و کمی جلوتر از آن
    expect(lip.max.z).toBeGreaterThan(awning.max.z);
    expect(lip.min.y).toBeGreaterThanOrEqual(awning.min.y - 1e-6);
    expect(lip.max.y).toBeLessThanOrEqual(awning.max.y + 1e-6);
    // ضخامتِ سایبان «سنگِ افقی» است: بین ۸ تا ۲۰ سانتی‌متر
    expect(awning.max.y - awning.min.y).toBeGreaterThan(0.08);
    expect(awning.max.y - awning.min.y).toBeLessThan(0.2);
  });

  it('سایه‌بان سایه می‌اندازد و از پنجرهٔ مجاور جدا می‌ماند', () => {
    const scene = createAlleyGeometry();
    const groups: THREE.Group[] = [];
    scene.group.traverse((obj) => {
      if (obj.name.startsWith('TheaterWindowArchitecture_')) groups.push(obj as THREE.Group);
    });
    expect(groups.length).toBe(3);

    const boxes: THREE.Box3[] = [];
    for (const g of groups) {
      g.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        expect(mesh.castShadow).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
      });
      boxes.push(new THREE.Box3().setFromObject(g));
    }
    // هیچ دو گروهی (و سایه‌بان‌هایشان) هم‌پوشانی ندارند
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(boxes[i].intersectsBox(boxes[j])).toBe(false);
      }
    }
    scene.dispose();
  });
});

describe('معماریِ پنجره‌های سردر — اتصال به نمای کوچه', () => {
  let scene: ReturnType<typeof createAlleyGeometry>;
  let facade: THREE.Group;

  beforeAll(() => {
    scene = createAlleyGeometry();
    facade = scene.group.getObjectByName('TheaterFacadeGroup') as THREE.Group;
  });

  it('سه پنجره، سه گروهِ معمارانه، دقیقاً روی محورِ پنجره‌ها', () => {
    const groups = CURTAIN.windowXs.map((wx, index) => {
      const g = facade.getObjectByName(`TheaterWindowArchitecture_${index}`) as THREE.Group;
      expect(g).toBeDefined();
      expect(g.userData.windowX).toBe(wx);
      return new THREE.Box3().setFromObject(g);
    });
    groups.forEach((box, index) => {
      const center = (box.min.x + box.max.x) / 2;
      expect(center).toBeCloseTo(CURTAIN.windowXs[index], 3);
    });
  });

  it('قابِ برنجی، نیم‌ستون‌ها و سایبان روی یک قراردادِ اندازه‌اند', () => {
    const frame = facade.getObjectByName('TheaterWindowBrassFrame_0') as THREE.Mesh<THREE.BoxGeometry>;
    expect(frame).toBeDefined();
    expect(frame.geometry.parameters.width).toBe(A.frameWidth);
    expect(frame.geometry.parameters.height).toBe(A.frameHeight);
    expect(frame.position.y).toBe(A.centerY);
    // قاب از پشتِ نیم‌ستون‌ها بیرون نمی‌زند: جلوی قاب کمتر از جلوی ستون‌ها
    const frameFront = frame.position.z + frame.geometry.parameters.depth / 2;
    const shaft = facade.getObjectByName(shaftName(0, 'L')) as THREE.Mesh;
    const shaftFront = new THREE.Box3().setFromObject(shaft).max.z;
    expect(shaftFront).toBeGreaterThan(frameFront);
  });

  it('هیچ صفحهٔ هم‌سطحی (z-fighting) با نمای سنگی، پنلِ سرخ یا قاب ساخته نشده', () => {
    const frame = facade.getObjectByName('TheaterWindowBrassFrame_0') as THREE.Mesh<THREE.BoxGeometry>;
    const frameFront = frame.position.z + frame.geometry.parameters.depth / 2;
    const frameBack = frame.position.z - frame.geometry.parameters.depth / 2;
    // صفحه‌های حساسِ موجود در نما: بدنهٔ سنگی (جلو −۱۴٫۱)، روی و پشتِ قابِ
    // برنجی و روی پنلِ سرخِ پنجره (که ۱۹ سانتی‌متر از دیوار جلوتر است)
    const criticalPlanes = [-14.1, frameFront, frameBack, -13.91];

    for (let index = 0; index < 3; index++) {
      const group = facade.getObjectByName(`TheaterWindowArchitecture_${index}`) as THREE.Group;
      const boxes: THREE.Box3[] = [];
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh<THREE.BufferGeometry>;
        if (!mesh.isMesh) return;
        const box = new THREE.Box3().setFromObject(mesh);
        boxes.push(box);
        // هیچ صفحه‌ای دقیقاً روی صفحهٔ نمای سنگی یا روی دو روی قابِ برنجی نمی‌نشیند
        for (const plane of criticalPlanes) {
          expect(Math.abs(box.min.z - plane)).toBeGreaterThan(2e-3);
          expect(Math.abs(box.max.z - plane)).toBeGreaterThan(2e-3);
        }
      });

      // دو مِشی که در صفحهٔ نما هم‌پوشانی دارند، نباید روی یک z تمام شوند
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const overlapXY =
            a.min.x < b.max.x - 1e-9 &&
            a.max.x > b.min.x + 1e-9 &&
            a.min.y < b.max.y - 1e-9 &&
            a.max.y > b.min.y + 1e-9;
          if (!overlapXY) continue;
          for (const za of [a.min.z, a.max.z]) {
            for (const zb of [b.min.z, b.max.z]) {
              expect(Math.abs(za - zb)).toBeGreaterThan(2e-3);
            }
          }
        }
      }
    }
  });

  it('سایه‌بان روی پردهٔ مخمل سایه می‌اندازد، ولی پرده را نمی‌پوشاند', () => {
    const awning = new THREE.Box3().setFromObject(
      facade.getObjectByName('TheaterWindowAwning_1') as THREE.Mesh,
    );
    const curtain = new THREE.Box3().setFromObject(
      facade.getObjectByName('TheaterCurtain_1') as THREE.Mesh,
    );
    // سایبان کامل بالای پرده است (هیچ تلاقی‌ای در ارتفاع نیست)
    expect(awning.min.y).toBeGreaterThan(curtain.max.y);
    // و از پرده جلوتر است ⇒ نورِ چراغِ کوچه به بالای پرده نمی‌رسد
    expect(awning.max.z).toBeGreaterThan(curtain.max.z);
  });
});
