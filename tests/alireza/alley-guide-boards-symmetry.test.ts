import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import {
  ALLEY_GUIDE_BOARD_FRAME_CLEARANCE,
  ALLEY_GUIDE_BOARD_SURFACE,
  ALLEY_GUIDE_BOARD_SURFACE_X,
  ALLEY_GUIDE_BOARD_WALL_GAP,
  ALLEY_GUIDE_LAMP,
  ALLEY_GUIDE_LAMP_DISTANCE,
  ALLEY_GUIDE_LAMP_X,
  ALLEY_GUIDE_WALL_INSET,
  ALLEY_GUIDE_WALL_X,
  ALLEY_ROW_CHART_LOCAL_OFFSET_X,
} from '@/engine3d/alley-guide-layout';
import { ALLEY_STATIC_OBSTACLES, checkAABBCollision } from '@/engine3d/collision';
import { DEFAULT_ALLEY_ANCHORS } from '@/engine3d/types';

/**
 * دو تابلوی راهنمای کوچه (پوستر چپ و جدول ردیف‌های راست) باید با یک فاصلهٔ
 * مساوی به دیوار بچسبند؛ پیش‌تر پوستر به دیوار چسبیده بود ولی گیشهٔ راست
 * حدود ۰٫۶۵ متر جلوتر ایستاده بود و تابلو از دیوار فاصله داشت.
 */
function worldX(mesh: THREE.Object3D): number {
  return mesh.getWorldPosition(new THREE.Vector3()).x;
}

function buildAlley() {
  const alley = createAlleyGeometry();
  alley.group.updateMatrixWorld(true);
  return alley;
}

describe('هم‌فاصله بودن دو تابلوی راهنمای کوچه از دیوار', () => {
  it('دیوارهای میانی چپ و راست همان‌هایی هستند که تابلوها رویشان نصب‌اند', () => {
    // دیوارهای ساختمان میانی با تورفتگی اعلام‌شده در ماژول چیدمان ساخته می‌شوند
    expect(ALLEY_GUIDE_WALL_X.left).toBeCloseTo(-(8.72 + ALLEY_GUIDE_WALL_INSET.left), 10);
    expect(ALLEY_GUIDE_WALL_X.right).toBeCloseTo(8.72 + ALLEY_GUIDE_WALL_INSET.right, 10);

    const alley = buildAlley();
    const wallLeft = alley.group.getObjectByName('WallLeft') as THREE.Mesh;
    const wallRight = alley.group.getObjectByName('WallRight') as THREE.Mesh;
    expect(wallLeft).toBeDefined();
    expect(wallRight).toBeDefined();

    const leftBox = new THREE.Box3().setFromObject(wallLeft);
    const rightBox = new THREE.Box3().setFromObject(wallRight);

    // نمای داخلی هر دیوار دقیقاً همان مقدار سراسری است
    expect(leftBox.max.x).toBeCloseTo(ALLEY_GUIDE_WALL_X.left, 6);
    expect(rightBox.min.x).toBeCloseTo(ALLEY_GUIDE_WALL_X.right, 6);

    alley.dispose();
  });

  it('سطح پوستر چپ و جدول ردیف‌های راست دقیقاً به یک فاصله از دیوار خودشان است', () => {
    const alley = buildAlley();
    const poster = alley.group.getObjectByName('PlaybillPosterTextMesh') as THREE.Mesh;
    const chart = alley.group.getObjectByName('RowChartBoard') as THREE.Mesh;

    const posterX = worldX(poster);
    const chartX = worldX(chart);

    const gapLeft = posterX - ALLEY_GUIDE_WALL_X.left;
    const gapRight = ALLEY_GUIDE_WALL_X.right - chartX;

    expect(gapLeft).toBeCloseTo(ALLEY_GUIDE_BOARD_WALL_GAP, 6);
    expect(gapRight).toBeCloseTo(ALLEY_GUIDE_BOARD_WALL_GAP, 6);
    expect(Math.abs(gapLeft - gapRight)).toBeLessThan(1e-6);

    // هر دو تابلو رو به داخل کوچه‌اند (روتنش‌ها به‌سمت هم)
    expect(poster.rotation.y).toBeCloseTo(Math.PI / 2, 6);
    expect(chart.rotation.y).toBeCloseTo(-Math.PI / 2, 6);

    alley.dispose();
  });

  it('قاب هر دو تابلو هم‌اندازه از دیوار بیرون زده و صفحه ۴٫۵ سانتی‌متر جلوتر از قاب است', () => {
    const alley = buildAlley();
    const playbillCase = alley.group.getObjectByName('PlaybillBoard') as THREE.Mesh;
    const boothFrame = alley.group.getObjectByName('RowChartBoardFrame') as THREE.Mesh;
    const poster = alley.group.getObjectByName('PlaybillPosterTextMesh') as THREE.Mesh;
    const chart = alley.group.getObjectByName('RowChartBoard') as THREE.Mesh;

    expect(playbillCase).toBeDefined();
    expect(boothFrame).toBeDefined();

    const caseBox = new THREE.Box3().setFromObject(playbillCase);
    const frameBox = new THREE.Box3().setFromObject(boothFrame);

    const caseProtrusion = caseBox.max.x - ALLEY_GUIDE_WALL_X.left;
    const frameProtrusion = ALLEY_GUIDE_WALL_X.right - frameBox.min.x;

    // هر دو قاب تقریباً یک اندازه (اختلاف کمتر از ۱ سانتی‌متر) از دیوار جلو آمده‌اند
    expect(Math.abs(caseProtrusion - frameProtrusion)).toBeLessThan(0.01);

    // نه ویترین چپ و نه گیشهٔ راست، هیچ شکافی پشتشان نیست؛ پشتشان داخل دیوار است
    expect(caseBox.min.x).toBeLessThan(ALLEY_GUIDE_WALL_X.left);
    expect(frameBox.max.x).toBeGreaterThan(ALLEY_GUIDE_WALL_X.right);

    // صفحهٔ هر تابلو دقیقاً به همان فاصلهٔ ثابت جلوتر از قابش نشسته است
    expect(worldX(poster) - caseBox.max.x).toBeCloseTo(ALLEY_GUIDE_BOARD_FRAME_CLEARANCE, 6);
    expect(frameBox.min.x - worldX(chart)).toBeCloseTo(ALLEY_GUIDE_BOARD_FRAME_CLEARANCE, 6);

    alley.dispose();
  });

  it('بدنهٔ هر دو تابلو یک جنس چوب تیره است — دیواره‌های سمت راست دیگر نور ندارند', () => {
    const alley = buildAlley();
    const playbillCase = alley.group.getObjectByName('PlaybillBoard') as THREE.Mesh<
      THREE.BoxGeometry,
      THREE.MeshStandardMaterial
    >;
    const boothFrame = alley.group.getObjectByName('RowChartBoardFrame') as THREE.Mesh<
      THREE.BoxGeometry,
      THREE.MeshStandardMaterial
    >;
    expect(playbillCase).toBeDefined();
    expect(boothFrame).toBeDefined();

    const left = playbillCase.material;
    const right = boothFrame.material;

    // هر دو دقیقاً همان متریال چوب تیره‌اند (نه پنل برنجی براق)
    expect(right).toBe(left);
    expect(right.color.getHex()).toBe(0x3b2618);
    // فلزیت نزدیک صفر و زبری بالا: نوری که چراغ مطالعه می‌تابد برنمی‌گردد
    expect(right.metalness).toBeLessThan(0.1);
    expect(right.roughness).toBeGreaterThan(0.6);

    // هیچ پنل برنجی/براقی دور جدول راست نمانده است
    const brassPanels: THREE.Mesh[] = [];
    alley.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material as THREE.MeshStandardMaterial;
      if (!material || !('metalness' in material)) return;
      if (material.metalness > 0.6 && object.geometry instanceof THREE.BoxGeometry) {
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        // پنل بزرگ = سطحی که رو به کوچه است و نور چراغ را برمی‌گرداند
        if (size.y > 1.5 && size.z > 2.5) brassPanels.push(object);
      }
    });
    expect(brassPanels).toHaveLength(0);

    // چهار بازوی نازک برنجی دور جدول، مثل ویترین چپ
    const trims: THREE.Mesh[] = [];
    alley.group.traverse((object) => {
      if (object.name.startsWith('RowChartBoardTrim')) trims.push(object as THREE.Mesh);
    });
    expect(trims).toHaveLength(4);

    alley.dispose();
  });

  it('سطح هر دو تابلو یک جنس و یک درخشش دارد تا هالهٔ نوری‌شان یکی باشد', () => {
    const alley = buildAlley();
    const poster = alley.group.getObjectByName('PlaybillPosterTextMesh') as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshStandardMaterial
    >;
    const chart = alley.group.getObjectByName('RowChartBoard') as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshStandardMaterial
    >;
    expect(poster.material).not.toBe(chart.material);
    for (const [label, material] of [
      ['پوستر', poster.material],
      ['جدول', chart.material],
    ] as const) {
      expect(material.emissive.getHex(), label).toBe(ALLEY_GUIDE_BOARD_SURFACE.emissive);
      expect(material.emissiveIntensity, label).toBeCloseTo(
        ALLEY_GUIDE_BOARD_SURFACE.emissiveIntensity,
        6,
      );
      expect(material.roughness, label).toBeCloseTo(ALLEY_GUIDE_BOARD_SURFACE.roughness, 6);
      expect(material.metalness, label).toBeCloseTo(ALLEY_GUIDE_BOARD_SURFACE.metalness, 6);
      expect(material.emissiveMap, label).toBe(material.map);
    }
    // هر دو سطح مات‌اند؛ هیچ‌کدام بازتاب نقطه‌ای براق نمی‌سازد
    expect(poster.material.roughness).toBeLessThan(0.7);
    expect(chart.material.roughness).toBeLessThan(0.7);

    alley.dispose();
  });

  it('چراغ‌های مطالعهٔ دو تابلو قرینه و هم‌فاصله از سطح تابلو هستند', () => {
    const alley = buildAlley();
    const playbillLamp = alley.group.getObjectByName('PlaybillReadingLight') as THREE.PointLight;
    const rowChartLamp = alley.group.getObjectByName('RowChartReadingLight') as THREE.PointLight;

    expect(playbillLamp).toBeDefined();
    expect(rowChartLamp).toBeDefined();

    const playbillDistance = playbillLamp.position.x - ALLEY_GUIDE_BOARD_SURFACE_X.playbill;
    const rowChartDistance = ALLEY_GUIDE_BOARD_SURFACE_X.rowChart - rowChartLamp.position.x;

    expect(playbillDistance).toBeCloseTo(ALLEY_GUIDE_LAMP_DISTANCE, 6);
    expect(rowChartDistance).toBeCloseTo(ALLEY_GUIDE_LAMP_DISTANCE, 6);
    expect(ALLEY_GUIDE_LAMP_X.playbill).toBeCloseTo(playbillLamp.position.x, 6);
    expect(ALLEY_GUIDE_LAMP_X.rowChart).toBeCloseTo(rowChartLamp.position.x, 6);

    // هالهٔ نوری هر دو چراغ دقیقاً یکی است: رنگ، شدت، برد و افت نور و ارتفاع
    expect(playbillLamp.color.getHex()).toBe(ALLEY_GUIDE_LAMP.color);
    expect(rowChartLamp.color.getHex()).toBe(ALLEY_GUIDE_LAMP.color);
    expect(rowChartLamp.intensity).toBe(playbillLamp.intensity);
    expect(rowChartLamp.distance).toBe(playbillLamp.distance);
    expect(rowChartLamp.decay).toBe(playbillLamp.decay);
    expect(Math.abs(rowChartLamp.position.y - playbillLamp.position.y)).toBeLessThan(1e-9);
    // هر چراغ روی z تابلوی خودش است (پیشخوان‌ها هم‌تراز نیستند)
    expect(playbillLamp.position.z).toBeCloseTo(DEFAULT_ALLEY_ANCHORS.playbill.z, 6);
    expect(rowChartLamp.position.z).toBeCloseTo(DEFAULT_ALLEY_ANCHORS.rowChart.z, 6);

    alley.dispose();
  });

  it('لنگر گیشه و صفحهٔ جدول با هم هم‌تراز می‌مانند و جای ایستادن بازیکن باز است', () => {
    // شیفت اتاقک گیشه از همین رابطه ساخته می‌شود، پس هر تغییر لنگر هم‌زمان روی
    // صفحه و قاب اثر می‌گذارد و هم‌ترازی از بین نمی‌رود.
    const expectedShift =
      ALLEY_GUIDE_BOARD_SURFACE_X.rowChart - (DEFAULT_ALLEY_ANCHORS.rowChart.x + ALLEY_ROW_CHART_LOCAL_OFFSET_X);
    expect(expectedShift).toBeGreaterThan(0.6);
    expect(expectedShift).toBeLessThan(0.7);

    // بازیکن می‌تواند تا نزدیکی هر دو تابلو بیاید و متن را بخواند
    expect(checkAABBCollision(-5.8, DEFAULT_ALLEY_ANCHORS.playbill.z, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);
    expect(checkAABBCollision(5.8, DEFAULT_ALLEY_ANCHORS.rowChart.z, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);

    // ولی داخل گیشه و ویترین نمی‌تواند برود؛ جعبه‌ها قرینهٔ هم‌اند
    expect(checkAABBCollision(7.6, DEFAULT_ALLEY_ANCHORS.rowChart.z, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(true);
    expect(checkAABBCollision(-7.6, DEFAULT_ALLEY_ANCHORS.playbill.z, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(true);

    const playbillBox = ALLEY_STATIC_OBSTACLES.find((box) => box.minZ === -3.6 && box.maxZ === -0.4);
    const boothBox = ALLEY_STATIC_OBSTACLES.find((box) => box.minZ === -3.15 && box.maxZ === 0.15);
    expect(playbillBox).toBeDefined();
    expect(boothBox).toBeDefined();
    if (!playbillBox || !boothBox) return;

    // فاصلهٔ داخلی جعبه‌ها از دیوارها هم دقیقاً یکسان است
    expect(playbillBox.maxX - ALLEY_GUIDE_WALL_X.left).toBeCloseTo(
      ALLEY_GUIDE_WALL_X.right - boothBox.minX,
      6,
    );
  });
});
