import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import {
  SOFT_STREETLIGHT,
  createLampPoolAlphaTexture,
  createLightConeAlphaTexture,
  streetlightBeamRadius,
} from '@/engine3d/alley-props';
import { alleyGroundCrownAt } from '@/engine3d/alley-ground-profile';
import { ALLEY_STATIC_OBSTACLES, checkAABBCollision } from '@/engine3d/collision';

/**
 * خواستهٔ بازبینی:
 * ۱) سه چراغ برق کوچه (دو راست، یکی چپ) حالا یک چراغ چهارم هم روی پیاده‌روی چپ،
 *    نزدیک تیر چپ و پیش از دسته‌جعبه‌های شمالی دارد.
 * ۲) ستون و سر چراغ آن کلاسیک گالوانیزه و کاملاً دایره‌ای است.
 * ۳) نور چراغ‌ها دیگر لکهٔ دایره‌ای با «خط» تیز روی سنگ‌فرش نمی‌سازد؛ پخش آن نرم
 *    و طبیعی است (penumbra کامل، زاویهٔ بازتر، رنگ ملایم‌تر).
 */

/**
 * بازتولید همان معادلهٔ سه‌جی‌اس برای افت نور نقطه‌ای داخل مخروط:
 * spotAttenuation = smoothstep(cos(angle), cos(angle * (1 - penumbra)), cos(theta))
 */
function spotAttenuation(theta: number, angle: number, penumbra: number): number {
  const coneCos = Math.cos(angle);
  const penumbraCos = Math.cos(angle * (1 - penumbra));
  const angleCos = Math.cos(theta);
  const t = Math.max(0, Math.min(1, (angleCos - coneCos) / (penumbraCos - coneCos)));
  return t * t * (3 - 2 * t);
}

function poleRoots(alley: ReturnType<typeof createAlleyGeometry>): THREE.Group[] {
  const poles: THREE.Group[] = [];
  alley.group.traverse((object) => {
    if (object.name.startsWith('UtilityPole_')) poles.push(object as THREE.Group);
  });
  return poles;
}

function geometryRadialSegments(mesh: THREE.Mesh): number {
  const parameters = (mesh.geometry as THREE.CylinderGeometry).parameters;
  return parameters?.radialSegments ?? 0;
}

describe('چراغ برق چهارم (گالوانیزهٔ دایره‌ای) و پخش نرم نور', () => {
  it('چهار چراغ برق دارد: دو سمت راست، یکی چپ چوبی و یکی چپ گالوانیزه', () => {
    const alley = createAlleyGeometry();
    const poles = poleRoots(alley);

    expect(poles).toHaveLength(4);
    expect(alley.group.getObjectByName('UtilityPole_SouthRight')).toBeDefined();
    expect(alley.group.getObjectByName('UtilityPole_MidLeftFlicker')).toBeDefined();
    expect(alley.group.getObjectByName('UtilityPole_NorthRight')).toBeDefined();

    const galvanized = alley.group.getObjectByName('UtilityPole_MidLeftGalvanized');
    expect(galvanized).toBeDefined();

    // دو تیر سمت راست و دو تیر سمت چپ
    const xs = poles.map((pole) => Math.sign(pole.position.x));
    expect(xs.filter((side) => side > 0)).toHaveLength(2);
    expect(xs.filter((side) => side < 0)).toHaveLength(2);

    // چراغ چهارم روی پیاده‌روی چپ، بین تیر چپ میانه (z=-3.8) و دسته‌جعبه‌های شمالی (z=-9.8)
    const newPole = galvanized as THREE.Group;
    expect(newPole.position.x).toBeCloseTo(-5.95, 5);
    expect(newPole.position.z).toBeLessThan(-3.8);
    expect(newPole.position.z).toBeGreaterThan(-9.8);
    // «پیش از جعبه‌ها»: دست‌کم یک متر مانده به شروع جعبه‌های شمالی (maxZ = -8.6)
    expect(newPole.position.z - -8.6).toBeGreaterThanOrEqual(1);

    alley.dispose();
  });

  it('ستون و سر چراغ چهارم کلاسیک گالوانیزه و کاملاً دایره‌ای است', () => {
    const alley = createAlleyGeometry();
    const pole = alley.group.getObjectByName('UtilityPole_MidLeftGalvanized') as THREE.Group;
    expect(pole).toBeDefined();

    // ستون: استوانهٔ کاملاً گرد با ۲۴ ضلع (نه چوبی و نه چندضلعی)
    const shaft = pole.getObjectByName('PoleShaft_MidLeftGalvanized') as THREE.Mesh<
      THREE.CylinderGeometry,
      THREE.MeshStandardMaterial
    >;
    expect(shaft).toBeDefined();
    expect(shaft.geometry.type).toBe('CylinderGeometry');
    expect(geometryRadialSegments(shaft)).toBeGreaterThanOrEqual(20);

    // گالوانیزه: خاکستری فلزی با زبری متوسط (نه آینه و نه چوب)
    expect(shaft.material.metalness).toBeGreaterThanOrEqual(0.6);
    expect(shaft.material.roughness).toBeGreaterThanOrEqual(0.35);
    expect(shaft.material.roughness).toBeLessThanOrEqual(0.6);
    // خاکستری خنثی گالوانیزه (مؤلفهٔ آبی و قرمز تقریباً برابر) — نه چوب قهوه‌ای
    expect(shaft.material.color.getHex()).toBe(0x9ba1a4);
    const srgb = shaft.material.color.clone().convertLinearToSRGB();
    expect(Math.abs(srgb.r - srgb.b)).toBeLessThan(0.12);

    // سر چراغ گرد: کلاهک کره‌ای + حلقهٔ گرد لبه + گوی شیشه‌ای
    const hood = pole.getObjectByName('LampHood_MidLeftGalvanized') as THREE.Mesh;
    const globe = pole.getObjectByName('LampBulb_MidLeftGalvanized') as THREE.Mesh;
    expect(hood).toBeDefined();
    expect(globe).toBeDefined();
    expect(hood.geometry.type).toBe('SphereGeometry');
    expect(globe.geometry.type).toBe('SphereGeometry');

    // هیچ تراورس چوبی یا مقرهٔ چینی روی تیر گالوانیزه نیست
    const boxCount = (() => {
      let count = 0;
      pole.traverse((object) => {
        if (object instanceof THREE.Mesh && object.geometry.type === 'BoxGeometry') count++;
      });
      return count;
    })();
    const cylinderCount = (() => {
      let count = 0;
      pole.traverse((object) => {
        if (object instanceof THREE.Mesh && object.geometry.type === 'CylinderGeometry') count++;
      });
      return count;
    })();
    expect(boxCount).toBe(0);
    // پایه، فلنج، پیچ‌ها، ستون، بست، بازو و حلقه‌ها همه استوانه/حلقه‌اند
    expect(cylinderCount).toBeGreaterThanOrEqual(8);

    alley.dispose();
  });

  it('نور چراغ‌ها دیگر لبهٔ تیز ندارد: penumbra کامل و زاویهٔ باز', () => {
    const alley = createAlleyGeometry();

    for (const pole of poleRoots(alley)) {
      const id = pole.name.replace('UtilityPole_', '');
      const spot = pole.getObjectByName(`PoleSpotLight_${id}`) as THREE.SpotLight;
      expect(spot, id).toBeDefined();

      // لبهٔ مخروط کاملاً محو — روشنایی از مرکز تا لبه پیوسته کم می‌شود
      expect(spot.penumbra).toBe(1);
      expect(spot.angle).toBeCloseTo(SOFT_STREETLIGHT.angle, 6);
      // زاویهٔ پخش باز: استخر نور حدود ۴٬۵ متر شعاع دارد، نه یک نقطهٔ باریک
      expect((spot.angle * 180) / Math.PI).toBeGreaterThanOrEqual(40);
      // رنگ ملایم و کم‌اشباع
      expect(spot.color.getHex()).toBe(SOFT_STREETLIGHT.color);
      expect(spot.decay).toBeCloseTo(SOFT_STREETLIGHT.decay, 6);
    }

    alley.dispose();
  });

  it('شدت نور روی زمین به‌جای سکوی ثابت، پیوسته و نرم افت می‌کند', () => {
    const angle = SOFT_STREETLIGHT.angle;
    const samples = [0, 0.25, 0.5, 0.75, 0.95, 1].map((ratio) =>
      spotAttenuation(angle * ratio, angle, SOFT_STREETLIGHT.penumbra),
    );

    // مرکز روشن‌ترین، لبه صفر
    expect(samples[0]).toBeCloseTo(1, 6);
    expect(samples[samples.length - 1]).toBeCloseTo(0, 6);

    // افت یکنوا بدون سکو
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThan(samples[i - 1]);
    }

    // رفتار قدیمی (penumbra ۰٫۶۸) تا ۳۲٪ شعاع، سکوی روشنایی کامل و ثابت داشت
    // و بعد یک‌دفعه می‌افتاد؛ همان چیزی که «خط نور» مصنوعی می‌ساخت.
    const oldAtPlatform = spotAttenuation(angle * 0.3, angle, 0.68);
    expect(oldAtPlatform).toBeCloseTo(1, 3);
    // پروفایل تازه از همان ابتدا افت می‌کند؛ هیچ سکوی ثابتی ندارد
    expect(samples[1]).toBeLessThan(oldAtPlatform - 0.005);

    // لبهٔ مخروط به‌جای بریده‌شدن، با شیب صفر به صفر می‌رسد (هیچ خطی نمی‌ماند)
    const nearEdge = [0.98, 0.99, 1].map((ratio) => spotAttenuation(angle * ratio, angle, 1));
    expect(nearEdge[0]).toBeLessThan(0.01);
    expect(nearEdge[2]).toBeCloseTo(0, 6);
    expect(Math.abs(nearEdge[0] - nearEdge[2])).toBeLessThan(0.01);
  });

  it('گسترهٔ استخر نور باز و طبیعی است و پخش مه از خود نور باریک‌تر', () => {
    const poolRadius = streetlightBeamRadius(4.66);
    // شعاع استخر نور چند متر است (نه یک نقطهٔ باریک زیر چراغ)
    expect(poolRadius).toBeGreaterThan(4);
    expect(poolRadius).toBeLessThan(9);

    const alley = createAlleyGeometry();
    const pole = alley.group.getObjectByName('UtilityPole_MidLeftGalvanized') as THREE.Group;
    const beam = pole.getObjectByName('LampVolumetricBeam_MidLeftGalvanized') as THREE.Mesh<
      THREE.ConeGeometry
    >;
    expect(beam).toBeDefined();
    // مخروط مه از گسترهٔ واقعی نور باریک‌تر است و با ۳۲ ضلع گرد می‌شود
    expect(beam.geometry.parameters.radius).toBeLessThan(poolRadius);
    expect(beam.geometry.parameters.radialSegments).toBeGreaterThanOrEqual(24);

    alley.dispose();
  });

  it('پروفایل ارتفاعی پرتو مه در دو سر صفر است و در میانه نرم اوج می‌گیرد', () => {
    const texture = createLightConeAlphaTexture(64);
    const data = texture.image.data as Uint8Array;
    const size = 64;
    const alphaAt = (row: number) => data[(row * size + 4) * 4 + 3];

    expect(alphaAt(0)).toBe(0);
    expect(alphaAt(size - 1)).toBe(0);

    const peak = Math.max(...Array.from({ length: size }, (_, row) => alphaAt(row)));
    expect(peak).toBeGreaterThan(150);

    // بدون پرش: اختلاف دو سطر مجاور کوچک است (لبهٔ تیز وجود ندارد)
    for (let row = 1; row < size; row++) {
      expect(Math.abs(alphaAt(row) - alphaAt(row - 1))).toBeLessThanOrEqual(40);
    }

    texture.dispose();
  });


  it('هر چراغ یک هالهٔ نورِ نرم و آلی روی سنگ‌فرش دارد که مرز هندسی مخروط را می‌پوشاند', () => {
    const alley = createAlleyGeometry();
    const pools: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
    alley.group.traverse((object) => {
      if (object.name.startsWith('LampGroundPool_')) {
        pools.push(object as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>);
      }
    });

    expect(pools).toHaveLength(4);
    for (const pool of pools) {
      // نور اضافه و شفاف، بدون نوشتن در عمق (روی سنگ‌فرش می‌نشیند نه داخلش)
      expect(pool.material.blending).toBe(THREE.AdditiveBlending);
      expect(pool.material.transparent).toBe(true);
      expect(pool.material.depthWrite).toBe(false);
      expect(pool.material.alphaMap).not.toBeNull();
      // ملایم و کم‌رنگ — یک لکهٔ نور، نه یک دیسک روشن
      expect(pool.material.opacity).toBeLessThanOrEqual(0.2);
      expect(pool.material.opacity).toBeGreaterThan(0.05);
    }

    alley.dispose();
  });

  it('هالهٔ نور روی تاج ملایم کف می‌خوابد و ذره‌ای شناور نیست', () => {
    const alley = createAlleyGeometry();
    const pool = alley.group.getObjectByName('LampGroundPool_MidLeftGalvanized') as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshBasicMaterial
    >;
    expect(pool).toBeDefined();
    alley.group.updateMatrixWorld(true);

    const positions = pool.geometry.attributes.position as THREE.BufferAttribute;
    const poolCenterX = -5.95 + pool.position.x;

    // پایین‌ترین و بالاترین نقطهٔ هاله، هر دو فقط چند میلی‌متر بالای کف همان نقطه‌اند
    for (const index of [0, Math.floor(positions.count / 2), positions.count - 1]) {
      const localX = positions.getX(index);
      const crown = alleyGroundCrownAt(poolCenterX + localX);
      expect(positions.getZ(index) - crown).toBeCloseTo(0.008, 5);
    }

    // کل هاله در محدودهٔ ارتفاع تاج کف است (نه چسبیده به آسمان و نه زیر زمین)
    const box = new THREE.Box3().setFromObject(pool);
    expect(box.min.y).toBeGreaterThan(0);
    expect(box.max.y).toBeLessThan(alleyGroundCrownAt(0) + 0.02);

    alley.dispose();
  });

  it('ماسک هالهٔ نور از مرکز روشن به لبهٔ کاملاً محو و نامنظم می‌رسد', () => {
    const texture = createLampPoolAlphaTexture(71, 128);
    const data = texture.image.data as Uint8Array;
    const size = 128;
    const alphaAt = (px: number, py: number) => data[(py * size + px) * 4] / 255;

    // مرکز روشن‌ترین و گوشه‌ها کاملاً خشک/تاریک
    expect(alphaAt(size / 2, size / 2)).toBeGreaterThan(0.95);
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(size - 1, 0)).toBe(0);
    expect(alphaAt(0, size - 1)).toBe(0);

    // بدون پرش در طول شعاع
    let previous = alphaAt(size / 2, size / 2);
    for (let step = 1; step < size / 2; step++) {
      const value = alphaAt(size / 2, size / 2 + step);
      expect(previous - value).toBeLessThanOrEqual(0.09);
      previous = value;
    }

    // لبهٔ آلی: آلفا روی یک دایرهٔ ثابت یکنواخت نیست (دایرهٔ ماشینی نیست)
    const ringRadius = Math.floor(size * 0.38);
    const ringSamples: number[] = [];
    for (let angle = 0; angle < 16; angle++) {
      const theta = (angle / 16) * Math.PI * 2;
      const px = Math.round(size / 2 + Math.cos(theta) * ringRadius);
      const py = Math.round(size / 2 + Math.sin(theta) * ringRadius);
      ringSamples.push(alphaAt(px, py));
    }
    expect(Math.max(...ringSamples) - Math.min(...ringSamples)).toBeGreaterThan(0.05);

    texture.dispose();
  });

  it('نور هاله با سوسوزدن چراغ هم‌گام می‌شود', () => {
    const alley = createAlleyGeometry();
    const pool = alley.group.getObjectByName('LampGroundPool_MidLeftFlicker') as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshBasicMaterial
    >;
    expect(pool).toBeDefined();

    const samples = new Set<string>();
    for (let i = 0; i < 60; i++) {
      alley.update(0.05, i * 0.13);
      samples.add(pool.material.opacity.toFixed(3));
    }
    expect(samples.size).toBeGreaterThan(2);

    alley.dispose();
  });

  it('پایهٔ چراغ چهارم مانع عبور است و مسیر بازیکن و اسپاون‌ها باز می‌مانند', () => {
    // داخل پایه برخورد دارد
    expect(checkAABBCollision(-5.95, -7.0, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(true);
    // ولی وسط کوچه و جلوی جعبه‌ها آزاد است
    expect(checkAABBCollision(-4.6, -7.0, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);
    expect(checkAABBCollision(0, -7.0, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);
  });
});
