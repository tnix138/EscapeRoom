import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import { DEFAULT_ALLEY_ANCHORS } from '@/engine3d/types';

/**
 * خواستۀ امیر: «تابلوی بالای درب ورودی یه چراغ وسطش قسمت پایین داره، اونو حذف کن.»
 * آن چراغ، نورافکنِ وسطِ سردر بود (`TheaterEntranceSpotLight`): یک `SpotLight`
 * با شدت ۱۴ که از میانِ هوا روی در و پایینِ تابلو می‌تابید، هیچ بدنه یا حبابی
 * نداشت و تنها چیزی بود که «وسطِ پایینِ تابلو» دیده می‌شد. حذف شده است و
 * روشناییِ ورودی به دو مشعلِ کنارِ در + ماه/نورِ محیطی سپرده شده.
 */

const alley = createAlleyGeometry();

describe('سردر تماشاخانه — حذف چراغِ وسطِ زیرِ تابلو', () => {
  it('نورافکنِ وسطِ سردر دیگر در صحنه نیست', () => {
    expect(alley.group.getObjectByName('TheaterEntranceSpotLight')).toBeUndefined();
  });

  it('هیچ نورافکنِ دیگری وسطِ زیرِ تابلو نمانده است', () => {
    const doorZ = DEFAULT_ALLEY_ANCHORS.theaterDoor.z;
    const strays: string[] = [];
    alley.group.traverse((obj) => {
      const spot = obj as THREE.SpotLight;
      if (!spot.isSpotLight) return;
      const p = spot.getWorldPosition(new THREE.Vector3());
      // فقط نورافکن‌های تیر چراغ برق در کوچه مجازند (بالای سر، دور از سردر)
      const pole = obj.name.startsWith('PoleSpotLight_');
      if (!pole) strays.push(obj.name || '(بی‌نام)');
      // و هیچ نورافکنی نباید در مرکزِ محورِ ورودی و نزدیکِ تابلو باشد
      const nearCenterOfSign =
        Math.abs(p.x) < 0.6 && p.y > 3.2 && p.y < 5.2 && p.z > doorZ - 1.5;
      expect(nearCenterOfSign).toBe(false);
    });
    expect(strays).toEqual([]);
  });

  it('نورِ ورودی به دو مشعلِ کنارِ در سپرده شده و در قطع نشده است', () => {
    for (const side of ['Left', 'Right'] as const) {
      const torch = alley.group.getObjectByName(
        `EntranceTorchLight_Entrance${side}`,
      ) as THREE.PointLight;
      expect(torch).toBeDefined();
      expect(torch.isPointLight).toBe(true);
      expect(torch.intensity).toBeGreaterThan(0);
      // بردِ نور باید تا وسطِ در برسد، وگرنه ورودی سیاه می‌ماند
      expect(torch.distance).toBeGreaterThan(2.6);
    }
    // و نورِ ماه/محیطیِ کوچه دست‌نخورده می‌ماند
    expect(alley.group.getObjectByName('AlleyMoonDirectionalLight')).toBeDefined();
    expect(alley.group.getObjectByName('AlleyNightHemisphereLight')).toBeDefined();

    // شدت پایهٔ مشعل‌ها بعد از هر بار به‌روزرسانی همچنان مثبت است
    alley.update(0.016, 12.3);
    for (const side of ['Left', 'Right'] as const) {
      const torch = alley.group.getObjectByName(
        `EntranceTorchLight_Entrance${side}`,
      ) as THREE.PointLight;
      expect(torch.intensity).toBeGreaterThan(0);
    }
  });

  it('تابلوی سردر خودش می‌درخشد، پس حذف آن نور تابلو را تاریک نمی‌کند', () => {
    const board = alley.group.getObjectByName('TheaterMarqueeSign') as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshStandardMaterial
    >;
    expect(board).toBeDefined();
    expect(board.material.emissiveMap).toBeTruthy();
    expect(board.material.emissiveIntensity).toBeGreaterThan(0.3);
    // جعبهٔ سایبان هم سرِ جایش است
    expect(board.position.y).toBeGreaterThan(3.5);
  });

  it('حلقهٔ انیمیشن با نبودِ آن نور نمی‌شکند', () => {
    expect(() => alley.update(0.016, 4.7)).not.toThrow();
    expect(() => alley.update(0.016, Number.NaN)).not.toThrow();
    expect(() => alley.dispose()).not.toThrow();
  });
});
