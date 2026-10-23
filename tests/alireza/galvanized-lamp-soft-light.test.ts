import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import {
  BEAM_SHAFT_GROUND_RADIUS,
  BEAM_SHAFT_LAYERS,
  BEAM_SHAFT_PUFF_OPACITY,
  SOFT_STREETLIGHT,
  beamShaftEnvelope,
  createLampHaloAlphaTexture,
  createLampPoolAlphaTexture,
  streetlightBeamRadius,
} from '@/engine3d/alley-props';
import { alleyGroundCrownAt } from '@/engine3d/alley-ground-profile';
import { ALLEY_STATIC_OBSTACLES, checkAABBCollision } from '@/engine3d/collision';

/**
 * خواستهٔ بازبینی:
 * ۱) همهٔ چراغ‌های برق کوچه کلاسیک گالوانیزهٔ دایره‌ای‌اند و دقیقاً یک شکل و
 *    یک اندازه‌اند (تیرهای چوبی قبلی هم به همین سبک تبدیل شدند). با دوبرابر
 *    شدنِ کوچه و افزودنِ فرعیِ L‌شکل، دو جفتِ هم‌شکلِ دیگر (جفتِ امتدادِ جنوبی
 *    و جفتِ فرعی) هم اضافه شد؛ پیش‌تر دقیقاً چهار تیر بودند.
 * ۲) چراغ‌ها در دو جفت رو‌به‌روی هم نشسته‌اند: جفت جنوبی و جفت شمالی، هر جفت
 *    روی یک خط z با فاصلهٔ مساوی از محور کوچه و بازو به سمت مرکز.
 * ۳) نور چراغ‌ها لکهٔ دایره‌ای با «خط» تیز روی سنگ‌فرش نمی‌سازد؛ پخش آن نرم
 *    و طبیعی است (penumbra کامل، زاویهٔ باز، رنگ ملایم‌تر و هالهٔ آلی روی زمین).
 * ۴) خودِ پرتو مه هم نباید «نوار» داشته باشد: مخروط با سطح هندسی (که سایه‌روی
 *    صافش «خط کنار نور» می‌شد) کنار رفته و جایش را چند پفِ نرمِ رو‌به‌دوربین
 *    گرفته که جمع اضافه‌شونده‌شان یک هالهٔ حجمیِ بی‌مرز می‌سازد. پخش روی زمین
 *    دنبالهٔ پهن و ملایم دارد و دور سر چراغ یک هالهٔ گردِ دو‌لایهٔ محو می‌درخشد.
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

/**
 * شناسهٔ همهٔ تیرها: چهار تیرِ کوچهٔ اصلی + جفتِ امتدادِ جنوبی + تیرِ فرعی.
 * تیرِ شمالیِ فرعی (`BranchNorth`) که دقیقاً جلوی درِ تماشاخانه بود، به درخواستِ
 * امیر حذف شد؛ پس فرعی فقط یک تیر دارد و جفتِ رو‌به‌رو ندارد.
 */
const ALL_POLE_IDS = [
  'SouthLeft',
  'SouthRight',
  'NorthLeft',
  'NorthRight',
  'FarSouthLeft',
  'FarSouthRight',
  'BranchSouth',
] as const;

/** جفت‌های رو‌به‌روی هم در شاخهٔ اصلی: هر دو روی یک خط z */
const POLE_PAIRS: ReadonlyArray<[string, string]> = [
  ['SouthLeft', 'SouthRight'],
  ['NorthLeft', 'NorthRight'],
  ['FarSouthLeft', 'FarSouthRight'],
];

describe('چراغ برق گالوانیزهٔ دایره‌ای و پخش نرم نور', () => {
  it('همهٔ چراغ‌های برق یک شکل و گالوانیزه‌اند — هیچ تیر چوبی نمانده', () => {
    const alley = createAlleyGeometry();
    const poles = poleRoots(alley);

    expect(poles).toHaveLength(ALL_POLE_IDS.length);
    for (const id of ALL_POLE_IDS) {
      expect(alley.group.getObjectByName(`UtilityPole_${id}`), id).toBeDefined();
    }

    // هیچ تیر چوبی/چدنی قدیمی (با تراورس جعبه‌ای و مقرهٔ چینی) نمانده است
    for (const oldId of ['MidLeftFlicker', 'MidLeftGalvanized']) {
      expect(alley.group.getObjectByName(`UtilityPole_${oldId}`)).toBeUndefined();
    }

    // ترکیب هندسی هر چهار چراغ باید دقیقاً یکسان باشد (هم‌شکل و هم‌اندازه)
    const signatures = poles.map((pole) => {
      const counts: Record<string, number> = {};
      pole.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          counts[object.geometry.type] = (counts[object.geometry.type] ?? 0) + 1;
        }
      });
      return JSON.stringify(counts, Object.keys(counts).sort());
    });
    expect(new Set(signatures).size).toBe(1);

    for (const pole of poles) {
      const id = pole.name.replace('UtilityPole_', '');
      const shaft = pole.getObjectByName(`PoleShaft_${id}`) as THREE.Mesh<
        THREE.CylinderGeometry,
        THREE.MeshStandardMaterial
      >;
      const hood = pole.getObjectByName(`LampHood_${id}`) as THREE.Mesh;
      const globe = pole.getObjectByName(`LampBulb_${id}`) as THREE.Mesh;
      const arm = pole.getObjectByName(`LampArm_${id}`) as THREE.Mesh;

      // ستون کاملاً گرد گالوانیزه
      expect(shaft.geometry.type).toBe('CylinderGeometry');
      expect(geometryRadialSegments(shaft)).toBeGreaterThanOrEqual(20);
      expect(shaft.material.metalness).toBeGreaterThanOrEqual(0.6);
      expect(shaft.material.roughness).toBeGreaterThanOrEqual(0.35);
      expect(shaft.material.roughness).toBeLessThanOrEqual(0.6);
      expect(shaft.material.color.getHex()).toBe(0x9ba1a4);

      // سر چراغ گرد کلاسیک + بازوی لوله‌ای منحنی
      expect(hood.geometry.type).toBe('SphereGeometry');
      expect(globe.geometry.type).toBe('SphereGeometry');
      expect(arm.geometry.type).toBe('TubeGeometry');

      // هیچ وجه جعبه‌ای (تراورس چوبی/جعبهٔ تقسیم قدیمی) روی تیر نیست
      let boxes = 0;
      pole.traverse((object) => {
        if (object instanceof THREE.Mesh && object.geometry.type === 'BoxGeometry') boxes++;
      });
      expect(boxes).toBe(0);
    }

    alley.dispose();
  });

  it('چراغ‌ها جفت‌های رو‌به‌روی هم‌اند: هم‌تراز و آینهٔ دقیق هم', () => {
    const alley = createAlleyGeometry();
    alley.group.updateMatrixWorld(true);

    for (const [leftId, rightId] of POLE_PAIRS) {
      const left = alley.group.getObjectByName(`UtilityPole_${leftId}`) as THREE.Group;
      const right = alley.group.getObjectByName(`UtilityPole_${rightId}`) as THREE.Group;
      expect(left, leftId).toBeDefined();
      expect(right, rightId).toBeDefined();

      // جفت‌های شاخهٔ اصلی روی یک خط z و قرینهٔ هم حول محور کوچه‌اند
      const leftWorld = new THREE.Vector3();
      const rightWorld = new THREE.Vector3();
      left.getWorldPosition(leftWorld);
      right.getWorldPosition(rightWorld);
      expect(left.position.z).toBeCloseTo(right.position.z, 6);
      expect(left.position.x).toBeCloseTo(-right.position.x, 6);
      expect(left.position.x).toBeLessThan(0);
      expect(right.position.x).toBeGreaterThan(0);

      // سر چراغ هر دو به سمت مرکز راهرو است، پس دقیقاً رو‌به‌روی هم‌اند
      const leftGlobe = left.getObjectByName(`LampBulb_${leftId}`) as THREE.Mesh;
      const rightGlobe = right.getObjectByName(`LampBulb_${rightId}`) as THREE.Mesh;
      const leftLamp = new THREE.Vector3();
      const rightLamp = new THREE.Vector3();
      leftGlobe.getWorldPosition(leftLamp);
      rightGlobe.getWorldPosition(rightLamp);
      expect(leftLamp.x).toBeGreaterThan(leftWorld.x); // به سمت داخل
      expect(rightLamp.x).toBeLessThan(rightWorld.x);
      expect(leftLamp.x).toBeCloseTo(-rightLamp.x, 6);
      expect(leftLamp.z).toBeCloseTo(rightLamp.z, 6);

      // ارتفاع سر چراغ و شدت نور هر دو یکسان است
      expect(leftGlobe.position.y).toBeCloseTo(rightGlobe.position.y, 6);
      const leftSpot = left.getObjectByName(`PoleSpotLight_${leftId}`) as THREE.SpotLight;
      const rightSpot = right.getObjectByName(`PoleSpotLight_${rightId}`) as THREE.SpotLight;
      expect(leftSpot.intensity).toBeCloseTo(rightSpot.intensity, 6);
    }

    // جفت جنوبی، شمالی و امتدادِ جنوبی هر سه وجود دارند و از هم فاصله دارند
    const south = alley.group.getObjectByName('UtilityPole_SouthLeft') as THREE.Group;
    const north = alley.group.getObjectByName('UtilityPole_NorthLeft') as THREE.Group;
    const farSouth = alley.group.getObjectByName('UtilityPole_FarSouthLeft') as THREE.Group;
    expect(Math.abs(south.position.z - north.position.z)).toBeGreaterThan(5);
    expect(farSouth.position.z).toBeGreaterThan(south.position.z + 10);

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

  it('گسترهٔ استخر نور باز است و شفت مه از خودِ نور بیرون نمی‌زند', () => {
    const poolRadius = streetlightBeamRadius(4.66);
    // شعاع استخر نور چند متر است (نه یک نقطهٔ باریک زیر چراغ)
    expect(poolRadius).toBeGreaterThan(4);
    expect(poolRadius).toBeLessThan(9);
    // شفت مه از گسترهٔ واقعی نور باریک‌تر است تا لبهٔ آن جایی دیده نشود
    expect(BEAM_SHAFT_GROUND_RADIUS).toBeLessThan(poolRadius);

    const alley = createAlleyGeometry();
    const pole = alley.group.getObjectByName('UtilityPole_NorthLeft') as THREE.Group;
    // هیچ مخروطی زیر چراغ نمانده — همان سطحی که «خط کنار نور» می‌ساخت
    pole.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      expect(object.geometry.type).not.toBe('ConeGeometry');
    });

    alley.dispose();
  });

  it('شفت مه از پف‌های نرمِ رو‌به‌دوربین ساخته می‌شود، نه از یک سطح با لبهٔ صاف', () => {
    const alley = createAlleyGeometry();
    const pole = alley.group.getObjectByName('UtilityPole_NorthLeft') as THREE.Group;
    const shaft = pole.getObjectByName('LampVolumetricBeam_NorthLeft') as THREE.Group;
    expect(shaft).toBeInstanceOf(THREE.Group);
    // خودِ شفت هیچ هندسه‌ای ندارد؛ فقط اسپرایت‌های نرم دارد
    expect((shaft as unknown as THREE.Mesh).geometry).toBeUndefined();

    const puffs: THREE.Sprite[] = [];
    shaft.traverse((object) => {
      if (object instanceof THREE.Sprite) puffs.push(object);
    });
    expect(puffs.length).toBeGreaterThanOrEqual(4);
    expect(puffs.length).toBeLessThanOrEqual(BEAM_SHAFT_LAYERS);

    for (const puff of puffs) {
      const material = puff.material as THREE.SpriteMaterial;
      // هر پف یک گرادیان شعاعی محو است: بدون بافت هیچ لبه‌ای نرم نمی‌شد
      expect(material.map).not.toBeNull();
      expect(material.blending).toBe(THREE.AdditiveBlending);
      expect(material.transparent).toBe(true);
      expect(material.depthWrite).toBe(false);
      // کم‌رنگ، چون چند پف روی هم جمع می‌شوند
      expect(material.opacity).toBeGreaterThan(0);
      expect(material.opacity).toBeLessThanOrEqual(BEAM_SHAFT_PUFF_OPACITY);
      // پف‌ها به هم می‌رسند (پوشش پیوسته) نه اینکه مثل توپ‌های جدا دیده شوند
      expect(puff.scale.x).toBeGreaterThan(0.8);
    }

    // چیدمان: پایین پهن‌تر، بالا باریک‌تر (شکل مخروط نور، بدون سطح مخروط)
    const sorted = [...puffs].sort((a, b) => a.position.y - b.position.y);
    expect(sorted[0].scale.x).toBeGreaterThan(sorted[sorted.length - 1].scale.x);
    // و ارتفاع‌ها یکنواخت بین زمین و سر چراغ پخش شده‌اند
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].position.y).toBeGreaterThan(sorted[i - 1].position.y);
      // پف‌های همسایه بیشتر از نصف اندازه‌شان روی هم می‌افتند؛ بدون این هم‌پوشانی
      // شفت به‌شکل چند توپ جدا دیده می‌شد (لبهٔ تازه، همان چیزی که نمی‌خواهیم)
      const dy = sorted[i].position.y - sorted[i - 1].position.y;
      expect(dy).toBeLessThan(Math.min(sorted[i].scale.x, sorted[i - 1].scale.x) / 2);
    }

    // روشنایی کل شفت ملایم است: جمع آلفای پف‌ها زیر ۰٫۲۵ می‌ماند
    const total = puffs.reduce((sum, puff) => sum + (puff.material as THREE.SpriteMaterial).opacity, 0);
    expect(total).toBeLessThan(0.25);

    alley.dispose();
  });

  it('هر چراغ یک هالهٔ گردِ دو‌لایه دور گوی دارد و با سوسوزدن هم‌گام می‌شود', () => {
    const alley = createAlleyGeometry();

    for (const id of ['SouthLeft', 'SouthRight', 'NorthLeft', 'NorthRight']) {
      const pole = alley.group.getObjectByName(`UtilityPole_${id}`) as THREE.Group;
      const bulb = pole.getObjectByName(`LampBulb_${id}`) as THREE.Mesh;
      for (const [prefix, maxOpacity] of [
        ['LampHalo_', 0.2],
        ['LampHaloCore_', 0.32],
      ] as const) {
        const halo = pole.getObjectByName(`${prefix}${id}`) as THREE.Sprite;
        expect(halo, `${prefix}${id}`).toBeInstanceOf(THREE.Sprite);
        const material = halo.material as THREE.SpriteMaterial;
        expect(material.map).not.toBeNull();
        expect(material.blending).toBe(THREE.AdditiveBlending);
        expect(material.depthWrite).toBe(false);
        expect(material.opacity).toBeGreaterThan(0);
        expect(material.opacity).toBeLessThanOrEqual(maxOpacity);
        // هاله دقیقاً دور گوی شیشه‌ای می‌نشیند، نه جای دیگر
        expect(halo.position.x).toBeCloseTo(bulb.position.x, 6);
        expect(halo.position.y).toBeCloseTo(bulb.position.y, 6);
        expect(halo.position.z).toBeCloseTo(bulb.position.z, 6);
      }
    }

    // هستهٔ هاله کوچک‌تر ولی روشن‌تر از لایهٔ پهن است
    const pole = alley.group.getObjectByName('UtilityPole_NorthLeft') as THREE.Group;
    const wide = pole.getObjectByName('LampHalo_NorthLeft') as THREE.Sprite;
    const core = pole.getObjectByName('LampHaloCore_NorthLeft') as THREE.Sprite;
    expect(core.scale.x).toBeLessThan(wide.scale.x);
    expect((core.material as THREE.SpriteMaterial).opacity).toBeGreaterThan(
      (wide.material as THREE.SpriteMaterial).opacity,
    );

    // سوسوزدن چراغ باید هاله را هم کم‌رنگ/پرت‌رنگ کند
    const samples = new Set<string>();
    for (let i = 0; i < 60; i++) {
      alley.update(0.05, i * 0.13);
      samples.add((wide.material as THREE.SpriteMaterial).opacity.toFixed(3));
    }
    expect(samples.size).toBeGreaterThan(2);

    alley.dispose();
  });

  it('پوشش ارتفاعی شفت در دو سر صفر است و بدون پرش در میانه اوج می‌گیرد', () => {
    expect(beamShaftEnvelope(0)).toBe(0);
    expect(beamShaftEnvelope(1)).toBe(0);

    const samples = Array.from({ length: 41 }, (_, i) => beamShaftEnvelope(i / 40));
    expect(Math.max(...samples)).toBeGreaterThan(0.85);

    // بدون پرش: اختلاف دو نمونهٔ مجاور کوچک است (لبهٔ تیز وجود ندارد)
    for (let i = 1; i < samples.length; i++) {
      expect(Math.abs(samples[i] - samples[i - 1])).toBeLessThan(0.12);
    }
  });

  it('هر چراغ یک هالهٔ نورِ نرم و آلی روی سنگ‌فرش دارد که مرز هندسی مخروط را می‌پوشاند', () => {
    const alley = createAlleyGeometry();
    const pools: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
    alley.group.traverse((object) => {
      if (object.name.startsWith('LampGroundPool_')) {
        pools.push(object as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>);
      }
    });

    expect(pools).toHaveLength(ALL_POLE_IDS.length);
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
    const pool = alley.group.getObjectByName('LampGroundPool_NorthLeft') as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshBasicMaterial
    >;
    expect(pool).toBeDefined();
    alley.group.updateMatrixWorld(true);

    const positions = pool.geometry.attributes.position as THREE.BufferAttribute;
    const poleX = (alley.group.getObjectByName('UtilityPole_NorthLeft') as THREE.Group).position.x;
    const poolCenterX = poleX + pool.position.x;

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

    // پخش ملایم و پهن: نور با یک دنبالهٔ کم‌رنگ تا نزدیک لبه ادامه دارد و
    // یک‌دفعه تمام نمی‌شود (وگرنه لبه‌اش مثل یک حلقه خوانده می‌شد)
    const atRadius = (ratio: number) =>
      alphaAt(Math.round(size / 2 + (size / 2) * ratio), size / 2);
    expect(atRadius(0.45)).toBeGreaterThan(0.15);
    expect(atRadius(0.75)).toBeGreaterThan(0.02);
    expect(atRadius(0.75)).toBeLessThan(0.2);

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

  it('ماسک هالهٔ گرد از مرکز روشن به لبهٔ صفر می‌رسد و هیچ پله‌ای ندارد', () => {
    const texture = createLampHaloAlphaTexture(311, 128);
    const data = texture.image.data as Uint8Array;
    const size = 128;
    const alphaAt = (px: number, py: number) => data[(py * size + px) * 4] / 255;

    // مرکز روشن‌ترین نقطه و گوشه‌ها کاملاً محو
    expect(alphaAt(size / 2, size / 2)).toBeGreaterThan(0.95);
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(size - 1, size - 1)).toBe(0);

    // افت پیوسته از مرکز به بیرون، بدون پرش: لبهٔ نرم، نه یک دیسک تخت
    let previous = alphaAt(size / 2, size / 2);
    for (let step = 1; step < size / 2; step++) {
      const value = alphaAt(size / 2, size / 2 + step);
      expect(previous - value).toBeLessThanOrEqual(0.06);
      expect(value).toBeLessThanOrEqual(previous + 0.02);
      previous = value;
    }

    // میانهٔ هاله هنوز نور دارد: پخش ملایم و پهن، نه یک نقطهٔ کوچک و تیز
    const radius = (ratio: number) => Math.round((size / 2) * ratio);
    expect(alphaAt(size / 2, size / 2 + radius(0.25))).toBeGreaterThan(0.3);
    expect(alphaAt(size / 2, size / 2 + radius(0.6))).toBeGreaterThan(0.1);

    texture.dispose();
  });

  it('نور هاله با سوسوزدن چراغ هم‌گام می‌شود', () => {
    const alley = createAlleyGeometry();
    const pool = alley.group.getObjectByName('LampGroundPool_NorthRight') as THREE.Mesh<
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

  it('پایهٔ هر چهار چراغ مانع عبور است ولی مسیر کوچه و اسپاون‌ها باز می‌ماند', () => {
    // داخل هر چهار پایه برخورد دارد (قرینهٔ کامل)
    for (const [x, z] of [
      [-5.95, 3.6],
      [5.95, 3.6],
      [-5.95, -7.0],
      [5.95, -7.0],
    ]) {
      expect(checkAABBCollision(x, z, 0.35, ALLEY_STATIC_OBSTACLES), `${x},${z}`).toBe(true);
    }

    // وسط کوچه روی همان دو خط و جلوی جعبه‌ها آزاد است
    for (const z of [3.6, -7.0]) {
      expect(checkAABBCollision(0, z, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);
      expect(checkAABBCollision(-4.6, z, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);
      expect(checkAABBCollision(4.6, z, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);
    }

    // جای پایه‌های قدیمی حالا باز است (هیچ مانع باقی‌مانده‌ای نمانده)
    expect(checkAABBCollision(-5.95, -3.8, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);
    expect(checkAABBCollision(5.95, -10.2, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);

    // جای ایستادن رو‌به‌روی تابلوهای راهنما همچنان باز است
    expect(checkAABBCollision(-5.8, -2, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);
    expect(checkAABBCollision(5.8, -1.5, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);
  });
});
