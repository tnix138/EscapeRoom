import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import {
  createBrickWallMaps,
  createCobblestoneMaps,
  createFlagstoneMaps,
  createPuddleDampRingAlphaMap,
} from '@/engine3d/alley-materials';

/**
 * خواستهٔ بازبینی: کف کوچه خشک است و فقط جای آبِ جمع‌شده و کمی اطرافش خیس است؛
 * دیوارها هم مات‌اند و فقط بوی نم می‌دهند، نه برق. پیش‌تر نقشهٔ زبری سنگ‌فرش تا
 * ۰٫۱۲ پایین می‌رفت، جوی‌های کنار جدول با roughness ۰٫۰۸ آینه بودند و
 * envMapIntensity ۰٫۹۵ کف را مثل سطح خیس براق می‌کرد.
 */

function roughnessStats(texture: THREE.Texture | null | undefined) {
  expect(texture).toBeDefined();
  const data = (texture as THREE.DataTexture).image.data as Uint8Array;
  let min = 1;
  let max = 0;
  let sum = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] / 255;
    min = Math.min(min, value);
    max = Math.max(max, value);
    sum += value;
  }
  return { min, max, mean: sum / pixels };
}

function alphaStats(texture: THREE.Texture) {
  const data = (texture as THREE.DataTexture).image.data as Uint8Array;
  let min = 1;
  let max = 0;
  let sum = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] / 255;
    min = Math.min(min, value);
    max = Math.max(max, value);
    sum += value;
  }
  return { min, max, mean: sum / pixels };
}

function materialOf(alley: ReturnType<typeof createAlleyGeometry>, name: string): THREE.MeshStandardMaterial {
  const mesh = alley.group.getObjectByName(name) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  expect(mesh, `مش «${name}» پیدا نشد`).toBeDefined();
  return mesh.material;
}

describe('کف خشک و دیوارهای ماتِ کوچه (بازبینی طبیعی‌بودن سطح‌ها)', () => {
  it('نقشهٔ زبری سنگ‌فرش و پیاده‌رو تقریباً همه‌جا بالای ۰٫۸ است (سطح مات)', () => {
    const cobble = createCobblestoneMaps(5, 13, 128);
    const flagstone = createFlagstoneMaps(2, 16, 128);

    const cobbleRough = roughnessStats(cobble.roughnessMap);
    const flagRough = roughnessStats(flagstone.roughnessMap);

    // هیچ پیکسلی زیر ۰٫۸ نیست؛ میانگین هم نزدیک ۰٫۹ است (پیش‌تر تا ۰٫۱۲ می‌رفت)
    expect(cobbleRough.min).toBeGreaterThanOrEqual(0.8);
    expect(cobbleRough.mean).toBeGreaterThan(0.85);
    expect(flagRough.min).toBeGreaterThanOrEqual(0.8);
    expect(flagRough.mean).toBeGreaterThan(0.85);

    cobble.dispose();
    flagstone.dispose();
  });

  it('دیوار آجری مات است ولی نمِ ملایم (تنوع زبری) دارد', () => {
    const brick = createBrickWallMaps(0x6b4536, 3.5, 4.5, 128, 101);
    const stats = roughnessStats(brick.roughnessMap);

    // کف بازهٔ زبری آجر بالا رفته: هیچ لکهٔ براقی نمی‌ماند
    expect(stats.min).toBeGreaterThanOrEqual(0.8);
    expect(stats.mean).toBeGreaterThan(0.86);
    // ولی یکدست هم نیست: ردّ شرّهٔ باران زبری را کمی کم می‌کند (حس نمِ ملایم)
    expect(stats.max - stats.min).toBeGreaterThan(0.04);

    brick.dispose();
  });

  it('متریال زمین، پیاده‌رو، جدول و دیوارها زبری بالا و بازتاب محیطی ناچیز دارند', () => {
    const alley = createAlleyGeometry();

    const ground = materialOf(alley, 'Ground');
    const sidewalk = materialOf(alley, 'SidewalkLeft');
    const curb = materialOf(alley, 'CurbLeft');
    const wallWarm = materialOf(alley, 'WallLeft');
    const wallSlate = materialOf(alley, 'WallRight');
    const facade = materialOf(alley, 'TheaterFacade');

    for (const material of [ground, sidewalk, curb, wallWarm, wallSlate, facade]) {
      expect(material.roughness).toBeGreaterThanOrEqual(0.9);
      expect(material.metalness).toBeLessThanOrEqual(0.03);
      expect(material.envMapIntensity).toBeLessThanOrEqual(0.2);
    }

    // زمین از همه خشک‌تر است
    expect(ground.roughness).toBeGreaterThanOrEqual(0.95);
    expect(ground.envMapIntensity).toBeLessThanOrEqual(0.2);

    // نقشه‌های PBR سر جایشان هستند (کیفیت سطح حفظ شده)
    expect(ground.map).not.toBeNull();
    expect(ground.roughnessMap).not.toBeNull();
    expect(ground.normalMap).not.toBeNull();

    alley.dispose();
  });

  it('جوی کنار جدول دیگر آینهٔ ۳۸ متری نیست و مات و کم‌رنگ شده است', () => {
    const alley = createAlleyGeometry();
    const floorGroup = alley.group.getObjectByName('AlleyFloorGroup') as THREE.Group;
    expect(floorGroup).toBeDefined();

    const gutters = floorGroup.children.filter((child) => {
      const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
      return (
        child instanceof THREE.Mesh &&
        child.name !== 'Ground' &&
        material !== undefined &&
        material !== null &&
        material.type === 'MeshStandardMaterial' &&
        material.transparent === true &&
        material.opacity < 0.5
      );
    }) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];

    expect(gutters).toHaveLength(2);
    for (const gutter of gutters) {
      expect(gutter.material.roughness).toBeGreaterThanOrEqual(0.5);
      expect(gutter.material.metalness).toBeLessThanOrEqual(0.05);
      // جوی دیگر clearcoat ندارد؛ اگر متریال فیزیکی بود هم باید صفر بماند
      const clearcoat = (gutter.material as Partial<THREE.MeshPhysicalMaterial>).clearcoat ?? 0;
      expect(clearcoat).toBeLessThanOrEqual(0.2);
      expect(gutter.material.opacity).toBeLessThanOrEqual(0.45);
    }

    alley.dispose();
  });

  it('تنها چاله‌های آب براق‌اند و هر کدام یک هالهٔ نمناک مات پیرامون خود دارند', () => {
    const alley = createAlleyGeometry();

    const puddles: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>[] = [];
    const rings: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
    alley.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.name.startsWith('RainPuddle_')) {
        puddles.push(object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>);
      }
      if (object.name.startsWith('RainPuddleDampRing_')) {
        rings.push(object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>);
      }
    });

    expect(puddles).toHaveLength(5);
    expect(rings).toHaveLength(5);
    expect(alley.group.getObjectByName('RainPuddle_0')).toBeDefined();

    for (const puddle of puddles) {
      // آب جمع‌شده واقعاً براق می‌ماند
      expect(puddle.material.roughness).toBeLessThanOrEqual(0.12);
      expect(puddle.material.clearcoat).toBe(1);
    }

    for (const ring of rings) {
      // هاله نمناک است ولی براق نیست — بین آب و سنگ خشک
      expect(ring.material.roughness).toBeGreaterThan(0.3);
      expect(ring.material.roughness).toBeLessThan(0.6);
      // هاله با متریال استاندارد و بدون clearcoat ساخته می‌شود
      expect(ring.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(ring.material.type).toBe('MeshStandardMaterial');
      expect(ring.material.transparent).toBe(true);
      expect(ring.material.alphaMap).not.toBeNull();
      // هاله کمی بزرگ‌تر از خود چاله و کمی پایین‌تر از سطح آب است
      expect(ring.position.y).toBeLessThan(0.048);
    }

    // اندازهٔ هاله ۱٫۴۵ برابر چالهٔ متناظر است (فقط «کمی» اطراف آب)
    const puddle0 = alley.group.getObjectByName('RainPuddle_0') as THREE.Mesh<THREE.PlaneGeometry>;
    const ring0 = alley.group.getObjectByName('RainPuddleDampRing_0') as THREE.Mesh<THREE.PlaneGeometry>;
    expect(ring0.geometry.parameters.width / puddle0.geometry.parameters.width).toBeCloseTo(1.45, 5);
    expect(ring0.geometry.parameters.height / puddle0.geometry.parameters.height).toBeCloseTo(1.45, 5);

    alley.dispose();
  });

  it('ماسک هالهٔ نمناک فقط یک حلقهٔ باریک است: مرکز و بیرون آن خشک می‌مانند', () => {
    const ring = createPuddleDampRingAlphaMap(307, 128);
    const stats = alphaStats(ring);
    const data = (ring as THREE.DataTexture).image.data as Uint8Array;
    const size = 128;

    // گوشه‌ها (بیرون از هاله) کاملاً خشک‌اند
    expect(data[0]).toBe(0);
    expect(data[(size - 1) * 4]).toBe(0);
    expect(data[(size * size - 1) * 4]).toBe(0);

    // مرکز (زیر خود چاله) هم شفاف است و فقط نواری در میانه مقدار می‌گیرد
    const center = ((size / 2) * size + size / 2) * 4;
    expect(data[center]).toBeLessThan(48);

    expect(stats.max).toBeGreaterThan(0.7);
    expect(stats.mean).toBeLessThan(0.3);

    ring.dispose();
  });

  it('صحنه هنوز همهٔ عناصر قبلی را دارد و آزادسازی دوباره امن است', () => {
    const alley = createAlleyGeometry();
    for (const name of ['Ground', 'SidewalkRight', 'CurbRight', 'ManholeCover', 'RainPuddle_4', 'RainPuddleDampRing_4']) {
      expect(alley.group.getObjectByName(name), name).toBeDefined();
    }
    alley.dispose();
    expect(() => alley.dispose()).not.toThrow();
  });
});
