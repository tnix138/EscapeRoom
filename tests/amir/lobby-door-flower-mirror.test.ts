import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import {
  LOBBY_DOOR,
  WOOD_UV_SCALE,
  WINDOW_FLOWER,
  windowFlowerPlan,
  windowFlowerVines,
} from '@/engine3d/alley-lobby-door';
import { DEFAULT_ALLEY_ANCHORS } from '@/engine3d/types';

/**
 * خواستهٔ بازبینی امیر روی درِ لابی:
 *   ۱. گلِ روی شیشهٔ دو لنگه **کپی یکسان نباشد**؛ لنگهٔ راست آینهٔ لنگهٔ چپ باشد
 *      (پیچک‌ها، برگ‌ها و جوانه‌ها قرینه به‌سمت مخالف خم شوند).
 *   ۲. **ارتفاع کلی در بیشتر** شود — و همان‌طور که در بلندتر می‌شود، شیشهٔ
 *      گل‌دار، پنل پایین و دستگیره متناسب جابه‌جا شوند و هیچ‌کدام از لبه‌ها نزند.
 */

const worldBox = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object);

function buildAlley() {
  const alley = createAlleyGeometry();
  alley.group.updateMatrixWorld(true);
  return alley;
}

/** قطعه‌های نقش‌نگاری هر لنگه، به‌صورت `name → {position, rotation}` */
function piecesOf(alleyGroup: THREE.Object3D, side: 'Left' | 'Right') {
  const leaf = alleyGroup.getObjectByName(`LobbyDoorLeaf${side}`) as THREE.Group;
  const tracery = leaf.getObjectByName(`LobbyDoorLeaf${side}_WindowTracery`) as THREE.Group;
  const out = new Map<string, { x: number; y: number; rotation: number }>();
  for (const child of tracery.children) {
    out.set(child.name.replace(`LobbyDoorLeaf${side}_`, ''), {
      x: child.position.x,
      y: child.position.y,
      rotation: child.rotation.z,
    });
  }
  return out;
}

describe('گلِ قرینه روی شیشهٔ دو لنگهٔ در (نه دو کپی یکسان)', () => {
  it('طرح لنگهٔ راست آینهٔ دقیق لنگهٔ چپ است: x قرینه و چرخش π − φ', () => {
    const base = windowFlowerPlan(1);
    const mirrored = windowFlowerPlan(-1);

    expect(mirrored.map((piece) => piece.name)).toEqual(base.map((piece) => piece.name));
    for (let index = 0; index < base.length; index++) {
      expect(mirrored[index].y).toBeCloseTo(base[index].y, 9);
      expect(mirrored[index].x).toBeCloseTo(-base[index].x, 9);
      // پیچک با قرینه‌شدن نقاطش آینه می‌شود، پس چرخشش نباید عوض شود
      // (وگرنه π اضافه بالا و پایینِ پیچک را جابه‌جا می‌کند و قرینه‌سازی صفر می‌شود)
      if (base[index].part === 'vine') {
        expect(mirrored[index].rotation).toBeCloseTo(base[index].rotation, 9);
      } else {
        expect(mirrored[index].rotation).toBeCloseTo(Math.PI - base[index].rotation, 9);
      }
    }

    // نقاط منحنی پیچک هم قرینه‌اند (نه فقط مش والدش)
    for (const piece of base) {
      const other = mirrored.find((candidate) => candidate.name === piece.name);
      if (!piece.points || !other?.points) continue;
      expect(other.points).toHaveLength(piece.points.length);
      piece.points.forEach((point, i) => {
        expect(other.points![i].x).toBeCloseTo(-point.x, 9);
        expect(other.points![i].y).toBeCloseTo(point.y, 9);
      });
    }
  });

  it('قرینه‌سازی واقعی است: شکلِ پیچک و برگ‌ها در دو لنگه با هم یکی نیست', () => {
    const base = windowFlowerPlan(1);
    const mirrored = windowFlowerPlan(-1);
    // قطعه‌های بیرون‌مرکز (پیچک، برگ، جوانه، گلبرگ کج) باید جابه‌جا شوند
    const moved = base.filter(
      (piece, index) =>
        Math.abs(piece.x) > 0.02 && mirrored[index].x !== piece.x,
    );
    expect(moved.length).toBeGreaterThanOrEqual(6);
    // و همان‌که قرینه‌اند، «برعکس» هم شده‌اند: چرخش برگ اول دو لنگه فرق می‌کند
    const firstLeaf = base.find((piece) => piece.name === 'FlowerLeaf_VineTop_0');
    const firstLeafMirror = mirrored.find((piece) => piece.name === 'FlowerLeaf_VineTop_0');
    expect(firstLeaf && firstLeafMirror ? Math.abs(firstLeaf.rotation - firstLeafMirror.rotation) : 0)
      .toBeGreaterThan(0.1);
  });

  it('قطعه‌های مرکزی (حلقه و مرکز گل) سر جایشان می‌مانند؛ فقط چیزهای کج آینه می‌شوند', () => {
    const base = windowFlowerPlan(1);
    const mirrored = windowFlowerPlan(-1);
    for (const name of ['FlowerRing', 'FlowerBoss']) {
      const piece = base.find((candidate) => candidate.name === name)!;
      const other = mirrored.find((candidate) => candidate.name === name)!;
      expect(other.x).toBeCloseTo(piece.x, 9);
      expect(other.y).toBeCloseTo(piece.y, 9);
      expect(Math.abs(piece.x)).toBeLessThan(1e-9);
    }
  });

  it('در صحنه هم دو لنگه قرینه‌اند: جای هر قطعه در لنگهٔ راست قرینهٔ لنگهٔ چپ است', () => {
    const alley = buildAlley();
    const left = piecesOf(alley.group, 'Left');
    const right = piecesOf(alley.group, 'Right');

    expect([...right.keys()].sort()).toEqual([...left.keys()].sort());
    // حلقه + ۸ گلبرگ + مرکز + ۲ پیچک + ۴ برگ + ۲ جوانه
    expect(left.size).toBe(1 + WINDOW_FLOWER.petalCount + 1 + 2 + WINDOW_FLOWER.leafCount + 2);

    for (const [name, piece] of left) {
      const other = right.get(name)!;
      expect(other.y, name).toBeCloseTo(piece.y, 6);
      // قطعه‌های بیرون‌مرکز قرینه‌اند و چرخششان هم آینه شده است
      if (Math.abs(piece.x) > 1e-6) {
        expect(other.x, name).toBeCloseTo(-piece.x, 6);
        const delta = Math.abs(((piece.rotation + other.rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
        expect(delta, name).toBeLessThan(1e-6);
      }
    }

    // قرینهٔ جهانی: جعبهٔ هر پیچک حول محور وسط در با هم‌قرینهٔ خود می‌خورد
    // (در حالا در فرعی است، پس محورِ تقارن `theaterDoor.x` است، نه صفر)
    const doorX = DEFAULT_ALLEY_ANCHORS.theaterDoor.x;
    for (const vine of ['VineTop', 'VineBottom']) {
      const leftBox = worldBox(alley.group.getObjectByName(`LobbyDoorLeafLeft_${vine}`)!);
      const rightBox = worldBox(alley.group.getObjectByName(`LobbyDoorLeafRight_${vine}`)!);
      expect(leftBox.min.x - doorX).toBeCloseTo(-(rightBox.max.x - doorX), 4);
      expect(leftBox.max.x - doorX).toBeCloseTo(-(rightBox.min.x - doorX), 4);
      expect(leftBox.min.y).toBeCloseTo(rightBox.min.y, 4);
      expect(leftBox.max.y).toBeCloseTo(rightBox.max.y, 4);
    }

    alley.dispose();
  });

  it('هیچ قطعهٔ گلی از لبهٔ شیشه بیرون نمی‌زند (حالت مرزی بعد از قد کشیدن در)', () => {
    const glassHalfWidth = LOBBY_DOOR.windowWidth / 2;
    const glassHalfHeight = LOBBY_DOOR.windowHeight / 2;
    // ۵ سانت = بزرگ‌ترین نیم‌اندازهٔ یک قطعه (گلبرگ دراز / جوانه)
    for (const mirror of [1, -1] as const) {
      for (const piece of windowFlowerPlan(mirror)) {
        expect(Math.abs(piece.x) + 0.05, `${mirror}/${piece.name}.x`).toBeLessThan(glassHalfWidth);
        expect(Math.abs(piece.y) + 0.05, `${mirror}/${piece.name}.y`).toBeLessThan(glassHalfHeight);
      }
    }
  });

  it('در سطح هندسه هم قرینه‌اند: vertex‌های پیچکِ راست آینهٔ پیچکِ چپ‌اند، نه کپی آن', () => {
    const alley = buildAlley();
    const localVertices = (name: string) => {
      const mesh = alley.group.getObjectByName(`LobbyDoorLeafLeft_${name}`) as THREE.Mesh<
        THREE.BufferGeometry
      >;
      const right = alley.group.getObjectByName(`LobbyDoorLeafRight_${name}`) as THREE.Mesh<
        THREE.BufferGeometry
      >;
      const read = (target: THREE.Mesh<THREE.BufferGeometry>) => {
        const attribute = target.geometry.getAttribute('position');
        const points: THREE.Vector3[] = [];
        for (let i = 0; i < attribute.count; i++) {
          points.push(new THREE.Vector3(attribute.getX(i), attribute.getY(i), attribute.getZ(i)));
        }
        return points;
      };
      return { left: read(mesh), right: read(right) };
    };
    const nearest = (point: THREE.Vector3, set: THREE.Vector3[]) =>
      Math.min(...set.map((other) => point.distanceTo(other)));

    for (const name of ['VineTop', 'VineBottom']) {
      const { left, right } = localVertices(name);
      // آینه حول محور عمودی: هر رأس چپ روی یک رأس قرینهٔ راست می‌نشیند
      const mirroredGap = Math.max(
        ...left.map((point) =>
          nearest(new THREE.Vector3(-point.x, point.y, point.z), right),
        ),
      );
      expect(mirroredGap, name).toBeLessThan(2e-4);
      // و همین رأس‌ها روی کپیِ بی‌قرینه نمی‌نشینند ⇒ دو لنگه یک شکل نیستند
      const copyGap = Math.max(...left.map((point) => nearest(point, right)));
      expect(copyGap, name).toBeGreaterThan(0.02);
    }

    alley.dispose();
  });

  it('آینه‌کردن پیچک، قرینهٔ بالا/پایین خودش را خراب نمی‌کند و پیش‌فرض بی‌خطر است', () => {
    const plain = windowFlowerVines();
    const flipped = windowFlowerVines(-1);
    // پیش‌فرض = طرح پایه، عیناً مثل قبل (بدون آرگومان هم همین)
    expect(plain.top.map((point) => point.x)).toEqual([0, 0.082, -0.07, 0.016]);
    expect(flipped.top.map((point) => point.x)).toEqual(plain.top.map((point) => -point.x));
    for (const set of [plain, flipped]) {
      for (let i = 0; i < set.top.length; i++) {
        expect(set.top[i].x).toBeCloseTo(set.bottom[i].x, 9);
        expect(set.top[i].y).toBeCloseTo(-set.bottom[i].y, 9);
      }
    }
  });
});

describe('ارتفاع کلی بیشترِ درِ لابی', () => {
  it('لنگه‌ها بلندتر شدند و نوک نیم‌دایره هنوز زیر سایبان است', () => {
    const alley = buildAlley();

    expect(LOBBY_DOOR.leafHeight).toBeGreaterThan(2.5);
    const leafBox = worldBox(alley.group.getObjectByName('LobbyDoorLeafLeft')!);
    // بدنهٔ چوبی دقیقاً تا همان ارتفاع تازه بالا می‌رود و کف چسبیده است
    expect(leafBox.max.y).toBeCloseTo(LOBBY_DOOR.leafHeight, 3);
    expect(leafBox.min.y).toBeGreaterThanOrEqual(-0.001);

    const arcBox = worldBox(alley.group.getObjectByName('LobbyDoorArcGlass')!);
    expect(arcBox.max.y).toBeCloseTo(LOBBY_DOOR.leafHeight + LOBBY_DOOR.arcOuterRadius, 3);
    const marqueeBox = worldBox(alley.group.getObjectByName('TheaterMarqueeSign')!);
    expect(arcBox.max.y).toBeLessThan(marqueeBox.min.y);

    // قاب سنگی هنوز بالای قوس را می‌پوشاند
    const surroundBox = worldBox(alley.group.getObjectByName('LobbyDoorSurround')!);
    expect(surroundBox.max.y).toBeGreaterThanOrEqual(arcBox.max.y);

    alley.dispose();
  });

  it('شیشهٔ گل‌دار، پنل پایین و دستگیره با در جابه‌جا شدند و هیچ‌کدام به هم نمی‌خورند', () => {
    const alley = buildAlley();
    const leafTop = LOBBY_DOOR.leafHeight;

    // شیشه در نیمهٔ بالایی است و قابش زیر سرِ لنگه می‌ماند
    const glassBox = worldBox(alley.group.getObjectByName('LobbyDoorLeafLeft_WindowGlass')!);
    expect(glassBox.min.y).toBeGreaterThan(leafTop * 0.35);
    const frameTop = LOBBY_DOOR.windowCenterY + (LOBBY_DOOR.windowHeight + 0.06) / 2;
    expect(frameTop).toBeLessThan(leafTop - 0.1);

    // پنل چوبی پایین کاملاً زیر شیشه و در نیمهٔ پایینی است
    const panelBox = worldBox(alley.group.getObjectByName('LobbyDoorLeafLeft_LowerPanel')!);
    expect(panelBox.max.y).toBeLessThanOrEqual(glassBox.min.y + 1e-6);
    expect(panelBox.max.y).toBeLessThan(leafTop / 2);
    expect(panelBox.min.y).toBeGreaterThanOrEqual(0.02);

    // دستگیره در میانهٔ ارتفاع تازه است و به کف یا سر در نمی‌چسبد
    const handle = alley.group.getObjectByName('LobbyDoorHandleLeft')!;
    expect(handle.position.y).toBeGreaterThan(1.2);
    expect(handle.position.y).toBeLessThan(leafTop - LOBBY_DOOR.handleLength);

    alley.dispose();
  });

  it('بافت چوب با درِ بلندتر کش نمی‌آید: همان یک کاشی روی کل لنگه', () => {
    // WOOD_UV_SCALE از ارتفاع مشتق می‌شود، پس لنگه دقیقاً یک کاشی است
    expect(WOOD_UV_SCALE * LOBBY_DOOR.leafHeight).toBeCloseTo(1, 9);

    const alley = buildAlley();
    const slab = alley.group.getObjectByName('LobbyDoorLeafLeft_Slab') as THREE.Mesh<
      THREE.BoxGeometry
    >;
    const uv = slab.geometry.getAttribute('uv');
    const normal = slab.geometry.getAttribute('normal');
    let vMin = Infinity;
    let vMax = -Infinity;
    for (let i = 0; i < uv.count; i++) {
      if (normal.getZ(i) < 0.9) continue;
      vMin = Math.min(vMin, uv.getY(i));
      vMax = Math.max(vMax, uv.getY(i));
    }
    expect(vMax - vMin).toBeCloseTo(1, 3);
    // و هیچ‌کدام از رخ‌ها از کاشی بیرون نمی‌زند (درز تکرار روی چوب نمی‌افتد)
    expect(vMin).toBeGreaterThanOrEqual(-1e-6);
    expect(vMax).toBeLessThanOrEqual(1 + 1e-6);

    alley.dispose();
  });
});
