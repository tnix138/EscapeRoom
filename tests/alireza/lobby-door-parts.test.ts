import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import {
  ARC_TRACERY_SPOKES,
  LOBBY_DOOR,
  createLobbyDoor,
  lobbyDoorGlowPulse,
} from '@/engine3d/alley-lobby-door';

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

    // قهوه‌ای تیره و مات
    const slab = alley.group.getObjectByName('LobbyDoorLeafLeft_Slab') as THREE.Mesh<
      THREE.BoxGeometry,
      THREE.MeshStandardMaterial
    >;
    expect(slab).toBeDefined();
    const wood = slab.material;
    expect(wood.color.r).toBeGreaterThan(wood.color.b);
    expect(wood.color.getHex()).toBeLessThan(0x6a5a4a);
    expect(wood.roughness).toBeGreaterThan(0.5);
    expect(wood.metalness).toBeLessThan(0.2);
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

      // نقش‌نگاری آهنی: دو میلهٔ عمودی + دو میلهٔ افقی + گل‌سر، همه جلوی شیشه
      const tracery = leaf.getObjectByName(`LobbyDoorLeaf${id}_WindowTracery`) as THREE.Group;
      expect(tracery).toBeDefined();
      let bars = 0;
      tracery.traverse((object) => {
        if (object instanceof THREE.Mesh) bars++;
      });
      expect(bars).toBe(5); // ۲ عمودی + ۲ افقی + ۱ گل‌سر
      expect(leaf.getObjectByName(`LobbyDoorLeaf${id}_WindowRosette`)).toBeInstanceOf(THREE.Mesh);

      for (const child of tracery.children) {
        expect(child.position.z).toBeGreaterThan(glass.position.z);
      }

      // قاب آهنی دور شیشه
      expect(leaf.getObjectByName(`LobbyDoorLeaf${id}_WindowFrameHTop`)).toBeInstanceOf(THREE.Mesh);
      expect(leaf.getObjectByName(`LobbyDoorLeaf${id}_WindowFrameVLeft`)).toBeInstanceOf(THREE.Mesh);
      expect(leaf.getObjectByName(`LobbyDoorLeaf${id}_WindowFrameHBottom`)).toBeInstanceOf(THREE.Mesh);
      expect(leaf.getObjectByName(`LobbyDoorLeaf${id}_WindowFrameVRight`)).toBeInstanceOf(THREE.Mesh);
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

  it('دو دستگیرهٔ استوانه‌ای برنجی (طلایی) در وسط در و قرینهٔ هم‌اند', () => {
    const alley = buildAlley();
    const left = alley.group.getObjectByName('LobbyDoorHandleLeft') as THREE.Mesh<THREE.CylinderGeometry>;
    const right = alley.group.getObjectByName('LobbyDoorHandleRight') as THREE.Mesh<THREE.CylinderGeometry>;
    expect(left, 'left handle').toBeDefined();
    expect(right, 'right handle').toBeDefined();
    expect(left.geometry.type).toBe('CylinderGeometry');

    // استوانهٔ عمودی: ارتفاع بیشتر از قطر
    expect(left.geometry.parameters.height).toBeCloseTo(LOBBY_DOOR.handleLength, 6);
    expect(left.geometry.parameters.height).toBeGreaterThan(
      left.geometry.parameters.radiusTop * 4,
    );
    expect(left.rotation.x).toBeCloseTo(0, 6);

    // وسط در: هر دو نزدیک محور مرکزی و قرینه
    const leftPos = worldPos(left);
    const rightPos = worldPos(right);
    expect(leftPos.x).toBeCloseTo(-rightPos.x, 6);
    expect(Math.abs(leftPos.x)).toBeLessThan(0.2);
    expect(leftPos.y).toBeCloseTo(rightPos.y, 6);
    expect(leftPos.z).toBeCloseTo(rightPos.z, 6);
    // هر دستگیره روی لنگهٔ خودش است (سمت درست)
    expect(leftPos.x).toBeLessThan(0);
    expect(rightPos.x).toBeGreaterThan(0);

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

    // درِ لابی روی نمای تماشاخانه و هم‌تراز با لنگر است
    const door = alley.group.getObjectByName('TheaterDoor') as THREE.Group;
    expect(door.position.z).toBeCloseTo(-14, 6);
    expect(door.position.x).toBeCloseTo(0, 6);

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
