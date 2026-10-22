'use client';

/**
 * alley-geometry.ts — معماری و اتمسفر کامل کوچهٔ قدیمی تماشاخانهٔ اُرفه‌ئو (علیرضا)
 * بازطراحی کامل سه‌بعدی شامل:
 * ۱) گنبد آسمان شبانه با ماه، هالهٔ مه‌آلود، ستاره‌های چشمک‌زن و ابرهای متحرک (fog: false)
 * ۲) کف‌سازی واقع‌گرایانه: سنگ‌فرش خشک و مات PBR (color/normal/roughness/AO)، پیاده‌روهای
 *    سنگ‌تراش، جدول گرانیتی، جوی بارانِ تیره و مات، چاله‌های آب بازتابنده (WetSurfaceMaterial)
 *    با هالهٔ نمناک باریک پیرامونشان و دریچه‌های چدنی — بقیهٔ کف کاملاً خشک است
 * ۳) ساختمان‌های چندطبقهٔ آجری و سنگی دههٔ ۱۹۲۰ در دو سوی کوچه (با قرنیز، دودکش، پنجره‌های
 *    فرورفته و کرکره‌دار، پنجره‌های نیمه‌روشن مرموز، بالکن فرفورژه، ناودان و پلاک کوچه)
 *    — دیوارها مات و بدون برق‌زدگی‌اند و فقط نمِ ملایم آجر دیده می‌شود
 *    + نمای باشکوه تماشاخانهٔ اُرفه‌ئو با سردر نورانی و چراغ‌های وضعیت بازیکنان
 *    + دروازهٔ آهنی قفل‌شده در انتهای پشت سر بازیکن (حذف کامل فضای خالی اطراف)
 * ۴) ۳ تیر چراغ برق قدیمی با بازوی عایق چینی، کابل‌های هوایی شکم‌داده، پرتو حجمی مه،
 *    ذرات غبار/رطوبت معلق در نور چراغ و سوسوزدن واقع‌گرایانهٔ اتصالی برق
 * ۵) دسته‌های جعبه‌های چوبی میخ‌کوب، پالت‌های باربری و بشکه‌های فلزی در حاشیهٔ کوچه
 * ۶) متن واقعی و باکیفیت سه‌بعدی مستقیم روی تابلوی اعلانات (چپ) و جدول ردیف‌های گیشه (راست)
 *    با چراغ مطالعهٔ برنجی اختصاصی تا بازیکن بدون نیاز به زدن کلید E مستقیم از روی تابلو بخواند
 *    — هر دو تابلو با یک فاصلهٔ مساوی (۰٫۸۶۵ متر) به دیوار خودشان چسبیده‌اند و چیدمانشان
 *      از یک منبع واحد در `alley-guide-layout.ts` می‌آید (پیش‌تر گیشهٔ راست ۰٫۶۵ متر جلوتر بود)
 */

import * as THREE from 'three';
import type { AlleyAnchors, WorldBounds } from './types';
import { DEFAULT_ALLEY_ANCHORS, DEFAULT_ALLEY_BOUNDS } from './types';
import { WetSurfaceMaterial } from './materials/wet-surface-material';
import { alleyGroundCrownAt } from './alley-ground-profile';
import {
  ALLEY_FACADE_BASE_X,
  ALLEY_GUIDE_BOARD_FRAME_CLEARANCE,
  ALLEY_GUIDE_BOARD_SURFACE_X,
  ALLEY_GUIDE_LAMP_X,
  ALLEY_GUIDE_WALL_INSET,
  ALLEY_ROW_CHART_LOCAL_OFFSET_X,
} from './alley-guide-layout';
import {
  ALLEY_MOON_DIRECTION,
  createAlleyEnvironmentMap,
  createAlleySkyDome,
} from './alley-sky';
import {
  createBrickWallMaps,
  createCobblestoneMaps,
  createFlagstoneMaps,
  createPuddleAlphaMap,
  createPuddleDampRingAlphaMap,
  createWoodPlankMaps,
  withUv2,
} from './alley-materials';
import {
  DEFAULT_ALLEY_SIGN_CLUES,
  createPlaybillSignTexture,
  createRowChartSignTexture,
  createStreetPlaqueTexture,
  createTheaterMarqueeTexture,
  type AlleySignCluesData,
} from './alley-signs';
import {
  createLampPoolAlphaTexture,
  createLightConeAlphaTexture,
  createOverheadCable,
  createRustyBarrel,
  createUtilityPole,
  createWoodenCrateMesh,
  createWoodenPallet,
  type UtilityPoleInstance,
} from './alley-props';

export type { AlleySignCluesData } from './alley-signs';

export interface AlleyPlayerLampStatus {
  playerName: string;
  ticketPunched: boolean;
}

export interface CreateAlleyOptions {
  clues?: AlleySignCluesData;
  players?: readonly AlleyPlayerLampStatus[];
}

export interface AlleyGeometryResult {
  group: THREE.Group;
  anchors: AlleyAnchors;
  bounds: WorldBounds;
  lights: THREE.Light[];
  environmentMap: THREE.DataTexture;
  /** به‌روزرسانی فریم‌به‌فریم سوسوزدن تیرهای چراغ برق، ابرها، ذرات مه و سردر تئاتر */
  update: (deltaSeconds: number, elapsedSeconds: number) => void;
  /** به‌روزرسانی زندهٔ متن واقعی روی تابلوهای سه‌بعدی و چراغ‌های بالای در تئاتر */
  updateClues: (clues: AlleySignCluesData, players?: readonly AlleyPlayerLampStatus[]) => void;
  dispose: () => void;
}

interface BuildingSpec {
  zCenter: number;
  length: number;
  height: number;
  xInset: number;
  variant: 0 | 1;
  floors: number;
  hasBalcony?: boolean;
  litWindowFloor?: number;
}

const LEFT_BUILDINGS: readonly BuildingSpec[] = [
  { zCenter: -10.5, length: 6.8, height: 10.6, xInset: 0.0, variant: 0, floors: 3, hasBalcony: true, litWindowFloor: 2 },
  { zCenter: -3.4, length: 7.5, height: 9.2, xInset: ALLEY_GUIDE_WALL_INSET.left, variant: 1, floors: 3 },
  { zCenter: 4.1, length: 7.6, height: 11.2, xInset: -0.06, variant: 0, floors: 4, hasBalcony: true, litWindowFloor: 3 },
  { zCenter: 12.2, length: 8.8, height: 9.8, xInset: 0.10, variant: 1, floors: 3 },
];

const RIGHT_BUILDINGS: readonly BuildingSpec[] = [
  { zCenter: -10.2, length: 7.4, height: 9.6, xInset: 0.08, variant: 1, floors: 3, hasBalcony: true },
  { zCenter: -2.6, length: 7.9, height: 11.4, xInset: ALLEY_GUIDE_WALL_INSET.right, variant: 0, floors: 4, litWindowFloor: 2 },
  { zCenter: 5.0, length: 7.4, height: 8.9, xInset: 0.12, variant: 1, floors: 3, hasBalcony: true },
  { zCenter: 12.6, length: 8.2, height: 10.4, xInset: 0.0, variant: 0, floors: 3, litWindowFloor: 2 },
];

export function createAlleyGeometry(options: CreateAlleyOptions = {}): AlleyGeometryResult {
  const group = new THREE.Group();
  group.name = 'AlleyRoot';

  const bounds = DEFAULT_ALLEY_BOUNDS;
  const anchors = DEFAULT_ALLEY_ANCHORS;
  const initialClues = options.clues ?? DEFAULT_ALLEY_SIGN_CLUES;

  // --- منابع مشترک PBR ---
  const environmentMap = createAlleyEnvironmentMap();
  const sky = createAlleySkyDome(74);
  group.add(sky.dome);

  const cobbleMaps = createCobblestoneMaps(5, 13, 256);
  const flagstoneMaps = createFlagstoneMaps(2, 16, 128);
  const brickWarmMaps = createBrickWallMaps(0x6b4536, 3.5, 4.5, 256, 101);
  const brickSlateMaps = createBrickWallMaps(0x4e4a52, 3.2, 4.2, 256, 233);
  const theaterStoneMaps = createBrickWallMaps(0x5c534c, 5.5, 4.5, 256, 379);
  const crateLightWoodMaps = createWoodPlankMaps(0x7c5a3a, 128);
  const crateDarkWoodMaps = createWoodPlankMaps(0x563c27, 128);
  const beamTexture = createLightConeAlphaTexture(64);
  // هالهٔ نرم نور روی سنگ‌فرش، یک تکسچر مشترک برای هر چهار چراغ (یک draw call)
  const lampPoolTexture = createLampPoolAlphaTexture(71, 128);
  const puddleMaskA = createPuddleAlphaMap(307, 128);
  const puddleMaskB = createPuddleAlphaMap(613, 128);
  // هالهٔ نمناک باریک پیرامون چاله‌ها (کف جز این نواحی خشک است)
  const dampRingMaskA = createPuddleDampRingAlphaMap(307, 128);
  const dampRingMaskB = createPuddleDampRingAlphaMap(613, 128);

  const playbillSign = createPlaybillSignTexture(initialClues);
  const rowChartSign = createRowChartSignTexture(initialClues);
  const marqueeSign = createTheaterMarqueeTexture();
  const streetPlaqueTex = createStreetPlaqueTexture();

  // مواد مشترک معماری و تجهیزات
  const darkIronMat = new THREE.MeshStandardMaterial({
    color: 0x22262b,
    roughness: 0.5,
    metalness: 0.78,
    envMap: environmentMap,
    envMapIntensity: 0.85,
  });

  const antiqueBrassMat = new THREE.MeshStandardMaterial({
    color: 0xc8a258,
    roughness: 0.34,
    metalness: 0.82,
    envMap: environmentMap,
    envMapIntensity: 1.0,
  });

  const stoneTrimMat = new THREE.MeshStandardMaterial({
    color: 0x67625c,
    map: flagstoneMaps.colorMap,
    normalMap: flagstoneMaps.normalMap,
    roughnessMap: flagstoneMaps.roughnessMap,
    roughness: 0.94,
    metalness: 0.02,
    envMap: environmentMap,
    envMapIntensity: 0.12,
  });

  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: 0x3b2618,
    map: crateDarkWoodMaps.colorMap,
    normalMap: crateDarkWoodMaps.normalMap,
    roughnessMap: crateDarkWoodMaps.roughnessMap,
    roughness: 0.72,
    metalness: 0.06,
  });

  const cratePlankMat = new THREE.MeshStandardMaterial({
    color: 0x9b7650,
    map: crateLightWoodMaps.colorMap,
    normalMap: crateLightWoodMaps.normalMap,
    roughnessMap: crateLightWoodMaps.roughnessMap,
    aoMap: crateLightWoodMaps.aoMap,
    aoMapIntensity: 0.75,
    roughness: 0.84,
    metalness: 0.04,
  });

  const crateTrimMat = new THREE.MeshStandardMaterial({
    color: 0x694c31,
    map: crateDarkWoodMaps.colorMap,
    normalMap: crateDarkWoodMaps.normalMap,
    roughness: 0.88,
    metalness: 0.05,
  });

  // =========================================================================
  // ۱. کف‌سازی کامل کوچه: سنگ‌فرش خیس، جدول گرانیتی، پیاده‌رو، چاله آب و فاضلاب
  // =========================================================================
  const floorGroup = new THREE.Group();
  floorGroup.name = 'AlleyFloorGroup';

  // سنگ‌فرش خشک: زبری بسیار بالا، فلزیگی تقریباً صفر و بازتاب محیطی کم تا
  // کف هیچ برق و آینه‌ای نداشته باشد (پیش‌تر roughness ۰٫۶۲ + env ۰٫۹۵ کف را
  // مثل سطح خیس براق می‌کرد)
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xa09e97,
    map: cobbleMaps.colorMap,
    normalMap: cobbleMaps.normalMap,
    normalScale: new THREE.Vector2(1.45, 1.45),
    roughnessMap: cobbleMaps.roughnessMap,
    aoMap: cobbleMaps.aoMap,
    aoMapIntensity: 0.9,
    roughness: 0.96,
    metalness: 0.015,
    envMap: environmentMap,
    envMapIntensity: 0.16,
  });

  const groundGeo = withUv2(new THREE.PlaneGeometry(13.2, 42, 24, 48));
  // قوس بسیار ملایم تاج کوچه برای هدایت طبیعی آب باران به جوی کنار جدول
  // (منبع مشترک با هالهٔ نور چراغ‌ها در alley-ground-profile.ts)
  const posAttr = groundGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    posAttr.setZ(i, alleyGroundCrownAt(posAttr.getX(i)));
  }
  groundGeo.computeVertexNormals();

  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -2);
  ground.receiveShadow = true;
  ground.name = 'Ground';
  floorGroup.add(ground);

  // پیاده‌روهای سنگ‌فرش برجسته و جدول گرانیتی چپ و راست
  // پیاده‌روی سنگی هم کاملاً خشک است و مثل زمین اصلی براق نمی‌شود
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0x9a968f,
    map: flagstoneMaps.colorMap,
    normalMap: flagstoneMaps.normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: flagstoneMaps.roughnessMap,
    aoMap: flagstoneMaps.aoMap,
    aoMapIntensity: 0.85,
    roughness: 0.95,
    metalness: 0.02,
    envMap: environmentMap,
    envMapIntensity: 0.12,
  });

  for (const side of [-1, 1] as const) {
    const walk = new THREE.Mesh(
      withUv2(new THREE.BoxGeometry(3.2, 0.13, 42)),
      sidewalkMat,
    );
    walk.position.set(side * 7.85, 0.065, -2);
    walk.receiveShadow = true;
    walk.castShadow = true;
    walk.name = side < 0 ? 'SidewalkLeft' : 'SidewalkRight';
    floorGroup.add(walk);

    const curb = new THREE.Mesh(
      withUv2(new THREE.BoxGeometry(0.26, 0.155, 42)),
      stoneTrimMat,
    );
    curb.position.set(side * 6.22, 0.077, -2);
    curb.receiveShadow = true;
    curb.castShadow = true;
    curb.name = side < 0 ? 'CurbLeft' : 'CurbRight';
    floorGroup.add(curb);

    // جوی کنار جدول: دیگر یک آینهٔ ۳۸ متری نیست؛ فقط یک شیار تیرهٔ مات که
    // خشکی کف را می‌شکند (پیش‌تر با roughness ۰٫۰۸ تمام طول کوچه برق می‌زد)
    const gutter = new THREE.MeshStandardMaterial({
      color: 0x1a1c21,
      roughness: 0.62,
      metalness: 0.03,
      envMap: environmentMap,
      envMapIntensity: 0.22,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const gutterMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 38), gutter);
    gutterMesh.rotation.x = -Math.PI / 2;
    gutterMesh.position.set(side * 5.88, 0.018, -2);
    floorGroup.add(gutterMesh);
  }

  // چاله‌های آب باران — تنها نقاط براق کف؛ بقیهٔ سنگ‌فرش خشک است
  const puddleSpecs: Array<{ x: number; z: number; rx: number; rz: number; rot: number; mask: THREE.DataTexture }> = [
    { x: -2.2, z: -4.2, rx: 2.7, rz: 3.6, rot: 0.25, mask: puddleMaskA },
    { x: 2.35, z: 2.1, rx: 2.5, rz: 3.3, rot: -0.4, mask: puddleMaskB },
    { x: -0.6, z: -9.6, rx: 2.9, rz: 2.6, rot: 0.62, mask: puddleMaskA },
    { x: 1.5, z: -2.1, rx: 2.0, rz: 2.5, rot: 1.05, mask: puddleMaskB },
    { x: -2.4, z: 4.9, rx: 2.2, rz: 2.7, rot: -0.75, mask: puddleMaskA },
  ];

  // هالهٔ نمناک: یک حلقهٔ نازک مات دور هر چاله، تا فقط «کمی اطراف آب» خیس
  // دیده شود و باقی کف کاملاً خشک بماند.
  const dampRingMats = new Map<THREE.DataTexture, THREE.MeshStandardMaterial>();
  const dampRingMaskOf = (mask: THREE.DataTexture): THREE.DataTexture =>
    mask === puddleMaskA ? dampRingMaskA : dampRingMaskB;
  const dampRingMatFor = (mask: THREE.DataTexture): THREE.MeshStandardMaterial => {
    const existing = dampRingMats.get(mask);
    if (existing) return existing;
    const created = new THREE.MeshStandardMaterial({
      color: 0x191b20,
      roughness: 0.42,
      metalness: 0.04,
      envMap: environmentMap,
      envMapIntensity: 0.55,
      alphaMap: dampRingMaskOf(mask),
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    created.name = 'PuddleDampFringeMaterial';
    dampRingMats.set(mask, created);
    return created;
  };

  puddleSpecs.forEach((p, idx) => {
    // هالهٔ نمناک پیرامون آب (کمی بزرگ‌تر از خود چاله، کمی پایین‌تر)
    const fringe = new THREE.Mesh(
      new THREE.PlaneGeometry(p.rx * 1.45, p.rz * 1.45),
      dampRingMatFor(p.mask),
    );
    fringe.rotation.x = -Math.PI / 2;
    fringe.rotation.z = p.rot;
    fringe.position.set(p.x, 0.0465, p.z);
    fringe.name = `RainPuddleDampRing_${idx}`;
    floorGroup.add(fringe);

    const puddleMat = new WetSurfaceMaterial({
      color: 0x111620,
      environmentMap,
      environmentIntensity: 1.95,
      roughness: 0.05,
      metalness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      alphaMap: p.mask,
      transparent: true,
      opacity: 0.92,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const puddle = new THREE.Mesh(new THREE.PlaneGeometry(p.rx, p.rz), puddleMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.rotation.z = p.rot;
    puddle.position.set(p.x, 0.048, p.z);
    puddle.name = `RainPuddle_${idx}`;
    floorGroup.add(puddle);
  });

  // دریچهٔ گرد فاضلاب وسط کوچه و دریچه‌های مشبک باران‌گیر کنار جدول
  const manholeGroup = new THREE.Group();
  manholeGroup.name = 'ManholeCover';
  manholeGroup.position.set(0.85, 0.052, 1.35);
  const manholeRim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.50, 0.024, 24), darkIronMat);
  const manholeLid = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.032, 24), darkIronMat);
  manholeGroup.add(manholeRim, manholeLid);
  floorGroup.add(manholeGroup);

  for (const [gx, gz] of [
    [-5.88, -6.2],
    [-5.88, 1.8],
    [5.88, -8.0],
    [5.88, 2.4],
  ]) {
    const grate = new THREE.Group();
    grate.name = 'StormDrainGrate';
    grate.position.set(gx, 0.03, gz);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.02, 0.72), darkIronMat);
    grate.add(frame);
    for (let bar = -2; bar <= 2; bar++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.028, 0.035), darkIronMat);
      slat.position.z = bar * 0.12;
      grate.add(slat);
    }
    floorGroup.add(grate);
  }

  // برگه‌های اعلان خیس افتاده روی زمین برای هدایت بصری بازیکن
  const flyerMat = new THREE.MeshStandardMaterial({
    color: 0xcbb996,
    roughness: 0.55,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  for (const [fx, fz, frot] of [
    [-3.6, 0.4, 0.42],
    [-4.9, -1.1, -0.28],
    [3.9, -0.3, -0.64],
    [-0.9, -6.8, 0.19],
  ]) {
    const flyer = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.44), flyerMat);
    flyer.rotation.x = -Math.PI / 2;
    flyer.rotation.z = frot;
    flyer.position.set(fx, 0.056, fz);
    floorGroup.add(flyer);
  }

  group.add(floorGroup);

  // =========================================================================
  // ۲. ردیف ساختمان‌های چندطبقهٔ قدیمی چپ و راست کوچه
  // =========================================================================
  const buildingsGroup = new THREE.Group();
  buildingsGroup.name = 'AlleyBuildings';

  // دیوارها مات‌اند: زبری نزدیک به ۱، فلزیگی صفر و بازتاب محیطی ناچیز تا فقط
  // حس «نمِ ملایم» آجر بماند و هیچ سطحی مثل شیشه برق نزند
  const brickMatWarm = new THREE.MeshStandardMaterial({
    color: 0x9d7763,
    map: brickWarmMaps.colorMap,
    normalMap: brickWarmMaps.normalMap,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: brickWarmMaps.roughnessMap,
    aoMap: brickWarmMaps.aoMap,
    aoMapIntensity: 0.85,
    roughness: 0.97,
    metalness: 0.01,
    envMap: environmentMap,
    envMapIntensity: 0.1,
  });

  const brickMatSlate = new THREE.MeshStandardMaterial({
    color: 0x837e8a,
    map: brickSlateMaps.colorMap,
    normalMap: brickSlateMaps.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughnessMap: brickSlateMaps.roughnessMap,
    aoMap: brickSlateMaps.aoMap,
    aoMapIntensity: 0.85,
    roughness: 0.96,
    metalness: 0.01,
    envMap: environmentMap,
    envMapIntensity: 0.1,
  });

  const darkWindowGlassMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.14,
    metalness: 0.35,
    envMap: environmentMap,
    envMapIntensity: 1.25,
  });

  const eerieLitWindowMat = new THREE.MeshStandardMaterial({
    color: 0xffd292,
    emissive: new THREE.Color(0xc97b32),
    emissiveIntensity: 0.72,
    roughness: 0.45,
  });

  const buildSideRow = (specs: readonly BuildingSpec[], side: -1 | 1) => {
    specs.forEach((b, index) => {
      const bGroup = new THREE.Group();
      bGroup.name = `${side < 0 ? 'BuildingLeft' : 'BuildingRight'}_${index}`;

      const wallDepth = 3.2;
      const facadeFaceX = side * (ALLEY_FACADE_BASE_X + b.xInset);
      const centerX = facadeFaceX + side * (wallDepth / 2);
      const wallMat = b.variant === 0 ? brickMatWarm : brickMatSlate;

      // بدنهٔ اصلی ساختمان متصل به لبهٔ پیاده‌رو (بدون شکاف خالی پشت اشیا)
      const body = new THREE.Mesh(
        withUv2(new THREE.BoxGeometry(wallDepth, b.height, b.length)),
        wallMat,
      );
      body.position.set(centerX, b.height / 2, b.zCenter);
      body.castShadow = true;
      body.receiveShadow = true;
      if (index === 1) {
        body.name = side < 0 ? 'WallLeft' : 'WallRight';
      }
      bGroup.add(body);

      // ازارهٔ سنگی پایین ساختمان
      const plinth = new THREE.Mesh(
        withUv2(new THREE.BoxGeometry(0.16, 0.85, b.length + 0.06)),
        stoneTrimMat,
      );
      plinth.position.set(facadeFaceX - side * 0.06, 0.425, b.zCenter);
      plinth.receiveShadow = true;
      bGroup.add(plinth);

      // قرنیزهای افقی طبقات و قرنیز برجستهٔ بام
      for (let f = 1; f <= b.floors; f++) {
        const yBand = f === b.floors ? b.height - 0.16 : f * (b.height / b.floors);
        const overhang = f === b.floors ? 0.34 : 0.14;
        const cornice = new THREE.Mesh(
          new THREE.BoxGeometry(overhang, f === b.floors ? 0.30 : 0.14, b.length + 0.12),
          stoneTrimMat,
        );
        cornice.position.set(facadeFaceX - side * (overhang * 0.45), yBand, b.zCenter);
        cornice.castShadow = true;
        bGroup.add(cornice);
      }

      // دودکش آجری روی لبهٔ بام برای خط آسمان طبیعی در برابر ابر و ماه
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.35, 0.62), wallMat);
      chimney.position.set(facadeFaceX + side * 0.55, b.height + 0.62, b.zCenter + (index % 2 === 0 ? 1.6 : -1.8));
      chimney.castShadow = true;
      bGroup.add(chimney);

      // پنجره‌های طبقات بالا
      const cols = 3;
      for (let floor = 0; floor < b.floors; floor++) {
        const wy = 1.85 + floor * ((b.height - 1.2) / b.floors);
        // طبقه همکف ساختمان وسط چپ و راست جای تابلو اعلانات و گیشه بلیط است
        if (floor === 0 && Math.abs(b.zCenter - -3.0) < 2.5) continue;

        for (let col = 0; col < cols; col++) {
          const wz = b.zCenter - b.length * 0.32 + col * (b.length * 0.32);
          const isLit = b.litWindowFloor === floor + 1 && col === 1;

          const winGroup = new THREE.Group();
          winGroup.position.set(facadeFaceX - side * 0.04, wy, wz);
          winGroup.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;

          // طاقچه و سردر سنگی پنجره
          const sill = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.10, 0.22), stoneTrimMat);
          sill.position.set(0, -0.78, 0.06);
          winGroup.add(sill);

          const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.15, 0.20), stoneTrimMat);
          lintel.position.set(0, 0.78, 0.05);
          winGroup.add(lintel);

          // شیشهٔ پنجره + چهارچوب صلیبی چوبی
          const pane = new THREE.Mesh(
            new THREE.PlaneGeometry(0.92, 1.42),
            isLit ? eerieLitWindowMat : darkWindowGlassMat,
          );
          pane.position.z = 0.025;
          winGroup.add(pane);

          const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.42, 0.06), darkWoodMat);
          vBar.position.z = 0.065;
          const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.05, 0.06), darkWoodMat);
          hBar.position.set(0, 0.16, 0.065);
          winGroup.add(vBar, hBar);

          // کرکره‌های چوبی نیمه‌باز دو طرف پنجره
          for (const sh of [-1, 1] as const) {
            const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.40, 0.045), darkWoodMat);
            shutter.position.set(sh * 0.56, 0, 0.11);
            shutter.rotation.y = -sh * 0.32;
            shutter.castShadow = true;
            winGroup.add(shutter);
          }

          bGroup.add(winGroup);
        }
      }

      // بالکن فرفورژهٔ طبقهٔ دوم برای سایه‌اندازی دراماتیک روی دیوار
      if (b.hasBalcony) {
        const balcY = 4.05;
        const balcGroup = new THREE.Group();
        balcGroup.name = 'WroughtIronBalcony';
        balcGroup.position.set(facadeFaceX - side * 0.48, balcY, b.zCenter);

        const slab = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.12, 2.8), stoneTrimMat);
        slab.castShadow = true;
        balcGroup.add(slab);

        const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.05, 2.84), darkIronMat);
        topRail.position.y = 0.92;
        balcGroup.add(topRail);

        for (let r = -6; r <= 6; r++) {
          const picket = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.9, 5), darkIronMat);
          picket.position.set(-side * 0.44, 0.46, r * 0.21);
          balcGroup.add(picket);
        }
        bGroup.add(balcGroup);
      }

      // لولهٔ ناودان عمودی بین دو ساختمان
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, b.height - 0.3, 8), darkIronMat);
      pipe.position.set(facadeFaceX - side * 0.08, (b.height - 0.3) / 2, b.zCenter + b.length * 0.46);
      pipe.castShadow = true;
      bGroup.add(pipe);

      buildingsGroup.add(bGroup);
    });
  };

  buildSideRow(LEFT_BUILDINGS, -1);
  buildSideRow(RIGHT_BUILDINGS, 1);

  // پلاک لعابی نام کوچه روی ساختمان سمت چپ نزدیک اسپاون
  const plaqueFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 1.08), darkIronMat);
  plaqueFrame.position.set(-8.62, 2.95, 2.6);
  buildingsGroup.add(plaqueFrame);

  const plaqueFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.02, 0.38),
    new THREE.MeshStandardMaterial({
      map: streetPlaqueTex,
      roughness: 0.32,
      metalness: 0.15,
    }),
  );
  plaqueFace.rotation.y = Math.PI / 2;
  plaqueFace.position.set(-8.57, 2.95, 2.6);
  plaqueFace.name = 'StreetNamePlaque';
  buildingsGroup.add(plaqueFace);

  group.add(buildingsGroup);

  // =========================================================================
  // ۳. نمای باشکوه تماشاخانهٔ اُرفه‌ئو در انتهای شمالی کوچه (z = -14)
  // =========================================================================
  const theaterGroup = new THREE.Group();
  theaterGroup.name = 'TheaterFacadeGroup';

  const theaterStoneMat = new THREE.MeshStandardMaterial({
    color: 0x877c74,
    map: theaterStoneMaps.colorMap,
    normalMap: theaterStoneMaps.normalMap,
    normalScale: new THREE.Vector2(1.3, 1.3),
    roughnessMap: theaterStoneMaps.roughnessMap,
    aoMap: theaterStoneMaps.aoMap,
    aoMapIntensity: 0.9,
    roughness: 0.95,
    metalness: 0.02,
    envMap: environmentMap,
    envMapIntensity: 0.12,
  });

  // بدنهٔ عریض عمارت تماشاخانه که کل انتهای کوچه را می‌بندد (جلو روی z = -14.10)
  const facadeMain = new THREE.Mesh(
    withUv2(new THREE.BoxGeometry(19.2, 11.6, 1.6)),
    theaterStoneMat,
  );
  facadeMain.position.set(anchors.theaterDoor.x, 5.8, anchors.theaterDoor.z - 0.9);
  facadeMain.name = 'TheaterFacade';
  facadeMain.castShadow = true;
  facadeMain.receiveShadow = true;
  theaterGroup.add(facadeMain);

  // سنتوری کلاسیک (Pediment) مثلثی بالای عمارت تماشاخانه در برابر آسمان شب
  const pedimentShape = new THREE.ExtrudeGeometry(
    (() => {
      const s = new THREE.Shape();
      s.moveTo(-6.4, 0);
      s.lineTo(6.4, 0);
      s.lineTo(0, 2.15);
      s.closePath();
      return s;
    })(),
    { depth: 0.9, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1 },
  );
  const pediment = new THREE.Mesh(pedimentShape, stoneTrimMat);
  pediment.position.set(0, 11.55, anchors.theaterDoor.z - 0.85);
  pediment.castShadow = true;
  theaterGroup.add(pediment);

  // چهار ستون کلاسیک سنگی در دو سوی ورودی تئاتر
  for (const colX of [-5.2, -2.55, 2.55, 5.2]) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.35, 8.6, 16), stoneTrimMat);
    shaft.position.set(colX, 4.5, anchors.theaterDoor.z + 0.05);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    theaterGroup.add(shaft);

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.45, 0.86), stoneTrimMat);
    base.position.set(colX, 0.225, anchors.theaterDoor.z + 0.05);
    theaterGroup.add(base);

    const capital = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.36, 0.92), antiqueBrassMat);
    capital.position.set(colX, 8.95, anchors.theaterDoor.z + 0.05);
    theaterGroup.add(capital);
  }

  // پنجره‌های بلند قوسی با شیشهٔ سرخ مخملی در طبقهٔ دوم تماشاخانه (فاصلهٔ پاک از نما بدون Z-fighting)
  const crimsonStainedMat = new THREE.MeshStandardMaterial({
    color: 0x5c111c,
    emissive: new THREE.Color(0x6e101c),
    emissiveIntensity: 0.55,
    roughness: 0.25,
  });
  for (const wx of [-3.9, 0, 3.9]) {
    const archFrame = new THREE.Mesh(new THREE.BoxGeometry(1.76, 3.14, 0.12), antiqueBrassMat);
    archFrame.position.set(wx, 7.25, anchors.theaterDoor.z - 0.02);
    theaterGroup.add(archFrame);

    const archWin = new THREE.Mesh(new THREE.BoxGeometry(1.48, 2.86, 0.12), crimsonStainedMat);
    archWin.position.set(wx, 7.25, anchors.theaterDoor.z + 0.03);
    theaterGroup.add(archWin);
  }

  // سایبان نورانی سردر تماشاخانه (Marquee Canopy) با متن واقعی
  const marqueeBox = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.48, 1.55), darkIronMat);
  marqueeBox.position.set(0, 4.42, anchors.theaterDoor.z + 0.62);
  marqueeBox.castShadow = true;
  theaterGroup.add(marqueeBox);

  const marqueeBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(6.56, 1.34),
    new THREE.MeshStandardMaterial({
      map: marqueeSign.texture,
      emissiveMap: marqueeSign.texture,
      emissive: new THREE.Color(0xffdf9e),
      emissiveIntensity: 0.72,
      roughness: 0.36,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  marqueeBoard.position.set(0, 4.42, anchors.theaterDoor.z + 1.44);
  marqueeBoard.name = 'TheaterMarqueeSign';
  theaterGroup.add(marqueeBoard);

  // میله‌های مهاری برنجی سایبان سردر
  for (const cx of [-2.9, 2.9]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.15, 6), antiqueBrassMat);
    rod.position.set(cx, 5.72, anchors.theaterDoor.z + 0.68);
    rod.rotation.x = 0.56;
    theaterGroup.add(rod);
  }

  // قاب برنجی و درِ دولنگهٔ کنده‌کاری‌شدهٔ تماشاخانه
  const portalArch = new THREE.Mesh(new THREE.BoxGeometry(3.15, 3.85, 0.34), antiqueBrassMat);
  portalArch.position.set(anchors.theaterDoor.x, 1.92, anchors.theaterDoor.z - 0.08);
  theaterGroup.add(portalArch);

  const door = new THREE.Mesh(
    withUv2(new THREE.BoxGeometry(2.55, 3.45, 0.22)),
    darkWoodMat,
  );
  door.position.set(anchors.theaterDoor.x, 1.72, anchors.theaterDoor.z);
  door.name = 'TheaterDoor';
  door.userData.anchorId = 'theaterDoor';
  door.castShadow = true;
  door.receiveShadow = true;
  theaterGroup.add(door);

  const centerSeam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.42, 0.28), darkIronMat);
  centerSeam.position.set(0, 1.72, anchors.theaterDoor.z + 0.02);
  theaterGroup.add(centerSeam);

  for (const side of [-1, 1] as const) {
    for (const py of [0.95, 2.45]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.05, 0.06), antiqueBrassMat);
      panel.position.set(side * 0.62, py, anchors.theaterDoor.z + 0.13);
      theaterGroup.add(panel);

      const inset = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.90, 0.06), darkWoodMat);
      inset.position.set(side * 0.62, py, anchors.theaterDoor.z + 0.16);
      theaterGroup.add(inset);
    }

    const handleRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 18), antiqueBrassMat);
    handleRing.position.set(side * 0.22, 1.56, anchors.theaterDoor.z + 0.19);
    theaterGroup.add(handleRing);
  }

  // فانوس‌های برنجی دو طرف در ورودی
  const sconceMat = new THREE.MeshStandardMaterial({
    color: 0xffe4ad,
    emissive: new THREE.Color(0xffb457),
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });
  for (const sx of [-1.95, 1.95]) {
    const lanternGlass = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 1), sconceMat);
    lanternGlass.position.set(sx, 2.75, anchors.theaterDoor.z + 0.24);
    theaterGroup.add(lanternGlass);

    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.28), antiqueBrassMat);
    bracket.position.set(sx, 2.52, anchors.theaterDoor.z + 0.12);
    theaterGroup.add(bracket);
  }

  // ردیف چراغ‌های وضعیت پانچ بلیط بازیکنان بالای چهارچوب در
  const playerStatusLampsGroup = new THREE.Group();
  playerStatusLampsGroup.name = 'DoorPlayerStatusLamps';
  playerStatusLampsGroup.position.set(0, 3.55, anchors.theaterDoor.z + 0.18);
  theaterGroup.add(playerStatusLampsGroup);

  const rebuildPlayerStatusLamps = (players?: readonly AlleyPlayerLampStatus[], requiredCount = 3, punchedCount = 0) => {
    while (playerStatusLampsGroup.children.length > 0) {
      const child = playerStatusLampsGroup.children.pop()!;
      playerStatusLampsGroup.remove(child);
    }
    const count = Math.max(1, Math.min(8, players?.length ?? requiredCount));
    const spacing = 0.34;
    for (let i = 0; i < count; i++) {
      const ready = players ? Boolean(players[i]?.ticketPunched) : i < punchedCount;
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.068, 10, 10),
        new THREE.MeshStandardMaterial({
          color: ready ? 0xa8ffbe : 0x5c1922,
          emissive: new THREE.Color(ready ? 0x35e07a : 0x991b27),
          emissiveIntensity: ready ? 2.1 : 0.75,
          roughness: 0.25,
        }),
      );
      bulb.position.x = (i - (count - 1) / 2) * spacing;
      playerStatusLampsGroup.add(bulb);
    }
  };
  rebuildPlayerStatusLamps(options.players, initialClues.requiredCount, initialClues.punchedCount);

  group.add(theaterGroup);

  // =========================================================================
  // ۴. دروازهٔ آهنی قفل‌شده در انتهای جنوبی کوچه (پشت سر بازیکن در z = +8.8)
  // =========================================================================
  const backGateGroup = new THREE.Group();
  backGateGroup.name = 'AlleyBackGate';
  backGateGroup.position.set(0, 0, 8.85);

  for (const px of [-6.4, 6.4]) {
    const pier = new THREE.Mesh(withUv2(new THREE.BoxGeometry(1.1, 4.1, 1.1)), brickMatWarm);
    pier.position.set(px, 2.05, 0);
    pier.castShadow = true;
    backGateGroup.add(pier);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.22, 1.26), stoneTrimMat);
    cap.position.set(px, 4.2, 0);
    backGateGroup.add(cap);
  }

  for (const railY of [0.35, 1.85, 3.35]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.08, 0.08), darkIronMat);
    bar.position.y = railY;
    backGateGroup.add(bar);
  }

  for (let gx = -5.75; gx <= 5.75; gx += 0.36) {
    const picket = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 3.65, 6), darkIronMat);
    picket.position.set(gx, 1.9, 0);
    picket.castShadow = true;
    backGateGroup.add(picket);
  }

  // سیلوئت ساختمان روبه‌روی خیابان پشت دروازه تا انتهای دید هرگز سیاه خالی نباشد
  const distantBlock = new THREE.Mesh(
    withUv2(new THREE.BoxGeometry(26, 12.5, 2.4)),
    brickMatSlate,
  );
  distantBlock.position.set(0, 6.25, 19.5);
  backGateGroup.add(distantBlock);

  group.add(backGateGroup);

  // =========================================================================
  // ۵. تابلوی اعلانات چپ و گیشهٔ مکانیکی راست با متن واقعی و خوانا در فضای ۳D
  // =========================================================================

  // --- الف) ویترین چوبی-برنجی تابلوی اعلانات متصل به دیوار چپ (رو به داخل کوچه +X) ---
  const playbillGroup = new THREE.Group();
  playbillGroup.name = 'PlaybillShowcase';
  playbillGroup.position.set(anchors.playbill.x, anchors.playbill.y, anchors.playbill.z);

  // پشت‌بند کامل از دیوار آجری چپ (x = -8.90) تا صفحهٔ تابلو (x = -8.02) بدون هیچ شکاف خالی
  const billboardCase = new THREE.Mesh(
    withUv2(new THREE.BoxGeometry(0.92, 2.40, 2.98)),
    darkWoodMat,
  );
  billboardCase.position.set(-0.98, -0.22, 0);
  billboardCase.name = 'PlaybillBoard';
  billboardCase.userData.anchorId = 'playbill';
  billboardCase.castShadow = true;
  billboardCase.receiveShadow = true;
  playbillGroup.add(billboardCase);

  // چهار بازوی قاب برنجی برجسته پیرامون پوستر (بدون هم‌پوشانی صفحه‌ای)
  for (const sy of [-1, 1] as const) {
    const hTrim = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.11, 3.06), antiqueBrassMat);
    hTrim.position.set(-0.49, -0.22 + sy * 1.16, 0);
    playbillGroup.add(hTrim);
  }
  for (const sz of [-1, 1] as const) {
    const vTrim = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.42, 0.11), antiqueBrassMat);
    vTrim.position.set(-0.49, -0.22, sz * 1.48);
    playbillGroup.add(vTrim);
  }

  // صفحهٔ پوستر با رزولوشن بالا، ۴.۵ سانتی‌متر جلوتر از تختهٔ پشتی، رو به +X در ارتفاع چشم بازیکن
  const posterPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.82, 2.18),
    new THREE.MeshStandardMaterial({
      map: playbillSign.texture,
      emissiveMap: playbillSign.texture,
      emissive: new THREE.Color(0xfff1d6),
      emissiveIntensity: 0.34,
      roughness: 0.56,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  posterPlane.rotation.y = Math.PI / 2;
  // فاصلهٔ صفحهٔ پوستر از دیوار از ماژول چیدمان می‌آید تا با جدول ردیف‌های سمت
  // راست دقیقاً یکی باشد (هر دو تابلو با یک فاصلهٔ مساوی به دیوار می‌چسبند).
  posterPlane.position.set(ALLEY_GUIDE_BOARD_SURFACE_X.playbill - anchors.playbill.x, -0.22, 0);
  posterPlane.name = 'PlaybillPosterTextMesh';
  playbillGroup.add(posterPlane);

  // کلاهک چراغ برنجی بالای تابلو تا متن پوستر همیشه کاملاً روشن و خوانا باشد
  const playbillHood = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 1.1, 12), antiqueBrassMat);
  playbillHood.rotation.x = Math.PI / 2;
  playbillHood.position.set(-0.28, 1.06, 0);
  playbillGroup.add(playbillHood);

  group.add(playbillGroup);

  // --- ب) اتاقک گیشهٔ مکانیکی برنجی متصل به دیوار راست و جدول تبدیل ردیف (رو به -X) ---
  const boothGroup = new THREE.Group();
  boothGroup.name = 'TicketBoothGroup';
  // کل اتاقک گیشه به اندازهٔ لازم به دیوار راست نزدیک می‌شود تا سطح جدول ردیف‌ها
  // دقیقاً هم‌فاصلهٔ پوستر چپ از دیوار چپ باشد؛ پیش‌تر گیشه حدود ۰٫۶۵ متر جلوتر
  // ایستاده بود و تابلو از دیوار فاصله داشت در حالی‌که پوستر چسبیده بود.
  boothGroup.position.x =
    ALLEY_GUIDE_BOARD_SURFACE_X.rowChart - (anchors.rowChart.x + ALLEY_ROW_CHART_LOCAL_OFFSET_X);

  const counter = new THREE.Mesh(
    withUv2(new THREE.BoxGeometry(2.05, 1.12, 3.05)),
    darkWoodMat,
  );
  counter.position.set(anchors.rowChart.x + 0.60, 0.56, anchors.rowChart.z);
  counter.name = 'RowChartCounter';
  counter.userData.anchorId = 'rowChart';
  counter.castShadow = true;
  counter.receiveShadow = true;
  boothGroup.add(counter);

  const marbleLedge = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.09, 3.24), stoneTrimMat);
  marbleLedge.position.set(anchors.rowChart.x + 0.54, 1.15, anchors.rowChart.z);
  marbleLedge.castShadow = true;
  boothGroup.add(marbleLedge);

  // قاب برنجی جدول، دقیقاً به همان الگوی ویترین چپ روی دیوار می‌نشیند:
  // صفحهٔ جدول ۴٫۵ سانتی‌متر جلوتر از قاب و لبهٔ قاب ۰٫۸۲ متر از دیوار.
  const boothFrameDepth = 1.92;
  const boothUpperFrame = new THREE.Mesh(new THREE.BoxGeometry(boothFrameDepth, 1.98, 2.98), antiqueBrassMat);
  boothUpperFrame.name = 'RowChartBrassFrame';
  boothUpperFrame.position.set(
    ALLEY_GUIDE_BOARD_SURFACE_X.rowChart
      + ALLEY_GUIDE_BOARD_FRAME_CLEARANCE
      + boothFrameDepth / 2
      - boothGroup.position.x,
    2.16,
    anchors.rowChart.z,
  );
  boothUpperFrame.castShadow = true;
  boothGroup.add(boothUpperFrame);

  const boothRoof = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.20, 3.38), darkIronMat);
  boothRoof.position.set(anchors.rowChart.x + 0.50, 3.22, anchors.rowChart.z);
  boothRoof.castShadow = true;
  boothGroup.add(boothRoof);

  // صفحهٔ اصلی جدول ردیف‌ها با متن واقعی و بسیار خوانا رو به -X (داخل کوچه، ۵ سانتی‌متر جلوتر از قاب)
  const chart = new THREE.Mesh(
    new THREE.PlaneGeometry(2.74, 1.82),
    new THREE.MeshStandardMaterial({
      map: rowChartSign.texture,
      emissiveMap: rowChartSign.texture,
      emissive: new THREE.Color(0xfff0d0),
      emissiveIntensity: 0.42,
      roughness: 0.42,
      metalness: 0.16,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  chart.rotation.y = -Math.PI / 2;
  chart.position.set(anchors.rowChart.x + ALLEY_ROW_CHART_LOCAL_OFFSET_X, 2.12, anchors.rowChart.z);
  chart.name = 'RowChartBoard';
  boothGroup.add(chart);

  group.add(boothGroup);

  // =========================================================================
  // ۶. تیرهای چراغ برق قدیمی با نور سوسوزن + کابل‌های هوایی + غبار معلق نور
  // =========================================================================
  const polesGroup = new THREE.Group();
  polesGroup.name = 'UtilityPolesGroup';

  const utilityPoles: UtilityPoleInstance[] = [
    // تیر برق ۱ — پیاده‌روی راست نزدیک اسپاون (لرزش عصبی ملایم)
    createUtilityPole({
      id: 'SouthRight',
      position: { x: 5.95, y: 0.13, z: 3.6 },
      armSide: -1,
      profile: 'nervous',
      seed: 1.7,
      baseIntensity: 13.5,
      castShadow: false,
      woodMaps: crateDarkWoodMaps,
      beamTexture,
      environmentMap,
      poolTexture: lampPoolTexture,
    }),
    // تیر برق ۲ — پیاده‌روی چپ میانهٔ کوچه (چراغ معیوب با اتصالی و سوسوزدن شدید + سایهٔ زنده!)
    createUtilityPole({
      id: 'MidLeftFlicker',
      position: { x: -5.95, y: 0.13, z: -3.8 },
      armSide: 1,
      profile: 'broken',
      seed: 4.3,
      baseIntensity: 18.0,
      castShadow: true,
      woodMaps: crateDarkWoodMaps,
      beamTexture,
      environmentMap,
      poolTexture: lampPoolTexture,
    }),
    // تیر برق ۳ — پیاده‌روی راست نزدیک تماشاخانه (نوسان کند حباب نیمه‌سوخته)
    createUtilityPole({
      id: 'NorthRight',
      position: { x: 5.95, y: 0.13, z: -10.2 },
      armSide: -1,
      profile: 'dying',
      seed: 8.9,
      baseIntensity: 12.0,
      castShadow: false,
      woodMaps: crateDarkWoodMaps,
      beamTexture,
      environmentMap,
      poolTexture: lampPoolTexture,
    }),
    // تیر برق ۴ — چهارمین چراغ کوچه در پیاده‌روی چپ، بین تیر چپ میانه و دسته‌جعبه‌های
    // شمالی (z=-9.8) یعنی «نزدیک تیرهای چپ و پیش از جعبه‌ها».
    // سبک گالوانیزهٔ کلاسیک: ستون کاملاً دایره‌ای، بازوی قوس‌دار لوله‌ای و سر چراغ
    // گرد با گوی شیشه‌ای مات (خواستهٔ بازبینی)
    createUtilityPole({
      id: 'MidLeftGalvanized',
      position: { x: -5.95, y: 0.13, z: -7.0 },
      armSide: 1,
      style: 'galvanized',
      profile: 'nervous',
      seed: 12.4,
      baseIntensity: 15.0,
      castShadow: false,
      woodMaps: crateDarkWoodMaps,
      beamTexture,
      environmentMap,
      poolTexture: lampPoolTexture,
    }),
  ];

  utilityPoles.forEach((pole) => polesGroup.add(pole.group));

  // ذرات مه و نم باران معلق زیر پرتو تیرهای چراغ برق (فقط ۱ draw call سبک)
  const moteCount = 90;
  const motePositions = new Float32Array(moteCount * 3);
  const moteBase = new Float32Array(moteCount * 3);
  const lampCenters: ReadonlyArray<[number, number, number]> = [
    [4.57, 2.6, 3.6],
    [-4.57, 2.6, -3.8],
    [4.57, 2.6, -10.2],
    // چراغ گالوانیزهٔ چهارم (پیاده‌روی چپ، پیش از جعبه‌های شمالی)
    [-4.73, 2.6, -7.0],
  ];
  for (let i = 0; i < moteCount; i++) {
    const [cx, cy, cz] = lampCenters[i % lampCenters.length];
    const h1 = Math.sin(i * 12.9898) * 43758.5453;
    const h2 = Math.sin(i * 78.233) * 24634.6345;
    const h3 = Math.sin(i * 39.425) * 19283.7465;
    const fx = (h1 - Math.floor(h1) - 0.5) * 2.8;
    const fy = (h2 - Math.floor(h2) - 0.5) * 3.4;
    const fz = (h3 - Math.floor(h3) - 0.5) * 2.8;
    moteBase[i * 3] = cx + fx;
    moteBase[i * 3 + 1] = Math.max(0.35, cy + fy);
    moteBase[i * 3 + 2] = cz + fz;
    motePositions[i * 3] = moteBase[i * 3];
    motePositions[i * 3 + 1] = moteBase[i * 3 + 1];
    motePositions[i * 3 + 2] = moteBase[i * 3 + 2];
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xffd7a2,
    size: 0.042,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const nightMotes = new THREE.Points(moteGeo, moteMat);
  nightMotes.name = 'StreetlampMistMotes';
  polesGroup.add(nightMotes);

  // کابل‌های برق هوایی بین مقره‌های چینی و ساختمان‌های دو طرف کوچه
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x101318,
    roughness: 0.65,
    metalness: 0.45,
  });

  const cableSpans: Array<[THREE.Vector3, THREE.Vector3, number]> = [
    [new THREE.Vector3(5.29, 6.02, 9.2), utilityPoles[0].insulatorWorldPositions[0], 0.34],
    [new THREE.Vector3(6.61, 6.02, 9.2), utilityPoles[0].insulatorWorldPositions[2], 0.38],
    [utilityPoles[0].insulatorWorldPositions[0], utilityPoles[2].insulatorWorldPositions[0], 0.72],
    [utilityPoles[0].insulatorWorldPositions[1], utilityPoles[2].insulatorWorldPositions[1], 0.65],
    [utilityPoles[0].insulatorWorldPositions[2], utilityPoles[2].insulatorWorldPositions[2], 0.78],
    [utilityPoles[0].insulatorWorldPositions[0], utilityPoles[1].insulatorWorldPositions[2], 0.62],
    [utilityPoles[1].insulatorWorldPositions[1], utilityPoles[2].insulatorWorldPositions[0], 0.58],
    [utilityPoles[1].insulatorWorldPositions[0], new THREE.Vector3(-8.6, 5.4, -9.8), 0.36],
    [utilityPoles[1].insulatorWorldPositions[2], new THREE.Vector3(8.6, 5.6, -2.8), 0.54],
    [utilityPoles[2].insulatorWorldPositions[1], new THREE.Vector3(0.0, 5.3, -13.3), 0.30],
    // کابل‌های چراغ گالوانیزهٔ چهارم: وصل به تیر چپ میانه و به جعبه‌های شمالی
    [utilityPoles[3].insulatorWorldPositions[0], utilityPoles[1].insulatorWorldPositions[0], 0.42],
    [utilityPoles[3].insulatorWorldPositions[1], new THREE.Vector3(-8.55, 5.7, -10.4), 0.28],
    [utilityPoles[3].insulatorWorldPositions[2], new THREE.Vector3(-5.95, 5.55, -13.2), 0.5],
  ];

  for (const [from, to, sag] of cableSpans) {
    polesGroup.add(createOverheadCable(from, to, sag, cableMat));
  }

  group.add(polesGroup);

  // =========================================================================
  // ۷. جعبه‌های چوبی، پالت‌ها و بشکه‌های تدارکات تئاتر (با برخورد دقیق در collision.ts)
  // =========================================================================
  const cratesGroup = new THREE.Group();
  cratesGroup.name = 'AlleyCratesGroup';

  // دسته A: پیاده‌روی چپ بین اسپاون و تابلوی اعلانات (x ≈ -7.45, z ≈ +3.4)
  const clusterA = new THREE.Group();
  clusterA.name = 'CrateCluster_LeftSouth';
  clusterA.position.set(-7.45, 0.13, 3.4);
  clusterA.add(createWoodenPallet(1.75, 1.95, crateTrimMat));
  const cA1 = createWoodenCrateMesh(1.05, 0.96, 1.02, cratePlankMat, crateTrimMat, darkIronMat);
  cA1.position.set(-0.22, 0.60, -0.34);
  cA1.rotation.y = 0.08;
  const cA2 = createWoodenCrateMesh(0.86, 0.82, 0.84, cratePlankMat, crateTrimMat, darkIronMat);
  cA2.position.set(0.32, 0.53, 0.48);
  cA2.rotation.y = -0.22;
  const cA3 = createWoodenCrateMesh(0.76, 0.68, 0.74, cratePlankMat, crateTrimMat, darkIronMat);
  cA3.position.set(-0.14, 1.42, -0.28);
  cA3.rotation.y = 0.34;
  clusterA.add(cA1, cA2, cA3);
  cratesGroup.add(clusterA);

  // دسته B: پیاده‌روی راست بعد از گیشه، زیر نور سوسوزن وسط کوچه (x ≈ +7.45, z ≈ -6.4)
  const clusterB = new THREE.Group();
  clusterB.name = 'CrateCluster_RightMid';
  clusterB.position.set(7.45, 0.13, -6.4);
  clusterB.add(createWoodenPallet(1.8, 2.1, crateTrimMat));
  const cB1 = createWoodenCrateMesh(1.14, 1.08, 1.08, cratePlankMat, crateTrimMat, darkIronMat);
  cB1.position.set(0.18, 0.66, -0.36);
  cB1.rotation.y = -0.06;
  const cB2 = createWoodenCrateMesh(0.78, 0.72, 0.78, cratePlankMat, crateTrimMat, darkIronMat);
  cB2.position.set(-0.34, 0.48, 0.58);
  cB2.rotation.y = 0.28;
  const cB3 = createWoodenCrateMesh(0.84, 0.76, 0.82, cratePlankMat, crateTrimMat, darkIronMat);
  cB3.position.set(0.12, 1.58, -0.32);
  cB3.rotation.y = -0.31;
  const barrelB = createRustyBarrel(darkIronMat, 0x4b2f24);
  barrelB.position.set(-0.42, 0, -1.02);
  clusterB.add(cB1, cB2, cB3, barrelB);
  cratesGroup.add(clusterB);

  // دسته C: گوشهٔ چپ نزدیک عمارت تماشاخانه (x ≈ -7.35, z ≈ -9.8)
  const clusterC = new THREE.Group();
  clusterC.name = 'CrateCluster_LeftNorth';
  clusterC.position.set(-7.35, 0.13, -9.8);
  const cC1 = createWoodenCrateMesh(1.18, 1.12, 1.12, cratePlankMat, crateTrimMat, darkIronMat);
  cC1.position.set(-0.18, 0.56, 0.28);
  cC1.rotation.y = 0.12;
  const cC2 = createWoodenCrateMesh(0.88, 0.84, 0.86, cratePlankMat, crateTrimMat, darkIronMat);
  cC2.position.set(0.36, 0.42, -0.62);
  cC2.rotation.y = -0.36;
  const barrelC = createRustyBarrel(darkIronMat, 0x2f3b3a);
  barrelC.position.set(0.42, 0, 0.82);
  clusterC.add(cC1, cC2, barrelC);
  cratesGroup.add(clusterC);

  // دسته D: گوشهٔ راست نزدیک دروازهٔ پشتی (x ≈ +7.45, z ≈ +5.7)
  const clusterD = new THREE.Group();
  clusterD.name = 'CrateCluster_RightSouth';
  clusterD.position.set(7.45, 0.13, 5.7);
  const cD1 = createWoodenCrateMesh(1.02, 0.94, 0.98, cratePlankMat, crateTrimMat, darkIronMat);
  cD1.position.set(0.16, 0.47, 0);
  cD1.rotation.y = -0.18;
  const cD2 = createWoodenCrateMesh(0.74, 0.66, 0.74, cratePlankMat, crateTrimMat, darkIronMat);
  cD2.position.set(-0.34, 0.33, -0.68);
  cD2.rotation.y = 0.42;
  clusterD.add(cD1, cD2);
  cratesGroup.add(clusterD);

  group.add(cratesGroup);

  // =========================================================================
  // ۸. نورپردازی فیزیکی لایه‌ای با تضاد سرد مهتاب و گرم کهربایی چراغ‌های سوسوزن
  // =========================================================================
  const lights: THREE.Light[] = [];

  const hemi = new THREE.HemisphereLight(0x526fa8, 0x1e1712, 0.68);
  hemi.name = 'AlleyNightHemisphereLight';
  group.add(hemi);
  lights.push(hemi);

  const moon = new THREE.DirectionalLight(0xa4c0ff, 1.15);
  moon.name = 'AlleyMoonDirectionalLight';
  moon.position.copy(ALLEY_MOON_DIRECTION).multiplyScalar(24);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 52;
  moon.shadow.camera.left = -14;
  moon.shadow.camera.right = 14;
  moon.shadow.camera.top = 18;
  moon.shadow.camera.bottom = -18;
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.02;
  group.add(moon);
  lights.push(moon);

  utilityPoles.forEach((pole) => lights.push(pole.spotLight));

  const doorSpot = new THREE.SpotLight(0xffcb88, 14.0, 16, Math.PI / 4.2, 0.55, 1.4);
  doorSpot.name = 'TheaterEntranceSpotLight';
  doorSpot.position.set(0, 4.15, anchors.theaterDoor.z + 1.55);
  doorSpot.target = door;
  doorSpot.castShadow = false;
  group.add(doorSpot);
  lights.push(doorSpot);

  const playbillLamp = new THREE.PointLight(0xffdfad, 3.6, 7.5, 1.6);
  playbillLamp.name = 'PlaybillReadingLight';
  // چراغ مطالعهٔ هر دو تابلو دقیقاً هم‌فاصله از سطح خودشان است (قرینهٔ کامل)
  playbillLamp.position.set(ALLEY_GUIDE_LAMP_X.playbill, anchors.playbill.y + 0.85, anchors.playbill.z);
  group.add(playbillLamp);
  lights.push(playbillLamp);

  const rowChartLamp = new THREE.PointLight(0xffdfad, 3.6, 7.5, 1.6);
  rowChartLamp.name = 'RowChartReadingLight';
  rowChartLamp.position.set(ALLEY_GUIDE_LAMP_X.rowChart, anchors.rowChart.y + 0.85, anchors.rowChart.z);
  group.add(rowChartLamp);
  lights.push(rowChartLamp);

  // =========================================================================
  // ۹. حلقهٔ انیمیشن زنده و آزادسازی کامل حافظهٔ GPU
  // =========================================================================
  let disposed = false;

  const update = (_deltaSeconds: number, elapsedSeconds: number) => {
    if (disposed) return;
    sky.update(elapsedSeconds);
    for (const pole of utilityPoles) {
      pole.update(elapsedSeconds);
    }

    if (Number.isFinite(elapsedSeconds)) {
      const marqueePulse = 0.94 + 0.06 * Math.sin(elapsedSeconds * 5.3) * Math.cos(elapsedSeconds * 11.7);
      doorSpot.intensity = 14.0 * marqueePulse;

      // شناور بودن آرام ذرات غبار و نم باران زیر نور چراغ‌ها
      const attr = moteGeo.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < moteCount; i++) {
        const bx = moteBase[i * 3];
        const by = moteBase[i * 3 + 1];
        const bz = moteBase[i * 3 + 2];
        arr[i * 3] = bx + Math.sin(elapsedSeconds * 0.65 + i * 1.3) * 0.14;
        arr[i * 3 + 1] = Math.max(0.25, by - ((elapsedSeconds * 0.22 + i * 0.37) % 1.8) + 0.9);
        arr[i * 3 + 2] = bz + Math.cos(elapsedSeconds * 0.55 + i * 0.9) * 0.14;
      }
      attr.needsUpdate = true;
    }
  };

  const updateClues = (clues: AlleySignCluesData, players?: readonly AlleyPlayerLampStatus[]) => {
    if (disposed) return;
    playbillSign.redraw(clues);
    rowChartSign.redraw(clues);
    rebuildPlayerStatusLamps(players, clues.requiredCount, clues.punchedCount);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;

    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();

    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry && !disposedGeos.has(mesh.geometry)) {
        disposedGeos.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) {
        const list = Array.isArray(mat) ? mat : [mat];
        for (const m of list) {
          if (!disposedMats.has(m)) {
            disposedMats.add(m);
            m.dispose();
          }
        }
      }
    });

    sky.dispose();
    cobbleMaps.dispose();
    flagstoneMaps.dispose();
    brickWarmMaps.dispose();
    brickSlateMaps.dispose();
    theaterStoneMaps.dispose();
    crateLightWoodMaps.dispose();
    crateDarkWoodMaps.dispose();
    beamTexture.dispose();
    lampPoolTexture.dispose();
    puddleMaskA.dispose();
    puddleMaskB.dispose();
    dampRingMaskA.dispose();
    dampRingMaskB.dispose();
    dampRingMats.forEach((material) => material.dispose());
    dampRingMats.clear();
    playbillSign.dispose();
    rowChartSign.dispose();
    marqueeSign.dispose();
    streetPlaqueTex.dispose();
    environmentMap.dispose();
  };

  return {
    group,
    anchors,
    bounds,
    lights,
    environmentMap,
    update,
    updateClues,
    dispose,
  };
}
