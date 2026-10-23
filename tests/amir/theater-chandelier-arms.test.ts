import * as THREE from 'three';
import { afterAll, describe, expect, it } from 'vitest';
import {
  THEATER_CHANDELIER as C,
  buildTheaterChandelier,
} from '@/engine3d/theater-chandelier';
import { createTheaterGeometry } from '@/engine3d/theater-geometry';

/**
 * خواستۀ امیر — لوسترِ سالن سینما:
 *   «قسمتِ شاخه برای لامپ‌هاش رو درست کن: هشت شاخه، روی هر شاخه دو لامپ —
 *    یکی وسط و یکی انتهای شاخه — و زیرِ هر شاخه یک تیکه کریستالِ عمودی.»
 * پیش‌تر لوستر نه شاخه داشت، نه چراغِ شمعی: یک زنجیر، یک هشت‌وجهیِ بزرگِ
 * شناور و یک نورِ نقطه‌ای بود.
 */

const kit = buildTheaterChandelier();
const byName = <T extends THREE.Object3D = THREE.Object3D>(name: string) =>
  kit.group.getObjectByName(name) as T | undefined;

/** جعبهٔ جهانیِ یک گره در دستگاهِ خودِ لوستر (گروه در مبدأ است) */
function boxOf(node: THREE.Object3D) {
  kit.group.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(node);
}

describe('لوستر سینما — هشت شاخه با دو چراغ روی هر شاخه', () => {
  it('لوستر هشت شاخه دارد و نام‌ها شماره‌دارند', () => {
    expect(C.arms).toBe(8);
    expect(kit.arms.length).toBe(8);
    for (let i = 0; i < 8; i++) {
      const arm = kit.group.getObjectByName(`ChandelierArm_${i}`);
      expect(arm).toBeDefined();
      expect(arm!.userData.index).toBe(i);
      expect(kit.arms[i]).toBe(arm);
    }
  });

  it('هر شاخه دقیقاً دو چراغ دارد: یکی وسط و یکی سرِ شاخه', () => {
    expect(C.lampsPerArm).toBe(2);
    expect(kit.lampCount).toBe(C.arms * C.lampsPerArm);
    for (let i = 0; i < C.arms; i++) {
      const arm = kit.arms[i];
      const lamps = arm.children.filter((child) => child.name.startsWith('ChandelierLamp_'));
      expect(lamps.length).toBe(2);
      expect(arm.getObjectByName(`ChandelierLamp_${i}_Mid`)).toBeDefined();
      expect(arm.getObjectByName(`ChandelierLamp_${i}_End`)).toBeDefined();
    }
  });

  it('چراغِ وسط، وسطِ شاخه است و چراغِ نوک، انتهای آن (دورتر از مرکز)', () => {
    for (let i = 0; i < C.arms; i++) {
      const arm = kit.arms[i];
      const mid = arm.getObjectByName(`ChandelierLamp_${i}_Mid`)!;
      const end = arm.getObjectByName(`ChandelierLamp_${i}_End`)!;
      const rMid = Math.hypot(mid.position.x, mid.position.z);
      const rEnd = Math.hypot(end.position.x, end.position.z);
      // نوکِ شاخه دورترین نقطه است
      expect(rEnd).toBeCloseTo(C.armReach, 2);
      expect(rEnd).toBeGreaterThan(rMid * 1.25);
      // چراغِ وسط واقعاً وسط است، نه چسبیده به گلویی یا نوک
      expect(mid.userData.tAlongArm).toBeGreaterThan(0.35);
      expect(mid.userData.tAlongArm).toBeLessThan(0.75);
      expect(end.userData.tAlongArm).toBe(1);
    }
  });

  it('هشت شاخه با فاصلهٔ ۴۵ درجه دور گلویی پخش شده‌اند', () => {
    const angles = kit.arms.map((arm) => arm.userData.angle as number);
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i] - angles[i - 1]).toBeCloseTo((Math.PI * 2) / C.arms, 6);
    }
    // و همه هم‌اندازه‌اند (نه یک شاخهٔ کوتاه/بلند)
    const reaches = kit.arms.map((arm) => {
      const end = arm.getObjectByName(`ChandelierLamp_${arm.userData.index}_End`)!;
      return Math.hypot(end.position.x, end.position.z);
    });
    for (const reach of reaches) expect(reach).toBeCloseTo(reaches[0], 6);
  });

  it('هر چراغ بوبِش، جام، شمع و گویِ نورانیِ خودش را دارد', () => {
    for (let i = 0; i < C.arms; i++) {
      for (const kind of ['Mid', 'End'] as const) {
        const id = `_${i}_${kind}`;
        const lamp = byName(`ChandelierLamp${id}`)!;
        expect(lamp.getObjectByName(`ChandelierBobeche${id}`)).toBeDefined();
        expect(lamp.getObjectByName(`ChandelierCup${id}`)).toBeDefined();
        expect(lamp.getObjectByName(`ChandelierCandle${id}`)).toBeDefined();
        const bulb = lamp.getObjectByName(`ChandelierLamp${id}Bulb`) as THREE.Mesh<
          THREE.SphereGeometry,
          THREE.MeshStandardMaterial
        >;
        expect(bulb).toBeDefined();
        // گوی واقعاً می‌درخشد (چراغ، نه یک کرهٔ سفید)
        expect(bulb.material.emissiveIntensity).toBeGreaterThan(1);
        expect(bulb.material.emissive.getHex()).not.toBe(0);
      }
    }
  });

  it('شاخه‌ها لولهٔ منحنیِ واقعی‌اند و به گلویی وصل‌اند', () => {
    for (let i = 0; i < C.arms; i++) {
      const tube = byName<THREE.Mesh<THREE.TubeGeometry>>(`ChandelierArmTube_${i}`)!;
      expect(tube).toBeDefined();
      expect(tube.geometry.type).toBe('TubeGeometry');
      const knuckle = byName(`ChandelierArmKnuckle_${i}`)!;
      // مهرهٔ اتصال روی گلویی است (شعاع کوچک و ارتفاعِ گلویی)
      const r = Math.hypot(knuckle.position.x, knuckle.position.z);
      expect(r).toBeLessThan(C.hubRadius);
      expect(Math.abs(knuckle.position.y - C.hubY)).toBeLessThan(0.08);
    }
  });
});

describe('لوستر سینما — آویزِ کریستالِ عمودی زیرِ هر شاخه', () => {
  it('زیر هر شاخه دقیقاً یک آویزِ کریستال هست', () => {
    let drops = 0;
    for (let i = 0; i < C.arms; i++) {
      const drop = kit.arms[i].getObjectByName(`ChandelierCrystalDrop_${i}`);
      expect(drop).toBeDefined();
      const crystals = kit.arms[i].children
        .flatMap((c) => c.children)
        .filter((c) => c.name.startsWith('ChandelierCrystal_'));
      expect(crystals.length).toBe(1);
      drops++;
    }
    expect(drops).toBe(C.arms);
  });

  it('کریستال عمودی است: کشیده در y و باریک در x/z', () => {
    for (let i = 0; i < C.arms; i++) {
      const crystal = byName<THREE.Mesh>(`ChandelierCrystal_${i}`)!;
      expect(crystal).toBeDefined();
      const s = crystal.scale;
      // ارتفاع از پهنای مقطع بیشتر است و بلندی‌اش از عرضِ آویز بیشتر
      expect(s.y * 2).toBeGreaterThan(s.x * 2.2);
      expect(s.y * 2).toBeGreaterThan(s.z * 2.2);
      expect(s.x).toBeCloseTo(C.crystalWidth, 6);
      // و خودِ مِش زیرِ نقطهٔ اتصال است (آویزان، نه سوار بر شاخه)
      expect(crystal.position.y).toBeLessThan(-C.crystalWire);
    }
  });

  it('آویز از زیرِ خودِ شاخه آویزان است، نه از نوکِ چراغ', () => {
    for (let i = 0; i < C.arms; i++) {
      const drop = byName(`ChandelierCrystalDrop_${i}`)!;
      const mid = byName(`ChandelierLamp_${i}_Mid`)!;
      const end = byName(`ChandelierLamp_${i}_End`)!;
      const rDrop = Math.hypot(drop.position.x, drop.position.z);
      const rMid = Math.hypot(mid.position.x, mid.position.z);
      const rEnd = Math.hypot(end.position.x, end.position.z);
      // بین دو چراغ، زیرِ بدنهٔ شاخه
      expect(rDrop).toBeGreaterThan(rMid);
      expect(rDrop).toBeLessThan(rEnd);
      // ارتفاعِ اتصال همان ارتفاعِ منحنیِ شاخه در آن نقطه است
      const tube = byName<THREE.Mesh<THREE.TubeGeometry>>(`ChandelierArmTube_${i}`)!;
      const tubeBox = boxOf(tube);
      expect(drop.position.y).toBeGreaterThanOrEqual(tubeBox.min.y - 0.25);
      expect(drop.position.y).toBeLessThanOrEqual(tubeBox.max.y + 0.05);
    }
  });

  it('زیرِ گلویی هم یک آبشارِ کریستالِ مرکزی هست (مرکز خالی نماند)', () => {
    const center = byName<THREE.Mesh>('ChandelierCenterCrystal');
    expect(center).toBeDefined();
    expect(center!.position.y).toBeLessThan(C.hubY - 0.2);
    expect(center!.scale.y * 2).toBeGreaterThan(center!.scale.x * 2.2);
  });
});

describe('لوستر سینما — نشستن در سالن و کارایی', () => {
  it('کلِ لوستر داخلِ سالن است: از سقف آویزان و از سرِ بازیکن‌ها بالاتر', () => {
    const box = boxOf(kit.group);
    // بالاترین نقطه تا سقفِ ۶ متری می‌رسد
    expect(box.max.y).toBeGreaterThan(C.ceilingY - 0.2);
    expect(box.max.y).toBeLessThanOrEqual(C.ceilingY + 1e-6);
    // پایین‌ترین نقطه (ته آویزها) از ارتفاعِ سرِ تماشاگر بالاتر است
    expect(box.min.y).toBeGreaterThan(2.2);
    // و شعاعش از نیم‌عرضِ سالن (۹ متر) بسیار کمتر است
    expect(box.max.x).toBeLessThan(1.6);
    expect(box.max.z).toBeLessThan(1.6);
  });

  it('فقط دو نورِ واقعی دارد؛ بقیه گویِ emissive‌اند (بودجۀ نور)', () => {
    const lights: THREE.Light[] = [];
    kit.group.traverse((obj) => {
      const light = obj as THREE.Light;
      if (light.isLight) lights.push(light);
    });
    expect(lights.length).toBe(2);
    expect(kit.lights.length).toBe(2);
    expect(lights.map((l) => l.name).sort()).toEqual(['ChandelierDownLight', 'ChandelierLight']);
    for (const light of lights) {
      expect(light).toBeInstanceOf(THREE.PointLight);
      expect((light as THREE.PointLight).intensity).toBeGreaterThan(0);
    }
  });

  it('در سالنِ واقعی همان گره با نام Chandelier است و آزادسازی سالم است', () => {
    const theater = createTheaterGeometry();
    const chandelier = theater.group.getObjectByName('Chandelier');
    expect(chandelier).toBeDefined();
    expect(theater.chandelier).toBe(chandelier);
    // جای قبلی: (0, 0, 1)
    expect(chandelier!.position.x).toBe(0);
    expect(chandelier!.position.z).toBe(1);
    // ۱۶ چراغ و ۸ آویز در سالن
    let bulbs = 0;
    let crystals = 0;
    chandelier!.traverse((obj) => {
      if (obj.name.endsWith('Bulb')) bulbs++;
      if (obj.name.startsWith('ChandelierCrystal_')) crystals++;
    });
    expect(bulbs).toBe(C.arms * C.lampsPerArm);
    expect(crystals).toBe(C.arms);
    expect(() => theater.dispose()).not.toThrow();
  });
});

afterAll(() => {
  // هندسه/متریال‌های این نمونه با آزادسازیِ سالن پاک می‌شوند؛ این‌جا فقط
  // گروه را رها می‌کنیم تا تست بعدی از نمونهٔ خودش استفاده کند.
  kit.group.clear();
});
