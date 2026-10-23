import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import {
  ARC_TRACERY_SPOKES,
  LOBBY_DOOR,
  LOBBY_DOOR_STATUS_LAMPS,
  WINDOW_FLOWER,
  createLobbyDoor,
  lobbyDoorGlowPulse,
  lobbyDoorHandleProfile,
  windowFlowerPetalAngles,
  windowFlowerVines,
} from '@/engine3d/alley-lobby-door';
import { DEFAULT_ALLEY_ANCHORS } from '@/engine3d/types';

/**
 * خواستهٔ بازبینی — درِ اصلی لابی از سه بخش:
 *   ۱. نوار نیم‌دایره‌ای شیشه‌ای بالای دو درِ چوبی، با نقش‌نگاری آهنی جلوی شیشه
 *   ۲. دو لنگهٔ درِ قهوه‌ای تیره با دو دستگیرهٔ استوانه‌ای برنجیِ طلایی در وسط
 *   ۳. مستطیل عمودی شیشهٔ نقش‌نگاری‌شده در میانهٔ هر لنگه، با نیمهٔ پایین چوبی
 */

function buildAlley() {
  const alley = createAlleyGeometry();
  alley.group.updateMatrixWorld(true);
  return alley;
}

const worldPos = (object: THREE.Object3D) => object.getWorldPosition(new THREE.Vector3());
const worldBox = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object);

describe('درِ اصلی لابی: نیم‌دایرهٔ شیشه‌ای، دو لنگهٔ چوبی و نقش‌نگاری آهنی', () => {
  it('درِ لابی از سه بخش ساخته شده و جایگزین درِ سادهٔ قبلی شده است', () => {
    const alley = buildAlley();
    const door = alley.group.getObjectByName('TheaterDoor');
    expect(door).toBeInstanceOf(THREE.Group);

    // بخش ۱ — نوار نیم‌دایره‌ای شیشه‌ای و نقش‌نگاری آهنی‌اش
    expect(alley.group.getObjectByName('LobbyDoorArcGlass')).toBeDefined();
    expect(alley.group.getObjectByName('LobbyDoorArcTracery')).toBeDefined();
    // بخش ۲ — دو لنگهٔ چوبی
    expect(alley.group.getObjectByName('LobbyDoorLeafLeft')).toBeDefined();
    expect(alley.group.getObjectByName('LobbyDoorLeafRight')).toBeDefined();
    // بخش ۳ — شیشهٔ مستطیلی و نقش‌نگاری‌اش در هر لنگه
    expect(alley.group.getObjectByName('LobbyDoorLeafLeft_WindowGlass')).toBeDefined();
    expect(alley.group.getObjectByName('LobbyDoorLeafRight_WindowGlass')).toBeDefined();

    // کتیبهٔ برنجی مرز بین دو لنگه و نوار شیشه‌ای را مشخص می‌کند
    const lintel = alley.group.getObjectByName('LobbyDoorLintel') as THREE.Mesh;
    expect(lintel).toBeInstanceOf(THREE.Mesh);
    expect(lintel.position.y).toBeCloseTo(LOBBY_DOOR.leafHeight, 6);
    expect(alley.group.getObjectByName('LobbyDoorArcInnerTrim')).toBeInstanceOf(THREE.Mesh);
    expect(alley.group.getObjectByName('LobbyDoorArcTrim')).toBeInstanceOf(THREE.Mesh);

    // نشانگر لنگر تعامل حفظ شده است
    expect(door?.userData.anchorId).toBe('theaterDoor');

    alley.dispose();
  });

  it('نوار نیم‌دایره‌ای است — نیم‌حلقهٔ شیشه‌ای دقیقاً روی بالای دو در می‌نشیند', () => {
    const alley = buildAlley();
    const arc = alley.group.getObjectByName('LobbyDoorArcGlass') as THREE.Mesh<THREE.RingGeometry>;
    expect(arc).toBeDefined();
    expect(arc.geometry.type).toBe('RingGeometry');

    const parameters = arc.geometry.parameters;
    // نیم‌دایره: از صفر تا π (نه حلقهٔ کامل، نه صفحهٔ توپُر)
    expect(parameters.thetaStart).toBeCloseTo(0, 6);
    expect(parameters.thetaLength).toBeCloseTo(Math.PI, 6);
    // نوار (حلقه) است، نه دیسک: شعاع داخلی > ۰
    expect(parameters.innerRadius).toBeCloseTo(LOBBY_DOOR.arcInnerRadius, 6);
    expect(parameters.innerRadius).toBeGreaterThan(0.5);
    // شعاع بیرونی = نیم‌عرض کل در (دو لنگه + شکاف) تا لبه‌ها هم‌تراز باشند
    const halfWidth = LOBBY_DOOR.leafWidth + LOBBY_DOOR.leafGap / 2;
    expect(parameters.outerRadius).toBeCloseTo(halfWidth, 6);

    // پایهٔ نیم‌دایره دقیقاً روی ارتفاع بالای لنگه‌ها است
    expect(arc.position.y).toBeCloseTo(LOBBY_DOOR.leafHeight, 6);
    const box = worldBox(arc);
    expect(box.min.y).toBeCloseTo(LOBBY_DOOR.leafHeight, 3);
    expect(box.max.y).toBeCloseTo(LOBBY_DOOR.leafHeight + halfWidth, 3);

    // شیشه است: شفاف، بدون نوشتن در عمق، و براق
    const material = arc.material as THREE.MeshStandardMaterial;
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeGreaterThan(0.2);
    expect(material.opacity).toBeLessThan(0.8);
    expect(material.depthWrite).toBe(false);
    expect(material.roughness).toBeLessThan(0.3);

    alley.dispose();
  });

  it('نقش‌نگاری آهنی جلوی شیشهٔ نیم‌دایره است (بازوهای شعاعی، قوس میانی و گل‌سرها)', () => {
    const alley = buildAlley();
    const arc = alley.group.getObjectByName('LobbyDoorArcGlass') as THREE.Mesh;
    const tracery = alley.group.getObjectByName('LobbyDoorArcTracery') as THREE.Group;
    expect(tracery).toBeDefined();

    const spokes: THREE.Mesh[] = [];
    const rosettes: THREE.Mesh[] = [];
    tracery.traverse((object) => {
      if (object.name.startsWith('LobbyDoorArcSpoke_')) spokes.push(object as THREE.Mesh);
      if (object.name.startsWith('LobbyDoorArcRosette_')) rosettes.push(object as THREE.Mesh);
    });
    expect(spokes).toHaveLength(ARC_TRACERY_SPOKES);
    expect(ARC_TRACERY_SPOKES).toBeGreaterThanOrEqual(5);
    expect(rosettes.length).toBeGreaterThanOrEqual(3);

    // همهٔ میله‌ها «جلوی» شیشه‌اند (z بزرگ‌تر = نزدیک‌تر به بیننده در این نما)
    const glassZ = arc.position.z;
    for (const bar of [...spokes, ...rosettes]) {
      expect(bar.position.z).toBeGreaterThan(glassZ);
    }

    // قوس میانی هم‌مرکز با نوار شیشه
    const rail = tracery.getObjectByName('LobbyDoorArcRail') as THREE.Mesh<THREE.TorusGeometry>;
    expect(rail).toBeDefined();
    expect(rail.geometry.parameters.arc).toBeCloseTo(Math.PI, 6);
    expect(rail.position.y).toBeCloseTo(LOBBY_DOOR.leafHeight, 6);
    // شعاع قوس میانی دقیقاً وسط نوار شیشه است
    expect(rail.geometry.parameters.radius).toBeCloseTo(
      (LOBBY_DOOR.arcInnerRadius + LOBBY_DOOR.arcOuterRadius) / 2,
      6,
    );

    // جنس آهنی: تیره و فلزی
    const iron = (spokes[0].material as THREE.MeshStandardMaterial);
    expect(iron.metalness).toBeGreaterThan(0.5);
    expect(iron.color.getHex()).toBeLessThan(0x555555);

    alley.dispose();
  });

  it('دو لنگهٔ چوبیِ قهوه‌ای تیره، قرینه و هم‌اندازه، با شکاف باریک در وسط', () => {
    const alley = buildAlley();
    const left = alley.group.getObjectByName('LobbyDoorLeafLeft') as THREE.Group;
    const right = alley.group.getObjectByName('LobbyDoorLeafRight') as THREE.Group;
    expect(left).toBeInstanceOf(THREE.Group);
    expect(right).toBeInstanceOf(THREE.Group);

    // قرینهٔ کامل حول محور کوچه
    expect(left.position.x).toBeCloseTo(-right.position.x, 6);
    expect(left.position.z).toBeCloseTo(right.position.z, 6);

    const leftBox = worldBox(left);
    const rightBox = worldBox(right);
    // فقط یک شکاف چند میلی‌متری بین دو لنگه
    expect(rightBox.min.x - leftBox.max.x).toBeCloseTo(LOBBY_DOOR.leafGap, 3);
    expect(leftBox.max.y).toBeCloseTo(LOBBY_DOOR.leafHeight, 3);
    expect(leftBox.min.y).toBeGreaterThanOrEqual(-0.001);

    // قهوه‌ای تیره و مات — رنگ از بافت چوب می‌آید و تینت متریال روشن و گرم است
    const slab = alley.group.getObjectByName('LobbyDoorLeafLeft_Slab') as THREE.Mesh<
      THREE.BoxGeometry,
      THREE.MeshStandardMaterial
    >;
    expect(slab).toBeDefined();
    const wood = slab.material;
    expect(wood.map).toBeInstanceOf(THREE.DataTexture);
    expect(wood.color.r).toBeGreaterThan(wood.color.b);
    expect(wood.roughness).toBeGreaterThan(0.5);
    expect(wood.metalness).toBeLessThan(0.2);
    // خودِ بافت قهوه‌ای تیره و گرم است (R > G > B و میانگین تاریک)
    const texture = wood.map as THREE.DataTexture;
    const pixels = texture.image.data as Uint8Array;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      sumR += pixels[i];
      sumG += pixels[i + 1];
      sumB += pixels[i + 2];
    }
    const total = pixels.length / 4;
    expect(sumR / total).toBeGreaterThan(sumG / total);
    expect(sumG / total).toBeGreaterThan(sumB / total);
    expect(sumR / total).toBeLessThan(120);
    // هر دو لنگه از یک جنس‌اند
    const rightSlab = alley.group.getObjectByName('LobbyDoorLeafRight_Slab') as THREE.Mesh;
    expect(rightSlab.material).toBe(wood);

    alley.dispose();
  });

  it('هر لنگه یک مستطیل عمودی شیشه دارد با نقش‌نگاری آهنی جلوی آن', () => {
    const alley = buildAlley();
    for (const id of ['Left', 'Right']) {
      const glass = alley.group.getObjectByName(`LobbyDoorLeaf${id}_WindowGlass`) as THREE.Mesh<
        THREE.PlaneGeometry,
        THREE.MeshStandardMaterial
      >;
      expect(glass, id).toBeDefined();
      const parameters = glass.geometry.parameters;
      // مستطیل عمودی: ارتفاع بیشتر از عرض
      expect(parameters.height).toBeGreaterThan(parameters.width);
      expect(parameters.height / parameters.width).toBeGreaterThan(1.5);
      expect(parameters.width).toBeCloseTo(LOBBY_DOOR.windowWidth, 6);
      expect(glass.material.transparent).toBe(true);

      // در میانهٔ افقی لنگه (نه چسبیده به لبه)
      const leaf = alley.group.getObjectByName(`LobbyDoorLeaf${id}`) as THREE.Group;
      expect(Math.abs(glass.position.x)).toBeLessThan(0.05);
      expect(glass.position.y).toBeCloseTo(LOBBY_DOOR.windowCenterY, 6);

      // نقش‌نگاری آهنی **گل**: حلقه، هشت گلبرگ، مرکز گل، دو پیچک و برگ‌ها —
      // همه جلوی شیشه و هیچ میلهٔ مستقیمی روی شیشه نیست
      const tracery = leaf.getObjectByName(`LobbyDoorLeaf${id}_WindowTracery`) as THREE.Group;
      expect(tracery).toBeDefined();
      let bars = 0;
      let straightBars = 0;
      tracery.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        bars++;
        if (object instanceof THREE.Mesh && object.geometry.type === 'BoxGeometry') {
          const box = new THREE.Box3().setFromObject(object);
          const size = box.getSize(new THREE.Vector3());
          if (size.x > 0.05 || size.y > 0.05) straightBars++;
        }
      });
      expect(bars).toBeGreaterThan(10);
      expect(straightBars).toBe(0); // میلهٔ راستِ افقی/عمودی نمانده است

      // همهٔ اجزای نقش‌نگاری جلوی شیشه‌اند (z جهانی، چون پیچک‌ها هندسهٔ
      // منحنی دارند و جابه‌جایی داخل هندسه پخته شده است)
      const glassZ = worldPos(glass).z;
      for (const child of tracery.children) {
        expect(worldBox(child).min.z, child.name).toBeGreaterThan(glassZ);
      }

      // قاب آهنی دور شیشه
      expect(leaf.getObjectByName(`LobbyDoorLeaf${id}_WindowFrameHTop`)).toBeInstanceOf(THREE.Mesh);
      expect(leaf.getObjectByName(`LobbyDoorLeaf${id}_WindowFrameVLeft`)).toBeInstanceOf(THREE.Mesh);
      expect(leaf.getObjectByName(`LobbyDoorLeaf${id}_WindowFrameHBottom`)).toBeInstanceOf(THREE.Mesh);
      expect(leaf.getObjectByName(`LobbyDoorLeaf${id}_WindowFrameVRight`)).toBeInstanceOf(THREE.Mesh);
    }

    alley.dispose();
  });

  it('نقش‌نگاری شیشه گل آهنی است: حلقه، هشت گلبرگ، مرکز، دو پیچک و برگ', () => {
    const alley = buildAlley();
    const expectedVines = 2;
    for (const id of ['Left', 'Right']) {
      const leaf = alley.group.getObjectByName(`LobbyDoorLeaf${id}`) as THREE.Group;
      const tracery = leaf.getObjectByName(`LobbyDoorLeaf${id}_WindowTracery`) as THREE.Group;

      // حلقهٔ گل وسط شیشه
      const ring = leaf.getObjectByName(`LobbyDoorLeaf${id}_FlowerRing`) as THREE.Mesh<THREE.TorusGeometry>;
      expect(ring, id).toBeInstanceOf(THREE.Mesh);
      expect(ring.position.y).toBeCloseTo(LOBBY_DOOR.windowCenterY, 6);
      expect(ring.position.x).toBeCloseTo(0, 6);

      // هشت گلبرگ یکنواخت دور حلقه
      const petals = tracery.children.filter((child) =>
        child.name.startsWith(`LobbyDoorLeaf${id}_FlowerPetal_`),
      );
      expect(petals).toHaveLength(WINDOW_FLOWER.petalCount);
      expect(WINDOW_FLOWER.petalCount).toBe(8);
      // گلبرگ‌ها دقیقاً روی شعاع یکسان و زاویه‌های پخش‌شده می‌نشینند
      for (const petal of petals) {
        const distance = Math.hypot(
          petal.position.x,
          petal.position.y - LOBBY_DOOR.windowCenterY,
        );
        expect(distance).toBeCloseTo(WINDOW_FLOWER.petalRadius, 6);
      }
      const expectedAngles = windowFlowerPetalAngles();
      const actualAngles = petals
        .map((petal) =>
          Math.atan2(petal.position.y - LOBBY_DOOR.windowCenterY, petal.position.x),
        )
        .map((angle) => (angle + Math.PI * 2) % (Math.PI * 2))
        .sort((a, b) => a - b);
      for (let i = 0; i < expectedAngles.length; i++) {
        expect(actualAngles[i]).toBeCloseTo(expectedAngles[i], 6);
      }

      // مرکز گل
      expect(leaf.getObjectByName(`LobbyDoorLeaf${id}_FlowerBoss`)).toBeInstanceOf(THREE.Mesh);

      // دو پیچک منحنی (بالا و پایین) با مفتول چرخشی، نه میلهٔ راست
      const vines = tracery.children.filter(
        (child) => child.name === `LobbyDoorLeaf${id}_VineTop` || child.name === `LobbyDoorLeaf${id}_VineBottom`,
      );
      expect(vines).toHaveLength(expectedVines);
      for (const vine of vines) {
        const mesh = vine as THREE.Mesh;
        expect(mesh.geometry.type).toBe('TubeGeometry');
      }

      // برگ‌ها و جوانه‌ها
      const leaves = tracery.children.filter((child) =>
        child.name.startsWith(`LobbyDoorLeaf${id}_FlowerLeaf_`),
      );
      const buds = tracery.children.filter((child) =>
        child.name.startsWith(`LobbyDoorLeaf${id}_FlowerBud_`),
      );
      expect(leaves).toHaveLength(WINDOW_FLOWER.leafCount);
      expect(buds).toHaveLength(expectedVines);
    }

    // پیچک بالا و پایین قرینهٔ هم‌اند
    const vines = windowFlowerVines();
    expect(vines.top).toHaveLength(vines.bottom.length);
    for (let i = 0; i < vines.top.length; i++) {
      expect(vines.top[i].x).toBeCloseTo(vines.bottom[i].x, 9);
      expect(vines.top[i].y).toBeCloseTo(-vines.bottom[i].y, 9);
    }

    alley.dispose();
  });

  it('نیمهٔ پایین هر لنگه چوبی است (پنل برجستهٔ چوبی زیر شیشه)', () => {
    const alley = buildAlley();
    for (const id of ['Left', 'Right']) {
      const panel = alley.group.getObjectByName(`LobbyDoorLeaf${id}_LowerPanel`) as THREE.Mesh<
        THREE.BoxGeometry,
        THREE.MeshStandardMaterial
      >;
      expect(panel, id).toBeDefined();
      const panelBox = worldBox(panel);
      const glass = alley.group.getObjectByName(`LobbyDoorLeaf${id}_WindowGlass`) as THREE.Mesh;
      const glassBox = worldBox(glass);

      // کاملاً زیر شیشهٔ میانی و در نیمهٔ پایین لنگه
      expect(panelBox.max.y).toBeLessThanOrEqual(glassBox.min.y);
      expect(panelBox.max.y).toBeLessThan(LOBBY_DOOR.leafHeight / 2);
      // عرض پنل تقریباً تمام عرض لنگه
      const panelWidth = panelBox.max.x - panelBox.min.x;
      expect(panelWidth / LOBBY_DOOR.leafWidth).toBeGreaterThan(0.7);

      // جنس چوبی (نافلز و مات)
      expect(panel.material.metalness).toBeLessThan(0.2);
      expect(panel.material.roughness).toBeGreaterThan(0.5);
    }

    alley.dispose();
  });

  it('چوب در قهوه‌ایِ صاف است: بافت ۵۱۲ پیکسلی طرح‌دار، بدون هیچ سوراخ یا منفذ تیره', () => {
    const alley = buildAlley();
    const slab = alley.group.getObjectByName('LobbyDoorLeafLeft_Slab') as THREE.Mesh<
      THREE.BoxGeometry,
      THREE.MeshStandardMaterial
    >;
    const wood = slab.material;

    // بافت اختصاصی در — ۵۱۲ پیکسل، نه ۱۲۸ پیکسلِ الوار جعبه‌ها
    expect(wood.map).toBeInstanceOf(THREE.DataTexture);
    expect((wood.map as THREE.DataTexture).image.width).toBe(512);
    expect(wood.normalMap).toBeInstanceOf(THREE.DataTexture);
    expect((wood.normalMap as THREE.DataTexture).image.width).toBe(512);
    expect(wood.roughnessMap).toBeInstanceOf(THREE.DataTexture);
    // برجستگی رگه ملایم است، نه برجستگی حفره‌ای
    expect(wood.normalScale.x).toBeGreaterThan(1);

    const px = (wood.map as THREE.DataTexture).image.data as Uint8Array;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    const lum: number[] = [];
    for (let i = 0; i < px.length; i += 4) {
      sumR += px[i];
      sumG += px[i + 1];
      sumB += px[i + 2];
      lum.push(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]);
    }
    const n = px.length / 4;
    const meanR = sumR / n;
    const meanG = sumG / n;
    const meanB = sumB / n;
    // قهوه‌ای گرم: کانال قرمز مسلط، روشنایی متوسط رو به تاریک
    expect(meanR).toBeGreaterThan(meanG);
    expect(meanG).toBeGreaterThan(meanB);
    expect(meanR).toBeGreaterThan(70);
    expect(meanR).toBeLessThan(150);

    const meanLum = lum.reduce((a, l) => a + l, 0) / n;
    // هیچ «سوراخ‌سوراخی»: تقریباً هیچ پیکسل بسیار تیره‌ای روی چوب نیست
    const veryDark = lum.filter((l) => l < meanLum * 0.55).length / n;
    expect(veryDark).toBeLessThan(0.005);

    // ولی طرح‌دار است: روشنایی در عرض بافت نوسان محسوس دارد (نوارهای رگه)
    const columns: number[] = new Array(64).fill(0);
    const columnCounts: number[] = new Array(64).fill(0);
    for (let i = 0, p = 0; i < px.length; i += 4, p++) {
      const col = Math.floor(((p % 512) / 512) * 64);
      columns[col] += lum[p];
      columnCounts[col] += 1;
    }
    const columnMeans = columns.map((sum, idx) => sum / Math.max(1, columnCounts[idx]));
    const colMean = columnMeans.reduce((a, b) => a + b, 0) / columnMeans.length;
    const colSd = Math.sqrt(
      columnMeans.reduce((a, b) => a + (b - colMean) ** 2, 0) / columnMeans.length,
    );
    expect(colSd / colMean).toBeGreaterThan(0.02);

    // زبری هم نقاشی دارد، نه عدد ثابت
    const rp = (wood.roughnessMap as THREE.DataTexture).image.data as Uint8Array;
    let rmin = 255;
    let rmax = 0;
    for (let i = 0; i < rp.length; i += 4) {
      rmin = Math.min(rmin, rp[i]);
      rmax = Math.max(rmax, rp[i]);
    }
    expect(rmax - rmin).toBeGreaterThan(25);

    alley.dispose();
  });

  it('مستطیل پایین در هیچ نوار طلایی/برنجی ندارد', () => {
    const alley = buildAlley();
    for (const id of ['Left', 'Right']) {
      const leaf = alley.group.getObjectByName(`LobbyDoorLeaf${id}`) as THREE.Group;
      expect(leaf, id).toBeDefined();
      // هیچ جعبهٔ برنجی روی لنگه نیست؛ قاب دور پنل پایین کاملاً حذف شده است
      const brassBoxes: string[] = [];
      leaf.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const raw = mesh.material as THREE.Material | THREE.Material[];
        const material = (Array.isArray(raw) ? raw[0] : raw) as THREE.MeshStandardMaterial | undefined;
        const isBrass = material?.name === 'LobbyDoorBrass';
        if (isBrass && mesh.geometry.type === 'BoxGeometry') {
          brassBoxes.push(mesh.name || '(بی‌نام)');
        }
      });
      expect(brassBoxes, id).toEqual([]);

      // پنل پایین هم‌چنان هست و همان چوب لنگه را دارد
      const panel = leaf.getObjectByName(`LobbyDoorLeaf${id}_LowerPanel`) as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.MeshStandardMaterial
      >;
      expect(panel).toBeInstanceOf(THREE.Mesh);
      expect(panel.material.name).toBe('LobbyDoorWood');
      // هیچ قطعهٔ دیگری هم دقیقاً هم‌اندازهٔ لبهٔ پنل در ارتفاع پنل نشسته است
      const panelBox = worldBox(panel);
      const extraAtPanelEdge: string[] = [];
      leaf.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh || mesh === panel) return;
        if (mesh.name.endsWith('_Slab') || mesh.name.endsWith('_WindowGlass')) return;
        const box = worldBox(mesh);
        const coversPanelTop =
          Math.abs(box.max.y - panelBox.max.y) < 0.03 && box.max.x - box.min.x > 0.4;
        const coversPanelBottom =
          Math.abs(box.min.y - panelBox.min.y) < 0.03 && box.max.x - box.min.x > 0.4;
        if (coversPanelTop || coversPanelBottom) extraAtPanelEdge.push(mesh.name || '(بی‌نام)');
      });
      expect(extraAtPanelEdge, id).toEqual([]);
    }

    alley.dispose();
  });

  it('دستگیرهٔ میله‌ای برنجی: نوک مخروطی بالا و پایین، سه حلقهٔ برجسته و در وسط در', () => {
    const alley = buildAlley();
    const left = alley.group.getObjectByName('LobbyDoorHandleLeft') as THREE.Mesh<
      THREE.LatheGeometry,
      THREE.MeshStandardMaterial
    >;
    const right = alley.group.getObjectByName('LobbyDoorHandleRight') as THREE.Mesh<
      THREE.LatheGeometry,
      THREE.MeshStandardMaterial
    >;
    expect(left, 'left handle').toBeDefined();
    expect(right, 'right handle').toBeDefined();
    // میلهٔ چرخشی، نه استوانهٔ ساده
    expect(left.geometry.type).toBe('LatheGeometry');

    const leftPos = worldPos(left);
    const rightPos = worldPos(right);
    // وسط در: هر دو نزدیک محورِ در (که حالا در فرعی است) و قرینه
    const doorX = DEFAULT_ALLEY_ANCHORS.theaterDoor.x;
    expect(leftPos.x - doorX).toBeCloseTo(-(rightPos.x - doorX), 6);
    expect(Math.abs(leftPos.x - doorX)).toBeLessThan(0.2);
    expect(leftPos.y).toBeCloseTo(rightPos.y, 6);
    expect(leftPos.z).toBeCloseTo(rightPos.z, 6);
    expect(leftPos.x).toBeLessThan(doorX);
    expect(rightPos.x).toBeGreaterThan(doorX);

    // پروفیل: نوک تیز در دو سر، بدنهٔ استوانه‌ای و حلقه‌های برجسته
    const profile = lobbyDoorHandleProfile();
    const half = LOBBY_DOOR.handleLength / 2;
    const radii = profile.map((point) => point.x);
    const ys = profile.map((point) => point.y);
    expect(Math.min(...ys)).toBeCloseTo(-half, 6);
    expect(Math.max(...ys)).toBeCloseTo(half, 6);
    // نوک‌ها: شعاع نزدیک صفر، یعنی «کمی تیز»
    expect(radii[0]).toBeLessThan(0.01);
    expect(radii[radii.length - 1]).toBeLessThan(0.01);
    expect(LOBBY_DOOR.handleTipLength).toBeGreaterThan(0.03);
    expect(LOBBY_DOOR.handleTipLength).toBeLessThan(LOBBY_DOOR.handleLength / 4);
    // حلقه‌ها برجسته‌تر از بدنه‌اند و تعدادشان درست است
    expect(Math.max(...radii)).toBeCloseTo(LOBBY_DOOR.handleRingRadius, 6);
    expect(LOBBY_DOOR.handleRingRadius).toBeGreaterThan(LOBBY_DOOR.handleRadius);
    const ringPeaks = profile.filter(
      (point) => Math.abs(point.x - LOBBY_DOOR.handleRingRadius) < 1e-9,
    );
    expect(ringPeaks.length).toBe(LOBBY_DOOR.handleRingCount * 2); // دو لبهٔ هر حلقه
    expect(LOBBY_DOOR.handleRingCount).toBe(3);
    // حلقه‌ها با فاصلهٔ مساوی و دور از نوک‌ها
    const ringCenters = [0, 1, 2].map((ring) => {
      const inner = -half + LOBBY_DOOR.handleTipLength;
      const span = LOBBY_DOOR.handleLength - 2 * LOBBY_DOOR.handleTipLength;
      return inner + (span * (ring + 1)) / (LOBBY_DOOR.handleRingCount + 1);
    });
    const gaps = ringCenters.slice(1).map((c, i) => c - ringCenters[i]);
    expect(gaps[0]).toBeCloseTo(gaps[1], 6);
    for (const center of ringCenters) {
      expect(center).toBeGreaterThan(-half + LOBBY_DOOR.handleTipLength);
      expect(center).toBeLessThan(half - LOBBY_DOOR.handleTipLength);
    }

    // برنج طلایی و فلزی
    const brass = left.material as THREE.MeshStandardMaterial;
    expect(brass).toBe(right.material);
    expect(brass.metalness).toBeGreaterThan(0.6);
    expect(brass.color.r).toBeGreaterThan(brass.color.b);
    expect(brass.color.getHex()).toBeGreaterThan(0x996600);

    // دستگیره جلوی سطح در است، نه داخل چوب
    const slab = alley.group.getObjectByName('LobbyDoorLeafLeft_Slab') as THREE.Mesh;
    expect(leftPos.z).toBeGreaterThan(worldPos(slab).z);

    alley.dispose();
  });

  it('پشت شیشه‌ها پردهٔ تاریک داخلی هست و سایبان بالای نیم‌دایره نمی‌افتد', () => {
    const alley = buildAlley();
    const interior = alley.group.getObjectByName('LobbyDoorInterior') as THREE.Mesh;
    expect(interior).toBeDefined();
    const arc = alley.group.getObjectByName('LobbyDoorArcGlass') as THREE.Mesh;
    // پردهٔ تاریک پشت شیشه (z کوچک‌تر) است
    expect(worldPos(interior).z).toBeLessThan(worldPos(arc).z);
    const interiorMat = interior.material as THREE.MeshStandardMaterial;
    expect(interiorMat.color.getHex()).toBeLessThan(0x333333);

    // سایبان سردر نباید روی نیم‌دایره بیفتد
    const marquee = alley.group.getObjectByName('TheaterMarqueeSign') as THREE.Mesh;
    if (marquee) {
      const marqueeBox = worldBox(marquee);
      const arcBox = worldBox(arc);
      expect(arcBox.max.y).toBeLessThan(marqueeBox.min.y + 0.05);
    }

    // درِ لابی روی نمای تماشاخانه (که به دیوارِ شمالیِ فرعی منتقل شده) و هم‌تراز
    // با لنگرِ در است
    const door = alley.group.getObjectByName('TheaterDoor') as THREE.Group;
    alley.group.updateMatrixWorld(true);
    const doorWorld = door.getWorldPosition(new THREE.Vector3());
    expect(doorWorld.z).toBeCloseTo(DEFAULT_ALLEY_ANCHORS.theaterDoor.z + 0.1, 6);
    expect(doorWorld.x).toBeCloseTo(DEFAULT_ALLEY_ANCHORS.theaterDoor.x, 6);

    alley.dispose();
  });

  it('درخشش شیشه‌ها با یک نفسِ ملایم و قطعی تغییر می‌کند', () => {
    const samples = Array.from({ length: 240 }, (_, i) => lobbyDoorGlowPulse(i * 0.08));
    expect(Math.min(...samples)).toBeGreaterThan(0.85);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.02);
    expect(lobbyDoorGlowPulse(2.4)).toBe(lobbyDoorGlowPulse(2.4));
    expect(lobbyDoorGlowPulse(Number.NaN)).toBe(1);

    const alley = buildAlley();
    const arc = alley.group.getObjectByName('LobbyDoorArcGlass') as THREE.Mesh<
      THREE.RingGeometry,
      THREE.MeshStandardMaterial
    >;
    const before = arc.material.emissiveIntensity;
    for (let i = 0; i < 40; i++) alley.update(0.05, i * 0.1);
    expect(arc.material.emissiveIntensity).not.toBe(before);
    expect(arc.material.emissiveIntensity).toBeGreaterThan(0);
    alley.dispose();
  });

  it('بازبینی: در باریک‌تر و بلندتر شد و همان سه بخش را دارد', () => {
    const alley = buildAlley();
    const opening = LOBBY_DOOR.leafWidth * 2 + LOBBY_DOOR.leafGap;
    // باریک‌تر: از ۲٫۵۴ متر قبلی به حدود ۲ متر
    expect(opening).toBeLessThan(2.2);
    expect(opening).toBeCloseTo(2.012, 3);
    // قوس هم متناسب کوچک شده و ضخامت نوارش حفظ شده است
    expect(LOBBY_DOOR.arcOuterRadius).toBeCloseTo(LOBBY_DOOR.leafWidth + LOBBY_DOOR.leafGap / 2, 6);
    expect(LOBBY_DOOR.arcOuterRadius - LOBBY_DOOR.arcInnerRadius).toBeGreaterThan(0.2);

    // بلندتر: از ۲٫۲ متر قبلی به ۲٫۵ متر
    expect(LOBBY_DOOR.leafHeight).toBeGreaterThan(2.4);
    const left = alley.group.getObjectByName('LobbyDoorLeafLeft') as THREE.Group;
    const leftBox = worldBox(left);
    expect(leftBox.max.y).toBeCloseTo(LOBBY_DOOR.leafHeight, 3);
    expect(leftBox.max.y).toBeGreaterThan(2.4);

    // ارتفاع کل (لنگه + نیم‌دایره) هنوز زیر سایبان می‌ماند
    const arc = alley.group.getObjectByName('LobbyDoorArcGlass') as THREE.Mesh;
    const arcBox = worldBox(arc);
    expect(arcBox.max.y).toBeCloseTo(LOBBY_DOOR.leafHeight + LOBBY_DOOR.arcOuterRadius, 3);
    const marqueeBox = worldBox(alley.group.getObjectByName('TheaterMarqueeSign') as THREE.Mesh);
    expect(arcBox.max.y).toBeLessThan(marqueeBox.min.y);

    // قاب سنگی هم باریک‌تر شد و همچنان دور در را می‌گیرد
    const surroundBox = worldBox(alley.group.getObjectByName('LobbyDoorSurround') as THREE.Mesh);
    expect(surroundBox.max.x - surroundBox.min.x).toBeLessThan(3);
    expect(surroundBox.max.x).toBeGreaterThan(
      DEFAULT_ALLEY_ANCHORS.theaterDoor.x + LOBBY_DOOR.arcOuterRadius,
    );

    alley.dispose();
  });

  it('سه چراغ وضعیت داخل نیم‌دایرهٔ بالای در نشسته‌اند، نه بالای آن', () => {
    const alley = buildAlley();
    const lamps = alley.group.getObjectByName('DoorPlayerStatusLamps') as THREE.Group;
    expect(lamps).toBeInstanceOf(THREE.Group);
    expect(lamps.children).toHaveLength(3);

    // بالای پایهٔ نیم‌دایره (سر لنگه‌ها) و پایین‌تر از نوک قوس
    const arcApexY = LOBBY_DOOR.leafHeight + LOBBY_DOOR.arcOuterRadius;
    expect(lamps.position.y).toBeGreaterThan(LOBBY_DOOR.leafHeight);
    expect(lamps.position.y).toBeLessThan(arcApexY);

    // همهٔ چراغ‌ها داخل مرز داخلی نیم‌دایره (تیمپانوم) می‌مانند
    const dy = LOBBY_DOOR_STATUS_LAMPS.centerY - LOBBY_DOOR.leafHeight;
    const halfChord = Math.sqrt(LOBBY_DOOR.arcInnerRadius ** 2 - dy ** 2);
    for (const bulb of lamps.children) {
      const pos = worldPos(bulb);
      expect(
        Math.abs(pos.x - DEFAULT_ALLEY_ANCHORS.theaterDoor.x) +
          LOBBY_DOOR_STATUS_LAMPS.bulbRadius,
      ).toBeLessThan(halfChord);
      expect(pos.y).toBeCloseTo(LOBBY_DOOR_STATUS_LAMPS.centerY, 6);
    }

    // از پشت شیشه/جلوی تیمپانوم چوبی دیده می‌شوند
    const tympanum = alley.group.getObjectByName('LobbyDoorTympanum') as THREE.Mesh;
    expect(worldPos(lamps.children[0]).z).toBeGreaterThan(worldPos(tympanum).z);

    // دیگر بالای قوس (جای قبلی) چراغی نیست
    expect(lamps.position.y).toBeLessThan(arcApexY - 0.2);

    alley.dispose();
  });

  it('چوب نیمهٔ پایین همان چوب کنار شیشه است و رگه پیوسته ادامه دارد', () => {
    const alley = buildAlley();
    // فقط رخ روبه‌روی چوب (نرمال +z) را می‌سنجیم؛ رخ‌های کناری UV مختصات عمق دارند
    const range = (geometry: THREE.BufferGeometry) => {
      const uv = geometry.getAttribute('uv');
      const normal = geometry.getAttribute('normal');
      const out = { uMin: Infinity, uMax: -Infinity, vMin: Infinity, vMax: -Infinity };
      for (let i = 0; i < uv.count; i++) {
        if (normal.getZ(i) < 0.9) continue;
        out.uMin = Math.min(out.uMin, uv.getX(i));
        out.uMax = Math.max(out.uMax, uv.getX(i));
        out.vMin = Math.min(out.vMin, uv.getY(i));
        out.vMax = Math.max(out.vMax, uv.getY(i));
      }
      return out;
    };

    for (const id of ['Left', 'Right']) {
      const slab = alley.group.getObjectByName(`LobbyDoorLeaf${id}_Slab`) as THREE.Mesh<
        THREE.BoxGeometry,
        THREE.MeshStandardMaterial
      >;
      const panel = alley.group.getObjectByName(`LobbyDoorLeaf${id}_LowerPanel`) as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.MeshStandardMaterial
      >;

      // یک متریال مشترک — نه چوب تیره‌ترِ جدا برای نیمهٔ پایین
      expect(panel.material, id).toBe(slab.material);
      expect(panel.material.name).toBe('LobbyDoorWood');

      const slabUv = range(slab.geometry);
      const panelUv = range(panel.geometry);
      // پنل زیرمجموعهٔ همان ناحیهٔ UV لنگه است ⇒ رگه بدون پرش ادامه می‌یابد
      expect(panelUv.uMin).toBeGreaterThanOrEqual(slabUv.uMin + 1e-6);
      expect(panelUv.uMax).toBeLessThanOrEqual(slabUv.uMax - 1e-6);
      expect(panelUv.vMin).toBeGreaterThanOrEqual(slabUv.vMin + 1e-6);
      expect(panelUv.vMax).toBeLessThanOrEqual(slabUv.vMax - 1e-6);
      // و کل ارتفاع لنگه دقیقاً یک کاشی است ⇒ هیچ درز تکرار روی در نمی‌افتد
      expect(slabUv.vMax - slabUv.vMin).toBeCloseTo(1, 3);
    }

    // دو لنگه از ناحیهٔ متفاوت بافت نمونه می‌گیرند، پس دوقلوی هم‌رگه نیستند
    const leftUv = range(
      (alley.group.getObjectByName('LobbyDoorLeafLeft_Slab') as THREE.Mesh).geometry,
    );
    const rightUv = range(
      (alley.group.getObjectByName('LobbyDoorLeafRight_Slab') as THREE.Mesh).geometry,
    );
    expect(Math.abs(leftUv.uMin - rightUv.uMin)).toBeGreaterThan(0.2);

    alley.dispose();
  });

  it('ساخت مستقل در: هر سه بخش + قاب سنگی حفره‌دار کامل ساخته می‌شود', () => {
    const door = createLobbyDoor();
    expect(door.group.name).toBe('TheaterDoor');
    expect(door.surround).toBeInstanceOf(THREE.Mesh);
    expect(door.surround.geometry.type).toBe('ExtrudeGeometry');
    expect(door.arcGlass.geometry.type).toBe('RingGeometry');
    expect(door.handles).toHaveLength(2);
    expect(door.windowGlass).toHaveLength(2);
    expect(door.leftLeaf.name).toBe('LobbyDoorLeafLeft');
    expect(door.rightLeaf.name).toBe('LobbyDoorLeafRight');

    // قاب واقعاً حفره دارد (اطراف در را می‌گیرد، وسطش باز است)
    const aperture = door.surround.geometry as THREE.ExtrudeGeometry;
    expect(aperture.parameters.shapes).toBeDefined();
    const shape = aperture.parameters.shapes as unknown as THREE.Shape;
    expect(shape.holes.length).toBe(1);

    // هر دو شیشه از یک متریال مشترک‌اند (یک بار ساخت)
    expect(door.windowGlass[0].material).toBe(door.windowGlass[1].material);
    expect(door.windowGlass[0].material).toBe(door.arcGlass.material);

    door.update(1.3);
    const glass = door.arcGlass.material as THREE.MeshStandardMaterial;
    expect(glass.emissiveIntensity).toBeCloseTo(0.55 * lobbyDoorGlowPulse(1.3), 6);
  });
});
