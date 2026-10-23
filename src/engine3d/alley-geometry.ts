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
 *    + کوچهٔ **L‌شکل**: نرده/دروازهٔ پشتی برداشته شد، شاخهٔ اصلی دو برابر شد و در
 *      انتهای جنوبی یک فرعیِ بن‌بست به سمتِ چپ (غرب) باز می‌شود (منبع: `alley-layout.ts`)
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
import {
  ALLEY_BRANCH,
  ALLEY_BRANCH_ROWS,
  ALLEY_EAST,
  ALLEY_EAST_ROWS,
  ALLEY_ENTRANCE_STREET,
  ALLEY_LENGTHS,
  ALLEY_MAIN,
  ALLEY_THEATER,
} from './alley-layout';
import { alleyGroundCrownAt } from './alley-ground-profile';
import {
  ALLEY_FACADE_BASE_X,
  ALLEY_GUIDE_BOARD_FRAME_CLEARANCE,
  ALLEY_GUIDE_BOARD_SURFACE_X,
  ALLEY_GUIDE_LAMP_X,
  ALLEY_GUIDE_WALL_INSET,
  ALLEY_GUIDE_BOARD_SURFACE,
  ALLEY_GUIDE_LAMP,
  ALLEY_ROW_CHART_LOCAL_OFFSET_X,
} from './alley-guide-layout';
import {
  ALLEY_MOON_DIRECTION,
  createAlleyEnvironmentMap,
  createAlleySkyDome,
} from './alley-sky';
import {
  createBrickWallMaps,
  createFlagstoneMaps,
  createLobbyDoorWoodMaps,
  createPuddleAlphaMap,
  createPuddleDampRingAlphaMap,
  createWoodPlankMaps,
  withUv2,
} from './alley-materials';
import {
  COBBLE,
  COBBLE_GROUND_SEGMENTS,
  buildCobbleField,
  cobblestoneSurfaceMaps,
} from './alley-cobblestone';
import { CURTAIN, buildCurtainGeometry, createCurtainFabricMaps } from './alley-window-curtain';
import {
  WINDOW_ARCHITECTURE,
  buildTheaterWindowArchitecture,
} from './theater-window-architecture';
import { createEntranceTorch, type EntranceTorchInstance } from './alley-entrance-torch';
import {
  LOBBY_DOOR,
  LOBBY_DOOR_STATUS_LAMPS,
  createLobbyDoor,
  type LobbyDoorInstance,
} from './alley-lobby-door';
import {
  DEFAULT_ALLEY_SIGN_CLUES,
  createPlaybillSignTexture,
  createRowChartSignTexture,
  createStreetPlaqueTexture,
  createTheaterMarqueeTexture,
  type AlleySignCluesData,
} from './alley-signs';
import {
  createLampHaloAlphaTexture,
  createLampPoolAlphaTexture,
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

/**
 * ردیفِ ساختمان‌های سمتِ چپ (غرب). در نقشهٔ L این ردیف تا دهانهٔ فرعی می‌آید و
 * همان‌جا قطع می‌شود؛ دیوارِ شمالیِ فرعی کارِ ردیفِ فرعی است.
 */
const LEFT_BUILDINGS: readonly BuildingSpec[] = [
  { zCenter: -10.5, length: 6.8, height: 10.6, xInset: 0.0, variant: 0, floors: 3, hasBalcony: true, litWindowFloor: 2 },
  { zCenter: -3.4, length: 7.5, height: 9.2, xInset: ALLEY_GUIDE_WALL_INSET.left, variant: 1, floors: 3 },
  { zCenter: 4.1, length: 7.6, height: 11.2, xInset: -0.06, variant: 0, floors: 4, hasBalcony: true, litWindowFloor: 3 },
  { zCenter: 12.2, length: 8.8, height: 9.8, xInset: 0.10, variant: 1, floors: 3 },
  // از z = ۱۵٫۲ تا ۱۹٫۵ — بعد از آن بدنهٔ سنگیِ تئاتر گوشهٔ L را تا دیوارِ فرعی
  // پر می‌کند (بدنهٔ تئاتر از z = ۱۹٫۵ تا ۲۱٫۱ می‌رود)
  { zCenter: 17.35, length: 4.3, height: 10.9, xInset: -0.04, variant: 0, floors: 4, hasBalcony: true, litWindowFloor: 2 },
];

/**
 * ردیفِ راست (شرقِ شاخهٔ اصلی). بازبینیِ امیر: «سمتِ راستِ کوچه هم قرینهٔ فرعی
 * اضافه شود» ⇒ این ردیف دیگر تا انتهای جنوبی نمی‌رود؛ در `z = ۱۸` (دیوارِ
 * شمالیِ خیابانِ شرقی) قطع می‌شود تا دهانهٔ خیابان باز بماند و ادامهٔ آن بلوک،
 * ردیفِ شمالیِ خودِ خیابان است.
 */
const RIGHT_BUILDINGS: readonly BuildingSpec[] = [
  { zCenter: -10.2, length: 7.4, height: 9.6, xInset: 0.08, variant: 1, floors: 3, hasBalcony: true },
  { zCenter: -2.6, length: 7.9, height: 11.4, xInset: ALLEY_GUIDE_WALL_INSET.right, variant: 0, floors: 4, litWindowFloor: 2 },
  { zCenter: 5.0, length: 7.4, height: 8.9, xInset: 0.12, variant: 1, floors: 3, hasBalcony: true },
  { zCenter: 12.4, length: 7.6, height: 10.4, xInset: 0.0, variant: 0, floors: 3, litWindowFloor: 2 },
  // گوشهٔ بلوک: از ۱۶٫۲ تا ۱۸٫۰ — دقیقاً تا دیوارِ شمالیِ خیابان
  { zCenter: 17.1, length: 1.8, height: 11.2, xInset: 0.04, variant: 1, floors: 4, litWindowFloor: 2 },
];

/**
 * ردیف‌های فرعیِ غربی. همان سازندهٔ ردیف‌های بالا با گروهِ ۹۰ درجه چرخیده؛ پس
 * `zCenter` اینجا در واقع فاصله در راستای x است و منفی‌ها به سمت غرب می‌روند.
 * گوشهٔ شمال‌شرقی از ساختمانِ گوشهٔ کوچهٔ اصلی پوشیده می‌شود (تا x = −۱۱٫۹۲).
 */
// دیوارِ شمالیِ فرعی حالا تقریباً تمامش نمای تماشاخانه است؛ فقط نواری در غربِ
// نما (بین لبهٔ غربیِ تئاتر و دیوارِ بن‌بست) ساختمانِ آجری می‌گیرد
const BRANCH_NORTH_BUILDINGS: readonly BuildingSpec[] = [
  { zCenter: -30.2, length: 4.6, height: 10.6, xInset: 0.04, variant: 1, floors: 3, litWindowFloor: 1 },
];

/**
 * ردیفِ بستهٔ انتهای شمالیِ شاخهٔ اصلی. پیش‌تر خودِ نمای تئاتر این سرِ کوچه را
 * می‌بست؛ حالا که نما به فرعی منتقل شده، سه ساختمانِ آجریِ عادی جایش را می‌گیرند.
 */
const NORTH_END_BUILDINGS: readonly BuildingSpec[] = [
  { zCenter: 8.0, length: 8.4, height: 11.2, xInset: 0.0, variant: 1, floors: 4, litWindowFloor: 2 },
  { zCenter: 0.0, length: 8.4, height: 9.6, xInset: 0.05, variant: 0, floors: 3, hasBalcony: true },
  { zCenter: -8.0, length: 8.4, height: 10.8, xInset: -0.04, variant: 1, floors: 3, litWindowFloor: 1 },
];

/**
 * ردیف‌های خیابانِ شرقیِ باز. مثلِ ردیف‌های فرعی در گروهِ ۹۰ درجه چرخیده ساخته
 * می‌شوند، پس `zCenter` اینجا در واقع فاصله در راستای x است و اعدادِ مثبت به
 * شرق می‌روند. ردیف تا `viewEndX` (۴۴) ادامه دارد تا انتهای خیابان در مه محو
 * شود و دیوارِ بن‌بست دیده نشود.
 */
const EAST_NORTH_BUILDINGS: readonly BuildingSpec[] = [
  { zCenter: 12.6, length: 7.6, height: 12.6, xInset: 0.02, variant: 0, floors: 4, litWindowFloor: 2 },
  { zCenter: 21.0, length: 9.2, height: 10.8, xInset: 0.08, variant: 1, floors: 3, hasBalcony: true, litWindowFloor: 1 },
  { zCenter: 30.5, length: 9.6, height: 13.4, xInset: -0.04, variant: 0, floors: 4, litWindowFloor: 3 },
  { zCenter: 40.0, length: 9.4, height: 11.6, xInset: 0.05, variant: 1, floors: 4, litWindowFloor: 1 },
  { zCenter: 49.4, length: 8.6, height: 12.8, xInset: 0.0, variant: 0, floors: 4 },
];

const EAST_SOUTH_BUILDINGS: readonly BuildingSpec[] = [
  { zCenter: 12.2, length: 7.0, height: 10.2, xInset: 0.05, variant: 1, floors: 3, hasBalcony: true },
  { zCenter: 20.0, length: 8.6, height: 13.2, xInset: 0.0, variant: 0, floors: 4, litWindowFloor: 2 },
  { zCenter: 29.4, length: 10.2, height: 11.8, xInset: -0.03, variant: 1, floors: 4, litWindowFloor: 1 },
  { zCenter: 39.6, length: 10.0, height: 9.8, xInset: 0.06, variant: 0, floors: 3, hasBalcony: true },
  { zCenter: 49.4, length: 9.2, height: 12.4, xInset: 0.0, variant: 1, floors: 4 },
];

const BRANCH_SOUTH_BUILDINGS: readonly BuildingSpec[] = [
  { zCenter: 5.5, length: 6.8, height: 10.8, xInset: 0.0, variant: 1, floors: 3, hasBalcony: true, litWindowFloor: 1 },
  { zCenter: -1.1, length: 6.8, height: 9.7, xInset: 0.06, variant: 0, floors: 3, litWindowFloor: 2 },
  { zCenter: -8.1, length: 7.6, height: 11.9, xInset: -0.04, variant: 1, floors: 4 },
  { zCenter: -15.7, length: 7.8, height: 10.1, xInset: 0.05, variant: 0, floors: 3, hasBalcony: true },
  { zCenter: -23.7, length: 8.2, height: 12.4, xInset: 0.0, variant: 1, floors: 4, litWindowFloor: 2 },
  { zCenter: -30.2, length: 5.2, height: 11.2, xInset: 0.03, variant: 0, floors: 3 },
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

  // سنگ‌فرش کف: یک میدانِ ارتفاع، دو مصرف‌کننده — نقشه‌های PBR و جابه‌جاییِ
  // رأس‌های کف (امیر: سنگ‌ها باید ترازِ واقعاً متفاوت داشته باشند، نه فقط سایه)
  const cobbleField = buildCobbleField(COBBLE.textureSize);
  const cobbleMaps = cobblestoneSurfaceMaps(cobbleField, COBBLE.repeatX, COBBLE.repeatY);
  // پیاده‌رو و سنگ‌تراشِ نما هم دو برابرِ قبل پیکسل می‌گیرد (۱۲۸ → ۲۵۶)؛ با
  // بافتِ تیزِ کف، تکسچرِ ۱۲ پیکسلی کنارش مات و بی‌کیفیت دیده می‌شد
  const flagstoneMaps = createFlagstoneMaps(2, 16, 256);
  const brickWarmMaps = createBrickWallMaps(0x6b4536, 3.5, 4.5, 256, 101);
  const brickSlateMaps = createBrickWallMaps(0x4e4a52, 3.2, 4.2, 256, 233);
  const theaterStoneMaps = createBrickWallMaps(0x5c534c, 5.5, 4.5, 256, 379);
  const crateLightWoodMaps = createWoodPlankMaps(0x7c5a3a, 128);
  const crateDarkWoodMaps = createWoodPlankMaps(0x563c27, 128);
  // چوب اختصاصی درِ لابی: ۵۱۲ پیکسل، بی‌درز تخته، با رگه و منافذ ریز
  const lobbyDoorWoodMaps = createLobbyDoorWoodMaps();
  // هالهٔ نرم نور روی سنگ‌فرش، یک تکسچر مشترک برای هر چهار چراغ (یک draw call)
  const lampPoolTexture = createLampPoolAlphaTexture(71, 128);
  // هالهٔ گردِ دور سر چراغ‌ها — یک تکسچر مشترک برای هشت اسپرایت (دو لایه × چهار چراغ)
  const lampHaloTexture = createLampHaloAlphaTexture(311, 128);
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

  // سطح هر دو تابلوی راهنما (پوستر چپ و جدول راست) از یک دستور ساخته می‌شود تا
  // جنس و درخشششان دقیقاً یکی باشد؛ پیش‌تر جدول راست براق‌تر بود و هالهٔ نورش
  // با پوستر چپ فرق داشت
  const createGuideBoardSurfaceMaterial = (texture: THREE.Texture) =>
    new THREE.MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: new THREE.Color(ALLEY_GUIDE_BOARD_SURFACE.emissive),
      emissiveIntensity: ALLEY_GUIDE_BOARD_SURFACE.emissiveIntensity,
      roughness: ALLEY_GUIDE_BOARD_SURFACE.roughness,
      metalness: ALLEY_GUIDE_BOARD_SURFACE.metalness,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
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
    normalScale: new THREE.Vector2(1.6, 1.6),
    roughnessMap: cobbleMaps.roughnessMap,
    aoMap: cobbleMaps.aoMap,
    aoMapIntensity: 1.05,
    roughness: 0.96,
    metalness: 0.015,
    envMap: environmentMap,
    envMapIntensity: 0.16,
  });

  // شاخهٔ اصلی دو برابر شده است: از −۲۳٫۵ تا ۳۲٫۵ (۵۶ متر). بافتِ سنگ‌فرش نباید
  // کشیده شود، پس uv در راستای طول به نسبتِ ۵۶/۴۲ بزرگ می‌شود تا کاشی‌ها همان
  // ۳٫۳ × ۴٫۲ مترِ قبلی بمانند.
  const groundLength = ALLEY_MAIN.groundSouthZ - ALLEY_MAIN.groundNorthZ;
  const groundCenterZ = (ALLEY_MAIN.groundSouthZ + ALLEY_MAIN.groundNorthZ) / 2;
  const groundSegmentsY = Math.round((COBBLE_GROUND_SEGMENTS.y * groundLength) / 42);
  const groundGeo = withUv2(
    new THREE.PlaneGeometry(
      ALLEY_MAIN.roadHalfWidth * 2,
      groundLength,
      COBBLE_GROUND_SEGMENTS.x,
      groundSegmentsY,
    ),
  );
  {
    // همان مقیاسِ کاشیِ قبلی (۴۲ متر با تکرارِ ۱۰) روی طولِ تازه
    const uv = groundGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (groundLength / 42));
    uv.needsUpdate = true;
  }
  // قوس بسیار ملایم تاج کوچه برای هدایت طبیعی آب باران به جوی کنار جدول
  // (منبع مشترک با هالهٔ نور چراغ‌ها در alley-ground-profile.ts)
  //
  // روی همان تاج، ترازِ هر سنگِ کف هم سوار می‌شود (`COBBLE.relief`): ترازِ
  // بلندِ کف روی صفر است و نشسته‌ترین سنگ پنج سانتی‌متر فرو می‌رود. جهتِ
  // جابه‌جایی عمداً فقط روپایین است — تا چاله‌های آب، هالهٔ نور چراغ‌ها و
  // درِ منهول که روی همین سطح نشسته‌اند زیرِ سنگ نروند.
  //
  // `sampleLevel` خودش حولِ u=۰ آینه است و `repeatX` زوج ⇒ شبکهٔ رأس‌ها هم
  // دورِ محورِ کوچه قرینه می‌شود (تستِ `cobblestone-relief` همین را می‌گیرد)،
  // پس دو طرفِ کوچه دو چینیِ بی‌ربط نیستند.
  const posAttr = groundGeo.attributes.position;
  const uvAttr = groundGeo.attributes.uv;
  for (let i = 0; i < posAttr.count; i++) {
    const level = cobbleField.sampleLevel(
      uvAttr.getX(i) * COBBLE.repeatX,
      uvAttr.getY(i) * COBBLE.repeatY,
    );
    posAttr.setZ(i, alleyGroundCrownAt(posAttr.getX(i)) + COBBLE.relief * (level - 1));
  }
  posAttr.needsUpdate = true;
  groundGeo.computeVertexNormals();

  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, groundCenterZ);
  ground.receiveShadow = true;
  ground.name = 'Ground';
  floorGroup.add(ground);

  // ------------------------------------------------------ کفِ فرعیِ غربی
  // همان سنگ‌فرش با همان تراکم؛ محورِ عرضِ فرعی در راستای z است، پس تاجِ کف و
  // جای‌گذاریِ رأس‌ها هم حولِ `centerZ` حساب می‌شوند.
  const branchLength = ALLEY_BRANCH.groundEastX - ALLEY_BRANCH.groundWestX;
  const branchWidth = ALLEY_BRANCH.southZ - ALLEY_BRANCH.northZ;
  const branchCenterX = (ALLEY_BRANCH.groundEastX + ALLEY_BRANCH.groundWestX) / 2;
  const branchGeo = withUv2(
    new THREE.PlaneGeometry(
      branchLength,
      branchWidth,
      Math.round((COBBLE_GROUND_SEGMENTS.x * branchLength) / 13.2),
      Math.round((COBBLE_GROUND_SEGMENTS.y * branchWidth) / 42),
    ),
  );
  {
    // uv را در دو راستا به نسبتِ ابعاد بزرگ می‌کنیم تا سنگ‌ها هم‌اندازهٔ کوچهٔ اصلی بمانند
    const uv = branchGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setX(i, uv.getX(i) * (branchLength / 13.2));
      uv.setY(i, uv.getY(i) * (branchWidth / 42));
    }
    uv.needsUpdate = true;
  }
  {
    const pos = branchGeo.attributes.position;
    const uv = branchGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const level = cobbleField.sampleLevel(
        uv.getX(i) * COBBLE.repeatX,
        uv.getY(i) * COBBLE.repeatY,
      );
      // کفِ فرعی عمداً تخت است: تیرهای چراغِ این فرعی ۹۰ درجه چرخیده‌اند و
      // هالهٔ نورشان تاجِ کف را در محور x حساب می‌کند؛ با کفِ تخت، لکهٔ نور
      // ذره‌ای هم بالاتر/پایین‌تر از سنگ‌فرش نمی‌نشیند.
      pos.setZ(i, COBBLE.relief * (level - 1));
    }
    pos.needsUpdate = true;
    branchGeo.computeVertexNormals();
  }
  const branchGround = new THREE.Mesh(branchGeo, groundMat);
  branchGround.rotation.x = -Math.PI / 2;
  branchGround.position.set(branchCenterX, 0, (ALLEY_BRANCH.southZ + ALLEY_BRANCH.northZ) / 2);
  branchGround.receiveShadow = true;
  branchGround.name = 'BranchGround';
  floorGroup.add(branchGround);

  // ------------------------------------------------------ کفِ خیابانِ شرقی
  // آینهٔ همان کدِ کفِ فرعی: خیابان پهن‌تر است (۱۳ متر) و تا دوردستِ مه ادامه
  // دارد. کف عمداً **تخت** است (مثلِ فرعی) — تیرِ چراغِ خیابان ۹۰ درجه چرخیده و
  // هاله‌اش تاجِ کف را در محورِ x حساب می‌کند؛ کفِ تخت یعنی لکهٔ نور دقیقاً روی
  // سنگ‌فرش می‌نشیند.
  const eastLength = ALLEY_EAST.groundEastX - ALLEY_EAST.groundWestX;
  const eastWidth = ALLEY_EAST.southZ - ALLEY_EAST.northZ;
  const eastCenterX = (ALLEY_EAST.groundEastX + ALLEY_EAST.groundWestX) / 2;
  const eastGeo = withUv2(
    new THREE.PlaneGeometry(
      eastLength,
      eastWidth,
      Math.round((COBBLE_GROUND_SEGMENTS.x * eastLength) / 13.2),
      Math.round((COBBLE_GROUND_SEGMENTS.y * eastWidth) / 42),
    ),
  );
  {
    const uv = eastGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setX(i, uv.getX(i) * (eastLength / 13.2));
      uv.setY(i, uv.getY(i) * (eastWidth / 42));
    }
    uv.needsUpdate = true;
  }
  {
    const pos = eastGeo.attributes.position;
    const uv = eastGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const level = cobbleField.sampleLevel(
        uv.getX(i) * COBBLE.repeatX,
        uv.getY(i) * COBBLE.repeatY,
      );
      pos.setZ(i, COBBLE.relief * (level - 1));
    }
    pos.needsUpdate = true;
    eastGeo.computeVertexNormals();
  }
  const eastGround = new THREE.Mesh(eastGeo, groundMat);
  eastGround.rotation.x = -Math.PI / 2;
  eastGround.position.set(eastCenterX, 0, (ALLEY_EAST.southZ + ALLEY_EAST.northZ) / 2);
  eastGround.receiveShadow = true;
  eastGround.name = 'EastGround';
  floorGroup.add(eastGround);

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

  // پیاده‌رو و جدول در کوچهٔ L + خیابانِ شرقی:
  //   • سمتِ چپ پیش از دهانهٔ فرعی قطع می‌شود و در ده قدمِ آخرِ منتهی به پیچ،
  //     خیابان تا پای دیوار می‌آید (خیابانِ جلوی درِ تماشاخانه)
  //   • سمتِ راست هم در دهانهٔ خیابانِ شرقی (`z = ۱۸`) قطع می‌شود؛ از آن‌جا به
  //     بعد پیاده‌روی خودِ خیابان است که در راستای x می‌رود. پیش‌تر این نوار تا
  //     انتهای جنوبی یک‌سره بود و دهانهٔ خیابان را می‌بست.
  const sidewalkRuns: Array<{ side: -1 | 1; zStart: number; zEnd: number }> = [
    { side: -1, zStart: ALLEY_MAIN.groundNorthZ, zEnd: ALLEY_ENTRANCE_STREET.mainSidewalkEndZ },
    { side: 1, zStart: ALLEY_MAIN.groundNorthZ, zEnd: ALLEY_EAST.northZ },
  ];

  for (const run of sidewalkRuns) {
    const { side } = run;
    const runLength = run.zEnd - run.zStart;
    const runCenterZ = (run.zEnd + run.zStart) / 2;

    const walk = new THREE.Mesh(
      withUv2(new THREE.BoxGeometry(ALLEY_MAIN.sidewalkWidth, 0.13, runLength)),
      sidewalkMat,
    );
    walk.position.set(side * ALLEY_MAIN.sidewalkCenterX, 0.065, runCenterZ);
    walk.receiveShadow = true;
    walk.castShadow = true;
    walk.name = side < 0 ? 'SidewalkLeft' : 'SidewalkRight';
    floorGroup.add(walk);

    const curb = new THREE.Mesh(
      withUv2(new THREE.BoxGeometry(ALLEY_MAIN.curbWidth, 0.155, runLength)),
      stoneTrimMat,
    );
    curb.position.set(side * ALLEY_MAIN.curbX, 0.077, runCenterZ);
    curb.receiveShadow = true;
    curb.castShadow = true;
    curb.name = side < 0 ? 'CurbLeft' : 'CurbRight';
    floorGroup.add(curb);

    // جوی کنار جدول: دیگر یک آینهٔ بلند نیست؛ فقط یک شیار تیرهٔ مات که
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
    const gutterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(ALLEY_MAIN.gutterWidth, runLength - 4),
      gutter,
    );
    gutterMesh.rotation.x = -Math.PI / 2;
    gutterMesh.position.set(side * ALLEY_MAIN.gutterX, 0.018, runCenterZ);
    floorGroup.add(gutterMesh);
  }

  // --------------------------------------------- پیاده‌رو، جدول و جوی فرعی
  // فرعی عرضِ کم‌تری دارد (۹٫۸ متر)، پس پیاده‌روهایش باریک‌ترند؛ هندسه در راستای
  // x کشیده است و مرکزشان روی zِ پیاده‌رو می‌نشیند. پیاده‌روی شمالی فقط غربِ
  // خیابانِ جلوی در ادامه دارد (بقیه‌اش خیابان است).
  const branchWalkWestX = ALLEY_BRANCH.groundWestX;
  const branchSouthWalkEastX = 6.25;

  const branchWalks: Array<{
    id: string;
    centerZ: number;
    startX: number;
    endX: number;
  }> = [
    {
      // پیاده‌روی شمالی فقط غربِ خیابانِ جلوی در می‌ماند؛ از لبهٔ چپِ در تا گوشهٔ
      // L همان خیابان است، نه پیاده‌رو
      id: 'BranchSidewalkNorthWest',
      centerZ: ALLEY_BRANCH.northSidewalkCenterZ,
      startX: branchWalkWestX,
      endX: ALLEY_ENTRANCE_STREET.westEdgeX,
    },
    {
      id: 'BranchSidewalkSouth',
      centerZ: ALLEY_BRANCH.southSidewalkCenterZ,
      startX: branchWalkWestX,
      endX: branchSouthWalkEastX,
    },
  ];

  for (const walkSpec of branchWalks) {
    const length = walkSpec.endX - walkSpec.startX;
    const centerX = (walkSpec.endX + walkSpec.startX) / 2;
    const walk = new THREE.Mesh(
      withUv2(new THREE.BoxGeometry(length, 0.13, ALLEY_BRANCH.sidewalkWidth)),
      sidewalkMat,
    );
    walk.position.set(centerX, 0.065, walkSpec.centerZ);
    walk.receiveShadow = true;
    walk.castShadow = true;
    walk.name = walkSpec.id;
    floorGroup.add(walk);

    const curbZ =
      walkSpec.centerZ < ALLEY_BRANCH.centerZ
        ? ALLEY_BRANCH.northZ + ALLEY_BRANCH.sidewalkWidth
        : ALLEY_BRANCH.southZ - ALLEY_BRANCH.sidewalkWidth;
    const curb = new THREE.Mesh(
      withUv2(new THREE.BoxGeometry(length, 0.155, ALLEY_BRANCH.curbWidth)),
      stoneTrimMat,
    );
    curb.position.set(centerX, 0.077, curbZ);
    curb.receiveShadow = true;
    curb.castShadow = true;
    curb.name = `${walkSpec.id.replace('Sidewalk', 'Curb')}Curb`;
    floorGroup.add(curb);

    const gutterMat = new THREE.MeshStandardMaterial({
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
    const gutter = new THREE.Mesh(
      new THREE.PlaneGeometry(length - 3, ALLEY_BRANCH.gutterWidth),
      gutterMat,
    );
    gutter.rotation.x = -Math.PI / 2;
    gutter.position.set(
      centerX,
      0.018,
      curbZ + (walkSpec.centerZ < ALLEY_BRANCH.centerZ ? -0.34 : 0.34),
    );
    floorGroup.add(gutter);
  }

  // ------------------------------------ پیاده‌رو، جدول و جوی خیابانِ شرقی
  // قرینهٔ فرعی، فقط پهن‌تر (۲٫۶ متر) و بی‌بن‌بست: پیاده‌روها تا `viewEndX`
  // ادامه دارند تا انتهای خیابان در مه محو شود، نه اینکه دیوار بخورد.
  const eastWalks: Array<{ id: string; centerZ: number; startX: number; endX: number }> = [
    {
      id: 'EastSidewalkNorth',
      centerZ: ALLEY_EAST.northSidewalkCenterZ,
      startX: ALLEY_EAST.walkWestX,
      endX: ALLEY_EAST.viewEndX,
    },
    {
      id: 'EastSidewalkSouth',
      centerZ: ALLEY_EAST.southSidewalkCenterZ,
      startX: ALLEY_EAST.walkWestX,
      endX: ALLEY_EAST.viewEndX,
    },
  ];

  for (const walkSpec of eastWalks) {
    const length = walkSpec.endX - walkSpec.startX;
    const centerX = (walkSpec.endX + walkSpec.startX) / 2;
    const walk = new THREE.Mesh(
      withUv2(new THREE.BoxGeometry(length, 0.13, ALLEY_EAST.sidewalkWidth)),
      sidewalkMat,
    );
    walk.position.set(centerX, 0.065, walkSpec.centerZ);
    walk.receiveShadow = true;
    walk.castShadow = true;
    walk.name = walkSpec.id;
    floorGroup.add(walk);

    const isNorth = walkSpec.centerZ < ALLEY_EAST.centerZ;
    const curbZ = isNorth
      ? ALLEY_EAST.northZ + ALLEY_EAST.sidewalkWidth
      : ALLEY_EAST.southZ - ALLEY_EAST.sidewalkWidth;
    const curb = new THREE.Mesh(
      withUv2(new THREE.BoxGeometry(length, 0.155, ALLEY_EAST.curbWidth)),
      stoneTrimMat,
    );
    curb.position.set(centerX, 0.077, curbZ);
    curb.receiveShadow = true;
    curb.castShadow = true;
    curb.name = walkSpec.id.replace('Sidewalk', 'Curb');
    floorGroup.add(curb);

    const gutterMat = new THREE.MeshStandardMaterial({
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
    const gutter = new THREE.Mesh(
      new THREE.PlaneGeometry(length - 3, ALLEY_EAST.gutterWidth),
      gutterMat,
    );
    gutter.rotation.x = -Math.PI / 2;
    gutter.position.set(centerX, 0.018, curbZ + (isNorth ? 0.34 : -0.34));
    floorGroup.add(gutter);
  }

  // چاله‌های آب باران — تنها نقاط براق کف؛ بقیهٔ سنگ‌فرش خشک است
  const puddleSpecs: Array<{ x: number; z: number; rx: number; rz: number; rot: number; mask: THREE.DataTexture }> = [
    { x: -2.2, z: -4.2, rx: 2.7, rz: 3.6, rot: 0.25, mask: puddleMaskA },
    { x: 2.35, z: 2.1, rx: 2.5, rz: 3.3, rot: -0.4, mask: puddleMaskB },
    { x: -0.6, z: -9.6, rx: 2.9, rz: 2.6, rot: 0.62, mask: puddleMaskA },
    { x: 1.5, z: -2.1, rx: 2.0, rz: 2.5, rot: 1.05, mask: puddleMaskB },
    { x: -2.4, z: 4.9, rx: 2.2, rz: 2.7, rot: -0.75, mask: puddleMaskA },
    // چاله‌های امتدادِ تازهٔ جنوبی و فرعیِ غربی
    { x: -1.9, z: 12.8, rx: 2.6, rz: 3.2, rot: 0.42, mask: puddleMaskB },
    { x: 2.6, z: 23.4, rx: 2.4, rz: 3.0, rot: -0.28, mask: puddleMaskA },
    { x: -14.2, z: 26.4, rx: 3.0, rz: 2.5, rot: 0.9, mask: puddleMaskB },
    // چاله‌های خیابانِ شرقیِ باز
    { x: 13.5, z: 24.6, rx: 2.8, rz: 3.0, rot: -0.35, mask: puddleMaskA },
    { x: 26.0, z: 23.4, rx: 3.2, rz: 2.6, rot: 0.55, mask: puddleMaskB },
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

  /**
   * یک ردیفِ ساختمان را می‌سازد. برای فرعی، همین ردیف داخلِ یک گروهِ چرخیده
   * گذاشته می‌شود تا محورِ طولش شرق–غرب شود و همان جزئیاتِ نما (پنجره، بالکن،
   * دودکش، ناودان) بدون کدِ تکراری ساخته شوند.
   */
  const buildSideRow = (
    specs: readonly BuildingSpec[],
    side: -1 | 1,
    parent: THREE.Object3D = buildingsGroup,
    namePrefix?: string,
  ) => {
    specs.forEach((b, index) => {
      const bGroup = new THREE.Group();
      bGroup.name = `${namePrefix ?? (side < 0 ? 'BuildingLeft' : 'BuildingRight')}_${index}`;

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

      parent.add(bGroup);
    });
  };

  buildSideRow(LEFT_BUILDINGS, -1);
  buildSideRow(RIGHT_BUILDINGS, 1);

  // ------------------------------------------------ ردیف‌های ساختمان‌های فرعی
  // گروهِ ۹۰ درجه چرخیده: محورِ z محلی به +x جهانی و محورِ x محلی به −z جهانی
  // می‌رود، پس ردیف در راستای شرق–غرب کشیده می‌شود و نمای آن دقیقاً روی دیوارِ
  // فرعی می‌نشیند (جزئیات در `alley-layout.ts`).
  // ردیفِ انتهای شمالی: همان ردیفِ چرخیدهٔ فرعی، فقط روی z = −۱۳٫۲ تا دیوار را
  // رو به +Z (داخلِ کوچه) ببندد
  const northEndRow = new THREE.Group();
  northEndRow.name = 'NorthEndBuildings';
  northEndRow.rotation.y = ALLEY_BRANCH_ROWS.rotationY;
  northEndRow.position.set(0, 0, ALLEY_MAIN.northZ + ALLEY_MAIN.facadeX);
  buildingsGroup.add(northEndRow);
  buildSideRow(NORTH_END_BUILDINGS, ALLEY_BRANCH_ROWS.north.side, northEndRow, 'NorthEndBuilding');

  const branchNorthRow = new THREE.Group();
  branchNorthRow.name = 'BranchBuildingsNorth';
  branchNorthRow.rotation.y = ALLEY_BRANCH_ROWS.rotationY;
  branchNorthRow.position.set(0, 0, ALLEY_BRANCH_ROWS.north.groupZ);
  buildingsGroup.add(branchNorthRow);
  buildSideRow(BRANCH_NORTH_BUILDINGS, ALLEY_BRANCH_ROWS.north.side, branchNorthRow, 'BranchBuildingNorth');

  const branchSouthRow = new THREE.Group();
  branchSouthRow.name = 'BranchBuildingsSouth';
  branchSouthRow.rotation.y = ALLEY_BRANCH_ROWS.rotationY;
  branchSouthRow.position.set(0, 0, ALLEY_BRANCH_ROWS.south.groupZ);
  buildingsGroup.add(branchSouthRow);
  buildSideRow(BRANCH_SOUTH_BUILDINGS, ALLEY_BRANCH_ROWS.south.side, branchSouthRow, 'BranchBuildingSouth');

  // ---------------------------------------- ردیف‌های ساختمان‌های خیابانِ شرقی
  // همان سازندهٔ ردیف‌ها با گروهِ چرخیده، مثلِ فرعیِ غربی. ردیف تا `viewEndX`
  // ادامه دارد و در مه گم می‌شود — **هیچ دیوار یا درِ بن‌بستی ساخته نمی‌شود**.
  const eastNorthRow = new THREE.Group();
  eastNorthRow.name = 'EastBuildingsNorth';
  eastNorthRow.rotation.y = ALLEY_EAST_ROWS.rotationY;
  eastNorthRow.position.set(0, 0, ALLEY_EAST_ROWS.north.groupZ);
  buildingsGroup.add(eastNorthRow);
  buildSideRow(EAST_NORTH_BUILDINGS, ALLEY_EAST_ROWS.north.side, eastNorthRow, 'EastBuildingNorth');

  const eastSouthRow = new THREE.Group();
  eastSouthRow.name = 'EastBuildingsSouth';
  eastSouthRow.rotation.y = ALLEY_EAST_ROWS.rotationY;
  eastSouthRow.position.set(0, 0, ALLEY_EAST_ROWS.south.groupZ);
  buildingsGroup.add(eastSouthRow);
  buildSideRow(EAST_SOUTH_BUILDINGS, ALLEY_EAST_ROWS.south.side, eastSouthRow, 'EastBuildingSouth');

  // ساختمان‌های بستنِ دیدِ انتهای خیابان: یک بلوکِ سرِ خیابان در دوردست، پشتِ
  // مه و بی‌چراغ، تا بازیکن از مرزِ نقشه «لبهٔ دنیا» یا تهی نبیند. عمداً **نه
  // دیوارِ بن‌بست است و نه در** — فقط بافتِ شهر که خیابان جلویش می‌پیچد.
  const eastVanishingRow = new THREE.Group();
  eastVanishingRow.name = 'EastVanishingBuildings';
  const vanishingBlocks = [
    { x: 55.5, z: 15.4, width: 7.2, depth: 11.0, height: 13.8 },
    { x: 56.8, z: 24.0, width: 8.0, depth: 9.0, height: 10.2 },
    { x: 55.9, z: 32.8, width: 7.6, depth: 9.6, height: 15.0 },
    { x: 63.2, z: 20.6, width: 9.0, depth: 14.0, height: 11.4 },
    { x: 64.0, z: 31.0, width: 8.4, depth: 12.0, height: 14.2 },
  ] as const;
  vanishingBlocks.forEach((spec, i) => {
    const block = new THREE.Mesh(
      withUv2(new THREE.BoxGeometry(spec.width, spec.height, spec.depth)),
      i % 2 === 0 ? brickMatWarm : brickMatSlate,
    );
    block.position.set(spec.x, spec.height / 2, spec.z);
    block.castShadow = true;
    block.receiveShadow = true;
    eastVanishingRow.add(block);

    // یک پنجرهٔ کم‌نورِ تنها، تا حجم‌ها در مه مرده به‌نظر نرسند
    const lit = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), eerieLitWindowMat);
    lit.position.set(spec.x - spec.width / 2 - 0.02, spec.height * 0.55, spec.z);
    lit.rotation.y = -Math.PI / 2;
    eastVanishingRow.add(lit);
  });
  buildingsGroup.add(eastVanishingRow);

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
  // ۳. نمای باشکوه تماشاخانهٔ اُرفه‌ئو — روی دیوارِ شمالیِ فرعی (z = ۲۱٫۲)
  // =========================================================================
  // بازبینیِ امیر: «دربِ اصلی و نمای کلِ ساختمان که شاملِ پنجره‌ها و تابلو می‌شود
  // را ببر سمتِ چپِ اولِ ال.» نما از انتهای شمالیِ کوچه برداشته شد و روی دیوارِ
  // شمالیِ فرعیِ غربی، درست بعد از گوشهٔ L، نصب می‌شود؛ رو به +Z یعنی داخلِ فرعی.
  //
  // برای اینکه چیدمانِ داخلیِ نما (۱۹٫۲ متر عرض، ستون‌ها، سه پنجره، سردر و در)
  // دست‌نخورده بماند، همهٔ اجزا در مختصاتِ محلی ساخته می‌شوند (THEATER_X = ۰ و
  // THEATER_Z = ۰ همان لنگرِ در است) و خودِ گروه جابه‌جا می‌شود. چرخش لازم نیست،
  // چون نمای فرعی هم مثل نمای قبلی رو به +Z است.
  // =========================================================================
  const THEATER_X = 0;
  const THEATER_Z = 0;
  const theaterGroup = new THREE.Group();
  theaterGroup.name = 'TheaterFacadeGroup';
  // بدنهٔ سنگی ۱٫۶ متر عمق دارد و مرکزش ۰٫۹ عقب‌تر است؛ با این ۰٫۱ متر جابه‌جایی،
  // صفحۀ جلوی نما دقیقاً روی دیوارِ فرعی (۲۱٫۲) می‌نشیند و هیچ درزِ خالی زیرش نمی‌ماند
  theaterGroup.position.set(ALLEY_THEATER.doorX, 0, ALLEY_THEATER.wallZ + 0.1);

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

  // بدنهٔ عریض عمارت تماشاخانه: کلِ دیوارِ شمالیِ فرعی را پر می‌کند؛ لبهٔ شرقی‌اش
  // روی صفحۀ دیوارِ چپِ شاخهٔ اصلی و لبهٔ غربی‌اش روی مرزِ غربیِ فرعی می‌افتد
  const facadeMain = new THREE.Mesh(
    withUv2(new THREE.BoxGeometry(19.2, 11.6, 1.6)),
    theaterStoneMat,
  );
  facadeMain.position.set(THEATER_X, 5.8, THEATER_Z - 0.9);
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
  pediment.position.set(0, 11.55, THEATER_Z - 0.85);
  pediment.castShadow = true;
  theaterGroup.add(pediment);

  // چهار ستون کلاسیک سنگی در دو سوی ورودی تئاتر (بیرون‌آمده از نما، داخلِ فرعی)
  for (const colX of [-5.2, -2.55, 2.55, 5.2]) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.35, 8.6, 16), stoneTrimMat);
    shaft.position.set(colX, 4.5, THEATER_Z + 0.05);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    theaterGroup.add(shaft);

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.45, 0.86), stoneTrimMat);
    base.position.set(colX, 0.225, THEATER_Z + 0.05);
    theaterGroup.add(base);

    const capital = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.36, 0.92), antiqueBrassMat);
    capital.position.set(colX, 8.95, THEATER_Z + 0.05);
    theaterGroup.add(capital);
  }

  // پنجره‌های بلند قوسی در طبقهٔ دوم تماشاخانه (فاصلهٔ پاک از نما بدون Z-fighting):
  // پشتِ شیشهٔ سرخ، پردهٔ مخملِ چین‌دار آویزان است (امیر: پرده باید چین‌چینِ
  // عمودیِ ریز داشته باشد و بالا و پایینش حاله‌ای به سیاهی برود، نه قرمزِ صاف)
  const crimsonStainedMat = new THREE.MeshStandardMaterial({
    color: 0x5c111c,
    emissive: new THREE.Color(0x6e101c),
    emissiveIntensity: 0.55,
    roughness: 0.25,
  });
  crimsonStainedMat.name = 'TheaterCrimsonRecess';
  const curtainMaps = createCurtainFabricMaps();
  const curtainVelvetMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: curtainMaps.colorMap,
    normalMap: curtainMaps.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughnessMap: curtainMaps.roughnessMap,
    roughness: 1,
    metalness: 0,
    emissive: new THREE.Color(0x9c2130),
    emissiveMap: curtainMaps.glowMap,
    // نورِ پشتِ پرده: پرده از درون می‌درخشد (قرمزِ سیراب) و نوارِ دو سر چون
    // glowMap آنجا صفر است، بی‌نور و سیاه می‌ماند
    emissiveIntensity: 0.52,
    envMap: environmentMap,
    envMapIntensity: 0.06,
  });
  curtainVelvetMat.name = 'TheaterCurtainVelvet';
  // قابِ برنجیِ پنجره‌ها ۰٫۰۲ متر پس از لنگرِ در است؛ نیم‌ستون‌ها و سایبان‌ها
  // روی صفحۀ جلوی همین قاب نصب می‌شوند (پنلِ سرخِ پنجره از دیوار جلوتر است و
  // نیم‌ستونی که روی خودِ دیوار بنشیند پشتِ آن گم می‌شود)
  const windowMountZ = THEATER_Z - 0.02 + WINDOW_ARCHITECTURE.frameDepth / 2;

  CURTAIN.windowXs.forEach((wx: number, index: number) => {
    const archFrame = new THREE.Mesh(
      new THREE.BoxGeometry(WINDOW_ARCHITECTURE.frameWidth, WINDOW_ARCHITECTURE.frameHeight, 0.12),
      antiqueBrassMat,
    );
    archFrame.position.set(wx, WINDOW_ARCHITECTURE.centerY, windowMountZ - WINDOW_ARCHITECTURE.frameDepth / 2);
    archFrame.name = `TheaterWindowBrassFrame_${index}`;
    theaterGroup.add(archFrame);

    const archWin = new THREE.Mesh(new THREE.BoxGeometry(1.48, 2.86, 0.12), crimsonStainedMat);
    archWin.position.set(wx, WINDOW_ARCHITECTURE.centerY, THEATER_Z + 0.03);
    theaterGroup.add(archWin);

    // پرده کمی کوچک‌تر از دهانۀ پنجره است تا لبۀ سرخِ شیشه دورش دیده شود
    const curtain = new THREE.Mesh(
      buildCurtainGeometry(
        CURTAIN.curtainWidth,
        CURTAIN.curtainHeight,
        CURTAIN.variants[index % CURTAIN.variants.length],
      ),
      curtainVelvetMat,
    );
    curtain.name = `TheaterCurtain_${index}`;
    curtain.position.set(wx, WINDOW_ARCHITECTURE.centerY, THEATER_Z + 0.12 + CURTAIN.hangOffset);
    theaterGroup.add(curtain);

    // معماریِ دورِ پنجره: دو نیم‌ستونِ سنگیِ بیرون‌آمده از دیوار (از کفِ پنجره تا
    // سرِ آن) و یک سایبانِ سنگیِ افقی که روی همان دو ستون می‌نشیند و برای پنجره
    // سایه می‌اندازد (بازبینیِ امیر)
    theaterGroup.add(
      buildTheaterWindowArchitecture({
        index,
        x: wx,
        mountZ: windowMountZ,
        shaftMaterial: theaterStoneMat,
        trimMaterial: stoneTrimMat,
      }),
    );
  });

  // سایبان نورانی سردر تماشاخانه (Marquee Canopy) با متن واقعی
  const marqueeBox = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.48, 1.55), darkIronMat);
  marqueeBox.position.set(0, 4.42, THEATER_Z + 0.62);
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
  marqueeBoard.position.set(0, 4.42, THEATER_Z + 1.44);
  marqueeBoard.name = 'TheaterMarqueeSign';
  theaterGroup.add(marqueeBoard);

  // میله‌های مهاری برنجی سایبان سردر
  for (const cx of [-2.9, 2.9]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.15, 6), antiqueBrassMat);
    rod.position.set(cx, 5.72, THEATER_Z + 0.68);
    rod.rotation.x = 0.56;
    theaterGroup.add(rod);
  }

  // درِ اصلی لابی: نوار نیم‌دایره‌ای شیشه‌ای با نقش‌نگاری آهنی بالای دو لنگهٔ
  // چوبیِ قهوه‌ای تیره، هر لنگه با مستطیل عمودی شیشه و نیمهٔ پایین چوبی، و دو
  // دستگیرهٔ استوانه‌ای برنجی کنار هم در وسط (ماژول alley-lobby-door).
  const lobbyDoor = createLobbyDoor({
    woodMaps: lobbyDoorWoodMaps,
    stoneMaps: theaterStoneMaps,
    environmentMap,
  });
  lobbyDoor.group.position.set(THEATER_X, 0, THEATER_Z);
  theaterGroup.add(lobbyDoor.group);

  // دو چراغ کنار در ورودی به شکل مشعل: پیالهٔ برنزی-آهنی، بازوی هشت‌ضلعی
  // بیرون‌آمده از نما و فانوس چراغِ هشت‌ضلعی روی آن (به‌جای فانوس‌های لوزی قبلی).
  // هر دو دقیقاً قرینه‌اند و روی نمای تماشاخانه نصب می‌شوند.
  const entranceTorches: EntranceTorchInstance[] = [];
  for (const side of [-1, 1] as const) {
    const torch = createEntranceTorch({
      id: side < 0 ? 'EntranceLeft' : 'EntranceRight',
      // نمای تماشاخانه ۰٫۱ متر جلوتر از لنگر در است (ضخامت بدنه ۱٫۶ با مرکز −۰٫۹)
      position: { x: side * 1.95, y: 0, z: THEATER_Z - 0.1 },
      facing: 1,
      seed: side < 0 ? 2.4 : 7.1,
      haloTexture: lampHaloTexture,
      environmentMap,
    });
    theaterGroup.add(torch.group);
    entranceTorches.push(torch);
  }

  // ردیف چراغ‌های وضعیت پانچ بلیط بازیکنان بالای چهارچوب در
  const playerStatusLampsGroup = new THREE.Group();
  playerStatusLampsGroup.name = 'DoorPlayerStatusLamps';
  // بازبینی: ردیف از بالای قوس به داخل نیم‌دایرهٔ بالای در منتقل شد — سه‌تا
  // روی تیمپانوم چوبی تیره می‌نشینند و از پشت شیشه دیده می‌شوند.
  playerStatusLampsGroup.position.set(
    0,
    LOBBY_DOOR_STATUS_LAMPS.centerY,
    THEATER_Z + LOBBY_DOOR_STATUS_LAMPS.z,
  );
  theaterGroup.add(playerStatusLampsGroup);

  const rebuildPlayerStatusLamps = (players?: readonly AlleyPlayerLampStatus[], requiredCount = 3, punchedCount = 0) => {
    while (playerStatusLampsGroup.children.length > 0) {
      const child = playerStatusLampsGroup.children.pop()!;
      playerStatusLampsGroup.remove(child);
    }
    const count = Math.max(1, Math.min(8, players?.length ?? requiredCount));
    // فاصله طوری تنظیم می‌شود که هر تعداد چراغ داخل نیم‌دایره بماند
    const dy = LOBBY_DOOR_STATUS_LAMPS.centerY - LOBBY_DOOR.leafHeight;
    const halfChord = Math.sqrt(Math.max(0, LOBBY_DOOR.arcInnerRadius ** 2 - dy * dy));
    const spacing =
      count > 1
        ? Math.min(
            LOBBY_DOOR_STATUS_LAMPS.spacing,
            (2 * (halfChord - LOBBY_DOOR_STATUS_LAMPS.bulbRadius - 0.02)) / (count - 1),
          )
        : 0;
    for (let i = 0; i < count; i++) {
      const ready = players ? Boolean(players[i]?.ticketPunched) : i < punchedCount;
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(LOBBY_DOOR_STATUS_LAMPS.bulbRadius, 12, 12),
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
  // ۴. بن‌بستِ فرعیِ غربی (جای دروازهٔ آهنیِ حذف‌شده)
  // =========================================================================
  // خواستهٔ بازبینی: «نردهٔ پشت سر رو بردار». دروازهٔ آهنی و پایه‌هایش کامل حذف
  // شدند و انتهای کوچه دیگر یک سدِ فلزی نیست؛ به‌جایش کوچه ادامه پیدا می‌کند،
  // به سمت چپ می‌پیچد و در انتهای فرعی به یک درِ چوبیِ بستهٔ کارگاه می‌رسد.
  const deadEndGroup = new THREE.Group();
  deadEndGroup.name = 'BranchDeadEnd';

  const deadEndWall = new THREE.Mesh(
    withUv2(new THREE.BoxGeometry(3.2, 11.4, ALLEY_BRANCH.southZ - ALLEY_BRANCH.northZ + 6.4)),
    brickMatSlate,
  );
  deadEndWall.position.set(ALLEY_BRANCH.westX - 1.6, 5.7, ALLEY_BRANCH.centerZ);
  deadEndWall.castShadow = true;
  deadEndWall.receiveShadow = true;
  deadEndWall.name = 'BranchDeadEndWall';
  deadEndGroup.add(deadEndWall);

  // درِ چوبیِ دوقلوی بسته — نشانهٔ اینکه فرعی به پشتِ صحنهٔ یک کارگاه می‌رسد
  const deadEndDoor = new THREE.Group();
  deadEndDoor.name = 'BranchDeadEndDoor';
  deadEndDoor.position.set(ALLEY_BRANCH.westX + 0.02, 0, ALLEY_BRANCH.centerZ);

  for (const side of [-1, 1] as const) {
    const leaf = new THREE.Mesh(
      withUv2(new THREE.BoxGeometry(0.1, 3.15, 1.72)),
      darkWoodMat,
    );
    leaf.position.set(0, 1.575, side * 0.88);
    leaf.castShadow = true;
    deadEndDoor.add(leaf);

    // قاب و لنگه‌های آهنی هر لنگه
    for (const bandY of [0.55, 2.55]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 1.66), darkIronMat);
      band.position.set(-0.03, bandY, side * 0.88);
      deadEndDoor.add(band);
    }
  }

  const doorLintel = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.36, 3.9),
    stoneTrimMat,
  );
  doorLintel.position.set(0.02, 3.39, 0);
  doorLintel.castShadow = true;
  deadEndDoor.add(doorLintel);
  deadEndGroup.add(deadEndDoor);

  // فانوسِ آهنیِ دیواری بالای درِ بن‌بست — تنها منبعِ گرمِ انتهای فرعی، تا
  // انتهای کوچه «چاهِ سیاه» نشود
  const lanternArm = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.56, 10), darkIronMat);
  lanternArm.rotation.z = Math.PI / 2;
  lanternArm.position.set(ALLEY_BRANCH.westX + 0.3, 4.5, ALLEY_BRANCH.centerZ);
  deadEndGroup.add(lanternArm);

  const lanternBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.19, 0.44, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffc98a,
      emissive: new THREE.Color(0xffb265),
      emissiveIntensity: 1.6,
      roughness: 0.3,
      metalness: 0.1,
      transparent: true,
      opacity: 0.82,
    }),
  );
  lanternBody.position.set(ALLEY_BRANCH.westX + 0.56, 4.28, ALLEY_BRANCH.centerZ);
  lanternBody.name = 'BranchDeadEndLanternGlass';
  deadEndGroup.add(lanternBody);

  const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 8), darkIronMat);
  lanternCap.position.set(ALLEY_BRANCH.westX + 0.56, 4.58, ALLEY_BRANCH.centerZ);
  lanternCap.name = 'BranchDeadEndLanternCap';
  deadEndGroup.add(lanternCap);

  const deadEndLanternLight = new THREE.PointLight(0xffc98a, 3.4, 15, 2);
  deadEndLanternLight.name = 'BranchDeadEndLanternLight';
  deadEndLanternLight.position.set(ALLEY_BRANCH.westX + 0.56, 4.2, ALLEY_BRANCH.centerZ);
  deadEndGroup.add(deadEndLanternLight);

  group.add(deadEndGroup);

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
    createGuideBoardSurfaceMaterial(playbillSign.texture),
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

  // بدنهٔ جدول، دقیقاً به همان الگوی ویترین چپ روی دیوار می‌نشیند:
  // صفحهٔ جدول ۴٫۵ سانتی‌متر جلوتر از بدنه و لبهٔ بدنه ۰٫۸۲ متر از دیوار.
  //
  // جنس بدنه عوض شد: پیش‌تر تمام این پنل برنجِ براق بود و چراغ مطالعه رویش
  // می‌تابید و «دیواره‌های» سمت راست را روشن نشان می‌داد، در حالی‌که ویترین چپ
  // چوب تیره است و نوری برنمی‌گرداند. حالا هر دو یک جنس چوب تیره دارند و فقط
  // چهار بازوی نازک برنجی (هم‌اندازهٔ چپ) دور صفحه می‌ماند.
  const boothFrameDepth = 1.92;
  const boothFrameLocalX =
    ALLEY_GUIDE_BOARD_SURFACE_X.rowChart
      + ALLEY_GUIDE_BOARD_FRAME_CLEARANCE
      + boothFrameDepth / 2
      - boothGroup.position.x;
  const boothUpperFrame = new THREE.Mesh(new THREE.BoxGeometry(boothFrameDepth, 1.98, 2.98), darkWoodMat);
  boothUpperFrame.name = 'RowChartBoardFrame';
  boothUpperFrame.position.set(boothFrameLocalX, 2.16, anchors.rowChart.z);
  boothUpperFrame.castShadow = true;
  boothUpperFrame.receiveShadow = true;
  boothGroup.add(boothUpperFrame);

  // بازوهای برنجی پیرامون جدول — همان ضخامت و همان فاصله‌ای که چهار بازوی ویترین
  // چپ دارند: مثل آن‌ها ۳٫۵ سانتی‌متر جلوتر از سطح تابلو بیرون می‌زنند
  const chartTrimX = anchors.rowChart.x + ALLEY_ROW_CHART_LOCAL_OFFSET_X + 0.015;
  for (const sy of [-1, 1] as const) {
    const hTrim = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.11, 3.06), antiqueBrassMat);
    hTrim.position.set(chartTrimX, 2.16 + sy * 0.90, anchors.rowChart.z);
    hTrim.name = `RowChartBoardTrim${sy > 0 ? 'Top' : 'Bottom'}`;
    boothGroup.add(hTrim);
  }
  for (const sz of [-1, 1] as const) {
    const vTrim = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.00, 0.11), antiqueBrassMat);
    vTrim.position.set(chartTrimX, 2.16, anchors.rowChart.z + sz * 1.48);
    vTrim.name = `RowChartBoardTrim${sz > 0 ? 'Right' : 'Left'}`;
    boothGroup.add(vTrim);
  }

  const boothRoof = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.20, 3.38), darkIronMat);
  boothRoof.position.set(anchors.rowChart.x + 0.50, 3.22, anchors.rowChart.z);
  boothRoof.castShadow = true;
  boothGroup.add(boothRoof);

  // صفحهٔ اصلی جدول ردیف‌ها با متن واقعی و بسیار خوانا رو به -X (داخل کوچه، ۵ سانتی‌متر جلوتر از قاب)
  const chart = new THREE.Mesh(
    new THREE.PlaneGeometry(2.74, 1.82),
    createGuideBoardSurfaceMaterial(rowChartSign.texture),
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

  // همهٔ چراغ‌های کوچه کاملاً یکسان‌اند: کلاسیک گالوانیزهٔ دایره‌ای، در جفت‌های
  // رو‌به‌روی هم. جفت‌های ۱ و ۲ همان دو جفتِ قدیمیِ نزدیک اسپاون/تئاترند؛ جفتِ ۳
  // برای امتدادِ تازهٔ جنوبی و جفتِ ۴ برای فرعیِ غربی اضافه شده‌اند (تیرهای فرعی
  // ۹۰ درجه چرخیده‌اند تا بازویشان در عرضِ فرعی به سمت مرکز باشد).
  const utilityPoleSpecs = [
    { id: 'SouthLeft', x: -5.95, z: 3.6, armSide: 1 as const, seed: 1.7, rotationY: 0 },
    { id: 'SouthRight', x: 5.95, z: 3.6, armSide: -1 as const, seed: 5.2, rotationY: 0 },
    { id: 'NorthLeft', x: -5.95, z: -7.0, armSide: 1 as const, seed: 8.9, rotationY: 0 },
    { id: 'NorthRight', x: 5.95, z: -7.0, armSide: -1 as const, seed: 12.4, rotationY: 0 },
    // امتدادِ جنوبیِ دوبرابر‌شده
    { id: 'FarSouthLeft', x: -5.95, z: 19.5, armSide: 1 as const, seed: 16.8, rotationY: 0 },
    { id: 'FarSouthRight', x: 5.95, z: 19.5, armSide: -1 as const, seed: 21.3, rotationY: 0 },
    // فرعیِ غربی: تیرِ شمالی دقیقاً جلوی درِ تماشاخانه بود و به درخواستِ امیر حذف
    // شد؛ فقط تیرِ پیاده‌روی جنوبی می‌ماند تا جلوی ورودی باز باشد
    {
      id: 'BranchSouth',
      x: -19.5,
      z: ALLEY_BRANCH.southSidewalkCenterZ,
      armSide: -1 as const,
      seed: 29.4,
      rotationY: -Math.PI / 2,
    },
    // خیابانِ شرقیِ باز: قرینهٔ تیرِ فرعی، ۹۰ درجه چرخیده تا بازو در عرضِ خیابان
    // به سمتِ مرکز باشد. دومی دورتر است تا انتهای خیابان در مه روشن بماند.
    {
      id: 'EastStreet',
      x: 19.5,
      z: ALLEY_EAST.southSidewalkCenterZ,
      armSide: 1 as const,
      seed: 33.7,
      rotationY: Math.PI / 2,
    },
    {
      id: 'EastStreetFar',
      x: 34.5,
      z: ALLEY_EAST.northSidewalkCenterZ,
      armSide: -1 as const,
      seed: 38.2,
      rotationY: Math.PI / 2,
    },
  ] as const;

  const utilityPoles: UtilityPoleInstance[] = utilityPoleSpecs.map((spec) => {
    const pole = createUtilityPole({
      id: spec.id,
      position: { x: spec.x, y: 0.13, z: spec.z },
      armSide: spec.armSide,
      // همهٔ چراغ‌ها یک پروفایل سوسوزدن یکسان دارند (فقط فازشان با seed فرق می‌کند)
      profile: 'nervous',
      seed: spec.seed,
      baseIntensity: 15.0,
      castShadow: false,
      environmentMap,
      poolTexture: lampPoolTexture,
      haloTexture: lampHaloTexture,
    });
    if (spec.rotationY !== 0) pole.group.rotation.y = spec.rotationY;
    return pole;
  });

  utilityPoles.forEach((pole) => polesGroup.add(pole.group));

  // ذرات مه و نم باران معلق زیر پرتو تیرهای چراغ برق (فقط ۱ draw call سبک)
  const moteCount = 160;
  const motePositions = new Float32Array(moteCount * 3);
  const moteBase = new Float32Array(moteCount * 3);
  // مرکز استخرهای نور (سر چراغ‌ها) — جفت‌های رو‌به‌روی هم، شامل دو جفتِ تازه
  const lampCenters: ReadonlyArray<[number, number, number]> = [
    [-4.73, 2.6, 3.6],
    [4.73, 2.6, 3.6],
    [-4.73, 2.6, -7.0],
    [4.73, 2.6, -7.0],
    [-4.73, 2.6, 19.5],
    [4.73, 2.6, 19.5],
    [-19.5, 2.6, 28.93],
    [19.5, 2.6, ALLEY_EAST.southSidewalkCenterZ - 1.22],
    [34.5, 2.6, ALLEY_EAST.northSidewalkCenterZ + 1.22],
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

  // ترتیب utilityPoles: [0]=SouthLeft، [1]=SouthRight، [2]=NorthLeft، [3]=NorthRight
  // کابل‌ها: از ساختمان‌های جنوبی به جفت جنوبی، در طول هر پیاده‌رو به جفت شمالی،
  // دو اسپن عرضی بین دو چراغ هر جفت، و اتصال انتهای شمالی به عمارت تماشاخانه.
  const cableSpans: Array<[THREE.Vector3, THREE.Vector3, number]> = [
    // ورودی از ساختمان‌های پشت سر بازیکن به جفت جنوبی
    [new THREE.Vector3(-7.9, 6.05, 9.1), utilityPoles[0].insulatorWorldPositions[0], 0.36],
    [new THREE.Vector3(7.9, 6.05, 9.1), utilityPoles[1].insulatorWorldPositions[0], 0.36],
    // طول پیاده‌روی چپ و راست: جفت جنوبی → جفت شمالی
    [utilityPoles[0].insulatorWorldPositions[0], utilityPoles[2].insulatorWorldPositions[0], 0.68],
    [utilityPoles[0].insulatorWorldPositions[1], utilityPoles[2].insulatorWorldPositions[1], 0.58],
    [utilityPoles[0].insulatorWorldPositions[2], utilityPoles[2].insulatorWorldPositions[2], 0.62],
    [utilityPoles[1].insulatorWorldPositions[0], utilityPoles[3].insulatorWorldPositions[0], 0.68],
    [utilityPoles[1].insulatorWorldPositions[1], utilityPoles[3].insulatorWorldPositions[1], 0.58],
    [utilityPoles[1].insulatorWorldPositions[2], utilityPoles[3].insulatorWorldPositions[2], 0.62],
    // اسپن عرضی روی سر هر دو جفت (سیم‌های عبوری از عرض کوچه)
    [utilityPoles[0].insulatorWorldPositions[2], utilityPoles[1].insulatorWorldPositions[2], 0.74],
    [utilityPoles[2].insulatorWorldPositions[2], utilityPoles[3].insulatorWorldPositions[2], 0.74],
    // اتصال انتهای شمالی به نمای تماشاخانه و دیوارهای دو طرف
    [utilityPoles[2].insulatorWorldPositions[2], new THREE.Vector3(-2.6, 5.55, -13.25), 0.28],
    [utilityPoles[3].insulatorWorldPositions[2], new THREE.Vector3(2.6, 5.55, -13.25), 0.28],
    // ---- امتدادِ جنوبیِ تازه: جفتِ جنوبی → جفتِ ۳ روی هر پیاده‌رو
    [utilityPoles[0].insulatorWorldPositions[0], utilityPoles[4].insulatorWorldPositions[0], 0.7],
    [utilityPoles[0].insulatorWorldPositions[2], utilityPoles[4].insulatorWorldPositions[2], 0.62],
    [utilityPoles[1].insulatorWorldPositions[0], utilityPoles[5].insulatorWorldPositions[0], 0.7],
    [utilityPoles[1].insulatorWorldPositions[2], utilityPoles[5].insulatorWorldPositions[2], 0.62],
    // اسپن عرضی جفت ۳ و ادامه به ساختمان‌های انتهای کوچه
    [utilityPoles[4].insulatorWorldPositions[2], utilityPoles[5].insulatorWorldPositions[2], 0.74],
    [utilityPoles[4].insulatorWorldPositions[0], new THREE.Vector3(-7.9, 6.05, 30.4), 0.42],
    [utilityPoles[5].insulatorWorldPositions[0], new THREE.Vector3(7.9, 6.05, 30.4), 0.42],
    // ---- فرعی: تیرِ جنوبی به دیوارِ بن‌بست (تیرِ شمالیِ جلوی در حذف شده است)
    [utilityPoles[6].insulatorWorldPositions[0], new THREE.Vector3(-31.6, 6.1, 29.7), 0.5],
    [utilityPoles[6].insulatorWorldPositions[2], new THREE.Vector3(-31.6, 6.1, 22.4), 0.85],
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

  // دسته D: گوشهٔ راست، جنوبِ گیشه (x ≈ +7.45, z ≈ +5.7)
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

  // دسته E: پیاده‌روی چپ در امتدادِ تازهٔ جنوبی (x ≈ -7.55, z ≈ +13.6)
  const clusterE = new THREE.Group();
  clusterE.name = 'CrateCluster_LeftSouthFar';
  clusterE.position.set(-7.55, 0.13, 13.6);
  const cE1 = createWoodenCrateMesh(1.1, 1.0, 1.04, cratePlankMat, crateTrimMat, darkIronMat);
  cE1.position.set(-0.2, 0.5, 0.3);
  cE1.rotation.y = 0.22;
  const cE2 = createWoodenCrateMesh(0.8, 0.72, 0.78, cratePlankMat, crateTrimMat, darkIronMat);
  cE2.position.set(0.42, 0.36, -0.5);
  cE2.rotation.y = -0.4;
  const barrelE = createRustyBarrel(darkIronMat, 0x3a3129);
  barrelE.position.set(0.36, 0, 0.86);
  clusterE.add(cE1, cE2, barrelE);
  cratesGroup.add(clusterE);

  // دسته F: فرعیِ غربی، پیاده‌روی جنوبی (x ≈ -17.85, z ≈ +29.3)
  const clusterF = new THREE.Group();
  clusterF.name = 'CrateCluster_BranchSouth';
  clusterF.position.set(-17.85, 0.13, 29.3);
  const cF1 = createWoodenCrateMesh(1.06, 0.96, 1.0, cratePlankMat, crateTrimMat, darkIronMat);
  cF1.position.set(-0.35, 0.48, 0.05);
  cF1.rotation.y = 0.34;
  const cF2 = createWoodenCrateMesh(0.76, 0.7, 0.74, cratePlankMat, crateTrimMat, darkIronMat);
  cF2.position.set(0.42, 0.35, -0.24);
  cF2.rotation.y = -0.22;
  const palletF = createWoodenPallet(1.5, 1.2, crateTrimMat);
  palletF.position.set(0.55, 0, 0.62);
  palletF.rotation.y = -0.12;
  clusterF.add(cF1, cF2, palletF);
  cratesGroup.add(clusterF);

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
  moon.shadow.camera.far = 72;
  // کوچه L‌شکلِ دوبرابر‌شده دیگر در قاب ±۱۴/±۱۸ جا نمی‌شد و سایه‌ها نیمه‌کاره
  // قطع می‌شدند؛ قاب به اندازهٔ کلِ L باز شد.
  moon.shadow.camera.left = -24;
  moon.shadow.camera.right = 24;
  moon.shadow.camera.top = 32;
  moon.shadow.camera.bottom = -30;
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.02;
  group.add(moon);
  lights.push(moon);

  utilityPoles.forEach((pole) => lights.push(pole.spotLight));
  entranceTorches.forEach((torch) => lights.push(torch.light));
  lights.push(deadEndLanternLight);

  // بازبینیِ امیر: «تابلوی بالای درب ورودی یه چراغ وسطش قسمت پایین داره، اونو حذف
  // کن.» این نورافکنِ وسط (TheaterEntranceSpotLight) همان لکهٔ گرمی بود که از
  // میانِ هوا زیرِ تابلوی سردر می‌تابید و هیچ بدنه‌ای هم نداشت؛ برداشته شد.
  // روشناییِ ورودی حالا فقط از دو مشعلِ کنارِ در و ماه/نورِ محیطی می‌آید.

  // چراغ مطالعهٔ هر دو تابلو از یک پیکربندی می‌آید: رنگ، شدت، برد و افت نور
  // یکی است و هر کدام دقیقاً هم‌فاصله از سطح تابلوی خودش می‌نشیند (قرینهٔ کامل)
  const playbillLamp = new THREE.PointLight(
    ALLEY_GUIDE_LAMP.color,
    ALLEY_GUIDE_LAMP.intensity,
    ALLEY_GUIDE_LAMP.distance,
    ALLEY_GUIDE_LAMP.decay,
  );
  playbillLamp.name = 'PlaybillReadingLight';
  playbillLamp.position.set(
    ALLEY_GUIDE_LAMP_X.playbill,
    anchors.playbill.y + ALLEY_GUIDE_LAMP.offsetY,
    anchors.playbill.z,
  );
  group.add(playbillLamp);
  lights.push(playbillLamp);

  const rowChartLamp = new THREE.PointLight(
    ALLEY_GUIDE_LAMP.color,
    ALLEY_GUIDE_LAMP.intensity,
    ALLEY_GUIDE_LAMP.distance,
    ALLEY_GUIDE_LAMP.decay,
  );
  rowChartLamp.name = 'RowChartReadingLight';
  rowChartLamp.position.set(
    ALLEY_GUIDE_LAMP_X.rowChart,
    anchors.rowChart.y + ALLEY_GUIDE_LAMP.offsetY,
    anchors.rowChart.z,
  );
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
    for (const torch of entranceTorches) {
      torch.update(elapsedSeconds);
    }
    lobbyDoor.update(elapsedSeconds);

    if (Number.isFinite(elapsedSeconds)) {
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
      // اسپرایت‌ها هندسه ندارند ولی متریال دارند (هالهٔ چراغ‌ها و مشعل‌ها)؛
      // پس هم هندسه و هم متریال هر گره آزاد می‌شود
      const renderable = obj as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
      const geometry = (renderable as THREE.Mesh).geometry;
      if (geometry && !disposedGeos.has(geometry)) {
        disposedGeos.add(geometry);
        geometry.dispose();
      }
      const mat = renderable.material;
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
    curtainMaps.dispose();
    crateLightWoodMaps.dispose();
    crateDarkWoodMaps.dispose();
    lobbyDoorWoodMaps.dispose();
    lampPoolTexture.dispose();
    lampHaloTexture.dispose();
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
