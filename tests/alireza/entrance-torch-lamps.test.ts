import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import {
  ENTRANCE_TORCH,
  TORCH_SIDES,
  createEntranceTorch,
  entranceTorchBreathe,
} from '@/engine3d/alley-entrance-torch';
import { DEFAULT_ALLEY_ANCHORS } from '@/engine3d/types';

/**
 * خواستهٔ بازبینی: دو چراغ کنار در ورودی تماشاخانه باید «حالت مشعل» داشته باشند
 * (پیاله، بازوی بیرون‌آمده از دیوار و هالهٔ گرم بالای آن) ولی همچنان چراغ باشند
 * — یعنی گوی نورانی و نور واقعی، نه شعلهٔ آتش — و بدنه‌شان هشت‌ضلعی باشد.
 */

function buildAlley() {
  const alley = createAlleyGeometry();
  alley.group.updateMatrixWorld(true);
  return alley;
}

function torchRoots(alley: ReturnType<typeof createAlleyGeometry>): THREE.Group[] {
  const torches: THREE.Group[] = [];
  alley.group.traverse((object) => {
    if (object.name.startsWith('EntranceTorch_')) torches.push(object as THREE.Group);
  });
  return torches;
}

function radialSides(mesh: THREE.Mesh): number {
  const parameters = (mesh.geometry as THREE.CylinderGeometry).parameters as
    | { radialSegments?: number }
    | undefined;
  return parameters?.radialSegments ?? 0;
}

describe('دو چراغ مشعلی هشت‌ضلعی کنار در ورودی', () => {
  it('دقیقاً دو مشعل، قرینهٔ هم، کنار در ورودی ایستاده‌اند', () => {
    const alley = buildAlley();
    const torches = torchRoots(alley);

    expect(torches).toHaveLength(2);
    expect(alley.group.getObjectByName('EntranceTorch_EntranceLeft')).toBeDefined();
    expect(alley.group.getObjectByName('EntranceTorch_EntranceRight')).toBeDefined();

    const left = alley.group.getObjectByName('EntranceTorch_EntranceLeft') as THREE.Group;
    const right = alley.group.getObjectByName('EntranceTorch_EntranceRight') as THREE.Group;

    // هر دو روی نمای تماشاخانه و دو طرف در (x = ±۱٫۹۵ نسبت به محورِ در) — قرینهٔ کامل.
    // نما حالا روی دیوارِ شمالیِ فرعی است، پس مختصاتِ محلیِ مشعل‌ها نسبت به محورِ
    // در و دیوارِ فرعی سنجیده می‌شود.
    const doorX = DEFAULT_ALLEY_ANCHORS.theaterDoor.x;
    const doorZ = DEFAULT_ALLEY_ANCHORS.theaterDoor.z;
    expect(Math.abs(left.position.x)).toBeCloseTo(1.95, 6);
    expect(left.position.x).toBeCloseTo(-right.position.x, 6);
    expect(left.position.z).toBeCloseTo(right.position.z, 6);
    alley.group.updateMatrixWorld(true);
    const leftTorchZ = left.getWorldPosition(new THREE.Vector3()).z;
    expect(leftTorchZ).toBeCloseTo(doorZ - 0.1 + 0.1, 6);
    expect(left.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(doorX - 1.95, 6);
    const leftGlass = left.getObjectByName('TorchLanternGlass_EntranceLeft') as THREE.Mesh;
    const rightGlass = right.getObjectByName('TorchLanternGlass_EntranceRight') as THREE.Mesh;
    const leftY = leftGlass.getWorldPosition(new THREE.Vector3()).y;
    const rightY = rightGlass.getWorldPosition(new THREE.Vector3()).y;
    expect(leftY).toBeCloseTo(rightY, 6);
    expect(leftY).toBeCloseTo(ENTRANCE_TORCH.lanternY, 6);

    alley.dispose();
  });

  it('بدنهٔ فانوس و پیالهٔ مشعل هشت‌ضلعی‌اند (نه کره/لوزی)', () => {
    const alley = buildAlley();
    for (const id of ['EntranceLeft', 'EntranceRight']) {
      const torch = alley.group.getObjectByName(`EntranceTorch_${id}`) as THREE.Group;

      const glass = torch.getObjectByName(`TorchLanternGlass_${id}`) as THREE.Mesh<THREE.CylinderGeometry>;
      expect(glass, `${id} glass`).toBeDefined();
      expect(glass.geometry.type).toBe('CylinderGeometry');
      expect(radialSides(glass)).toBe(TORCH_SIDES);
      expect(TORCH_SIDES).toBe(8);
      expect(glass.geometry.parameters.openEnded).toBe(true);

      // پیالهٔ مشعل هم هشت‌ضلعی است
      const cup = torch.getObjectByName(`TorchCup_${id}`) as THREE.Mesh<THREE.CylinderGeometry>;
      expect(cup).toBeDefined();
      expect(radialSides(cup)).toBe(TORCH_SIDES);

      // سرپوش مخروطی هشت‌ضلعی
      const cap = torch.getObjectByName(`TorchLanternCap_${id}`) as THREE.Mesh<THREE.ConeGeometry>;
      expect(cap.geometry.type).toBe('ConeGeometry');
      expect(cap.geometry.parameters.radialSegments).toBe(TORCH_SIDES);

      // بازوی لوله‌ای هم هشت‌ضلعی است و از دیوار بیرون آمده
      const arm = torch.getObjectByName(`TorchBracket_${id}`) as THREE.Mesh<THREE.TubeGeometry>;
      expect(arm.geometry.type).toBe('TubeGeometry');
      expect(arm.geometry.parameters.radialSegments).toBe(TORCH_SIDES);

      // هشت تیغهٔ عمودی روی گوشه‌ها — امضای بصری هشت‌ضلعی بودن
      let ribs = 0;
      torch.traverse((object) => {
        if (object.name.startsWith(`TorchLanternRib_${id}_`)) ribs++;
      });
      expect(ribs).toBe(TORCH_SIDES);
    }

    alley.dispose();
  });

  it('حالت مشعل دارد ولی چراغ است: پیاله، بازو، سرپوش و گوی نورانی — بدون شعله', () => {
    const alley = buildAlley();
    for (const id of ['EntranceLeft', 'EntranceRight']) {
      const torch = alley.group.getObjectByName(`EntranceTorch_${id}`) as THREE.Group;

      // اجزای مشعل
      expect(torch.getObjectByName(`TorchWallPlate_${id}`)).toBeDefined();
      expect(torch.getObjectByName(`TorchBracket_${id}`)).toBeDefined();
      expect(torch.getObjectByName(`TorchCup_${id}`)).toBeDefined();
      expect(torch.getObjectByName(`TorchCupRim_${id}`)).toBeDefined();
      expect(torch.getObjectByName(`TorchLanternCap_${id}`)).toBeDefined();

      // «چراغ بودن»: گوی نورانی داخل شیشه
      const bulb = torch.getObjectByName(`TorchLanternBulb_${id}`) as THREE.Mesh<
        THREE.SphereGeometry,
        THREE.MeshStandardMaterial
      >;
      expect(bulb).toBeDefined();
      expect(bulb.material.emissiveIntensity).toBeGreaterThan(1);

      // شیشه هم گرم و نیمه‌شفاف است (نور از آن رد می‌شود)
      const glass = torch.getObjectByName(`TorchLanternGlass_${id}`) as THREE.Mesh<
        THREE.CylinderGeometry,
        THREE.MeshStandardMaterial
      >;
      expect(glass.material.transparent).toBe(true);
      expect(glass.material.opacity).toBeGreaterThan(0.4);
      expect(glass.material.opacity).toBeLessThan(0.85);
      expect(glass.material.emissiveIntensity).toBeGreaterThan(0.5);

      // هیچ شعلهٔ آتشی (مخروط نارنجی/نویز) در گروه نیست — فقط مخروط سرپوش
      const cones: THREE.Mesh[] = [];
      torch.traverse((object) => {
        if (object instanceof THREE.Mesh && object.geometry.type === 'ConeGeometry') {
          cones.push(object);
        }
      });
      expect(cones).toHaveLength(1);
      expect(cones[0].name).toBe(`TorchLanternCap_${id}`);
    }

    alley.dispose();
  });

  it('هر مشعل یک چراغ واقعی با نور گرم و هالهٔ گرد دارد', () => {
    const alley = buildAlley();
    for (const [index, id] of ['EntranceLeft', 'EntranceRight'].entries()) {
      const torch = alley.group.getObjectByName(`EntranceTorch_${id}`) as THREE.Group;

      const light = torch.getObjectByName(`EntranceTorchLight_${id}`) as THREE.PointLight;
      expect(light).toBeInstanceOf(THREE.PointLight);
      expect(light.color.getHex()).toBe(ENTRANCE_TORCH.color);
      expect(light.intensity).toBeCloseTo(ENTRANCE_TORCH.intensity, 6);
      expect(light.distance).toBe(ENTRANCE_TORCH.distance);
      expect(light.decay).toBe(ENTRANCE_TORCH.decay);
      expect(light.castShadow).toBe(false);
      // نور دقیقاً روی فانوس است، نه جای دیگر
      expect(light.position.y).toBeCloseTo(ENTRANCE_TORCH.lanternY, 6);

      const halo = torch.getObjectByName(`EntranceTorchHalo_${id}`) as THREE.Sprite;
      expect(halo).toBeInstanceOf(THREE.Sprite);
      const haloMat = halo.material as THREE.SpriteMaterial;
      expect(haloMat.map).not.toBeNull();
      expect(haloMat.blending).toBe(THREE.AdditiveBlending);
      expect(haloMat.depthWrite).toBe(false);
      expect(haloMat.opacity).toBeLessThanOrEqual(0.25);

      // نور هر دو مشعل در فهرست نورهای کوچه ثبت شده است
      expect(alley.lights).toContain(light);
      expect(index).toBeLessThan(2);
    }

    // هر دو مشعل از یک متن هاله استفاده می‌کنند (یک تکسچر مشترک)
    const left = alley.group.getObjectByName('EntranceTorchHalo_EntranceLeft') as THREE.Sprite;
    const right = alley.group.getObjectByName('EntranceTorchHalo_EntranceRight') as THREE.Sprite;
    expect((left.material as THREE.SpriteMaterial).map).toBe(
      (right.material as THREE.SpriteMaterial).map,
    );

    alley.dispose();
  });

  it('نور مشعل‌ها با یک نفسِ ملایم و قطعی کمی تغییر می‌کند — نه سوسوزدن آتش', () => {
    // نفسِ ملایم: همیشه نزدیک ۱ و هرگز خاموش نمی‌شود
    const samples = Array.from({ length: 400 }, (_, i) => entranceTorchBreathe(i * 0.05, 2.4));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(1 - ENTRANCE_TORCH.breathe - 1e-9);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1 + ENTRANCE_TORCH.breathe + 1e-9);
    expect(ENTRANCE_TORCH.breathe).toBeLessThan(0.12);
    // کاملاً قطعی (برای تست واحد)
    expect(entranceTorchBreathe(3.2, 2.4)).toBe(entranceTorchBreathe(3.2, 2.4));
    expect(entranceTorchBreathe(Number.NaN, 2.4)).toBe(1);

    const alley = buildAlley();
    const light = alley.group.getObjectByName('EntranceTorchLight_EntranceLeft') as THREE.PointLight;
    const initial = light.intensity;
    alley.update(0.05, 3.4);
    expect(light.intensity).toBeCloseTo(ENTRANCE_TORCH.intensity * entranceTorchBreathe(3.4, 2.4), 6);
    // تغییر محسوس ولی ملایم — نه چشمک
    expect(Math.abs(light.intensity - initial)).toBeLessThan(ENTRANCE_TORCH.intensity * 0.12);

    alley.dispose();
  });

  it('ساخت مستقل مشعل: هشت‌ضلعی، هشت تیغه و نور در ارتفاع فانوس', () => {
    const haloTexture = new THREE.DataTexture(new Uint8Array(4 * 4 * 4), 4, 4);
    const torch = createEntranceTorch({
      id: 'Test',
      position: { x: 1.2, y: 0, z: -3 },
      haloTexture,
    });

    expect(torch.group.name).toBe('EntranceTorch_Test');
    expect(torch.group.position.x).toBe(1.2);
    expect(torch.light).toBeInstanceOf(THREE.PointLight);

    const glass = torch.group.getObjectByName('TorchLanternGlass_Test') as THREE.Mesh<THREE.CylinderGeometry>;
    expect(radialSides(glass)).toBe(8);

    let ribs = 0;
    torch.group.traverse((object) => {
      if (object.name.startsWith('TorchLanternRib_Test_')) ribs++;
    });
    expect(ribs).toBe(8);

    torch.update(1.7);
    expect(torch.light.intensity).toBeGreaterThan(0);
    haloTexture.dispose();
  });
});
