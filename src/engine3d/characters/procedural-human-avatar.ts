// src/engine3d/characters/procedural-human-avatar.ts — سازندهٔ رویه‌ای قدیمی (سازگاری و پیش‌نمایش «قبل»)
//
// چرا این فایل؟ مدل قبلی از چند کپسول و کرهٔ صاف ساخته می‌شد: سر توپ، چشم‌های
// سیاهِ ساده، دستِ بی‌انگشت و بدنی که هیچ‌وقت پلک نمی‌زد. مغز ما صورتِ انسانی را
// با «کاسهٔ چشم + پلکِ متحرک + عدم تقارن + ریزحرکت» می‌شناسد، نه با تعداد مثلث.
// این ماژول چهار لایه را با هم می‌آورد:
//   ۱) جمجمهٔ مجسمه‌شده (human-head-shape) به‌جای کره
//   ۲) پوست/مو/پارچهٔ بافت‌دار (human-textures) به‌جای رنگ تخت
//   ۳) چهرهٔ مفصل‌دار: چشم با عنبیه، پلکِ پلک‌زن، ابروی تاربه‌تار، گوش و لب
//   ۴) لایهٔ زندگی: تنفس، پلک‌زدن، ساکادِ چشم، انتقال وزن و گام‌برداری واقعی
//
// ابعاد: قد پایه ۱٫۷۸ متر، چشم‌ها در ارتفاع ۱٫۶۵، شانه ۱٫۴۴، لگن ۰٫۹۴.
// همهٔ گروه‌ها با نام‌های قراردادی avatar-* ساخته می‌شوند تا HUD/تست‌ها بشناسند.

import * as THREE from 'three';
import type { HumanLook } from './human-presets';
import { createHumanTextures, type HumanTextureSet } from './human-textures';
import {
  DEFAULT_PLAYER_EYE_HEIGHT,
  HEAD_FACE_SEGMENTS,
  HUMAN_EYE_VERTICAL_OFFSET,
  HUMAN_HEAD_CENTER_Y,
  calibrateHumanHeightForEyeLevel,
  getHumanEyeHeight,
  getHumanStandingTop,
  resolveBrowArc,
  resolveHeadAnchors,
  sculptHead,
  type HeadAnchors,
} from './human-head-shape';

export type HumanPose = 'standing' | 'seated';

export interface HumanAvatarOptions {
  look: HumanLook;
  pose?: HumanPose;
  displayName?: string;
}

export interface HumanMotion {
  /** سرعت افقی بر حسب متر بر ثانیه؛ ۰ = ایستادن */
  speed: number;
  /** زاویهٔ سر بالا/پایین (درجه) از شبکهٔ حضور */
  pitchDeg?: number;
  /** چرخش تنه هنگام دور زدن (رادیان بر ثانیه) */
  yawRate?: number;
}

interface LoftRing {
  y: number;
  rx: number;
  rz: number;
  cx?: number;
  cz?: number;
}

const BASE_HEIGHT_METERS = 1.78;
const HIP_Y = 0.94;
const SHOULDER_Y = 1.44;
const HEAD_Y = HUMAN_HEAD_CENTER_Y;

function makeRandom(seed: number): () => number {
  let state = (seed || 0x9e3779b9) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const hash = (i: number, j: number) => {
    let h = Math.imul(i * 374761393 + j * 668265263 + seed * 1442695041, 2246822519);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489917);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/**
 * سطوح دوار (loft) با مقطع بیضی و نویز سطحی.
 * کپسولِ صاف «پلاستیک» است؛ این تابع عضله/پارچه/استخوان را با تغییر آرامِ شعاع می‌سازد.
 */
function buildLoft(
  rings: readonly LoftRing[],
  radialSegments = 24,
  options: { noise?: number; seed?: number; capTop?: boolean; capBottom?: boolean } = {},
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const noise = options.noise ?? 0;
  const seed = options.seed ?? 7;

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i]!;
    for (let j = 0; j <= radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const wobble = 1 + (valueNoise(angle * 2.4, i * 0.7, seed) - 0.5) * 2 * noise;
      const x = (ring.cx ?? 0) + Math.cos(angle) * ring.rx * wobble;
      const z = (ring.cz ?? 0) + Math.sin(angle) * ring.rz * wobble;
      positions.push(x, ring.y, z);
      uvs.push(j / radialSegments, i / Math.max(1, rings.length - 1));
    }
  }

  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = a + radialSegments + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  const addCap = (ringIndex: number, upward: boolean) => {
    const ring = rings[ringIndex]!;
    const centerIndex = positions.length / 3;
    positions.push(ring.cx ?? 0, ring.y, ring.cz ?? 0);
    uvs.push(0.5, 0.5);
    for (let j = 0; j < radialSegments; j++) {
      const a = ringIndex * (radialSegments + 1) + j;
      if (upward) indices.push(centerIndex, a + 1, a);
      else indices.push(centerIndex, a, a + 1);
    }
  };
  if (options.capTop !== false) addCap(0, true);
  if (options.capBottom !== false) addCap(rings.length - 1, false);

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** یک تار مو/مژه: مخروط باریکِ خمیده که پایه‌اش در مبدأ و نوکش روی +Y است */
function buildStrand(length: number, radius: number, bend: number): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radius * 0.12, radius, length, 4, 4, false);
  geometry.translate(0, length / 2, 0);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const t = THREE.MathUtils.clamp(y / length, 0, 1);
    position.setX(i, position.getX(i) + bend * t * t);
    position.setZ(i, position.getZ(i) + bend * 0.4 * t * t);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** کلاهک عنبیه با UV شعاعی: مرکز بافت = مردمک، لبهٔ بافت = حلقهٔ تیرهٔ دور عنبیه */
function buildIrisCap(radius: number, angularRadius: number, rings = 10, segments = 40): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const beta = (i / rings) * angularRadius;
    const rho = beta / angularRadius;
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      const sinBeta = Math.sin(beta);
      positions.push(sinBeta * Math.cos(theta) * radius, sinBeta * Math.sin(theta) * radius, -Math.cos(beta) * radius);
      uvs.push(0.5 + rho * Math.cos(theta) * 0.5, 0.5 + rho * Math.sin(theta) * 0.5);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + segments + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createSkinMaterial(
  look: HumanLook,
  textures: HumanTextureSet,
  options: { face?: boolean } = {},
): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    // وقتی بافت صورت رنگ پوست را می‌آورد، رنگ ماده باید سفید بماند وگرنه رنگ دوبار ضرب می‌شود
    color: options.face && textures.faceMap ? 0xffffff : look.skinHex,
    roughness: 0.62,
    metalness: 0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.62,
    sheen: 0.22,
    sheenColor: new THREE.Color(0xff8f72),
    sheenRoughness: 0.85,
    map: options.face ? textures.faceMap : null,
    bumpMap: options.face ? textures.faceBump : textures.bodyBump,
    bumpScale: options.face ? 0.7 : 0.25,
    roughnessMap: options.face ? textures.faceRough : null,
  });
  // بازتاب گرمِ زیرپوستی: بدون transmission سنگین، فقط یک لایهٔ نازکِ قرمز در لبه
  material.emissive = new THREE.Color(0xff6a4a).multiplyScalar(0.018);
  return material;
}

function createClothMaterial(
  hex: number,
  textures: HumanTextureSet,
  options: { roughness?: number } = {},
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: options.roughness ?? 0.84,
    metalness: 0.02,
    map: textures.clothMap,
    bumpMap: textures.clothBump,
    bumpScale: 0.6,
    sheen: 0.6,
    sheenColor: new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.35),
    sheenRoughness: 0.75,
    envMapIntensity: 0.5,
  });
}

function createHairMaterial(look: HumanLook, textures: HumanTextureSet): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: textures.hairMap ? 0xffffff : look.hairHex,
    roughness: 0.48,
    metalness: 0.04,
    map: textures.hairMap,
    bumpMap: textures.hairBump,
    bumpScale: 0.45,
    sheen: 0.9,
    sheenColor: new THREE.Color(look.hairHex).lerp(new THREE.Color(0xffd9a8), 0.5),
    sheenRoughness: 0.35,
    clearcoat: 0.15,
    clearcoatRoughness: 0.4,
    side: THREE.DoubleSide,
  });
}

/** پروفایل شعاعی بازو/ساق: عضله و استخوان، نه لولهٔ یکنواخت */
function limbRings(
  length: number,
  profile: readonly { t: number; radius: number }[],
  oval = 1,
): LoftRing[] {
  return profile.map((point) => ({
    y: -length * point.t,
    rx: point.radius,
    rz: point.radius * oval,
  }));
}

export class ProceduralHumanAvatar extends THREE.Group {
  readonly look: HumanLook;
  readonly pose: HumanPose;
  readonly standingHeight: number;
  readonly eyeHeight: number;
  readonly textures: HumanTextureSet;
  readonly materials: THREE.Material[] = [];
  readonly anchors: HeadAnchors;

  private readonly torsoGroup!: THREE.Group;
  private readonly headGroup!: THREE.Group;
  private readonly hairGroup!: THREE.Group;
  private readonly leftArm!: THREE.Group;
  private readonly rightArm!: THREE.Group;
  private readonly leftElbow!: THREE.Group;
  private readonly rightElbow!: THREE.Group;
  private readonly leftLeg!: THREE.Group;
  private readonly rightLeg!: THREE.Group;
  private leftKnee: THREE.Group | null = null;
  private rightKnee: THREE.Group | null = null;
  private leftAnkle: THREE.Group | null = null;
  private rightAnkle: THREE.Group | null = null;
  private leftEyelid!: THREE.Group;
  private rightEyelid!: THREE.Group;
  private leftEye!: THREE.Group;
  private rightEye!: THREE.Group;
  private readonly neckGroup!: THREE.Group;

  private elapsed = 0;
  private walkPhase = 0;
  private strideBlend = 0;
  private blinkTimer = 1.6 + Math.random() * 2;
  private blinkProgress = 0;
  private blinking = false;
  private doubleBlink = false;
  private saccadeTimer = 1.2;
  private saccadeTarget = new THREE.Vector2();
  private saccadeCurrent = new THREE.Vector2();
  private headYaw = 0;
  private seeded = makeRandom(0x51f3);

  constructor(options: HumanAvatarOptions) {
    super();
    this.look = options.look;
    this.pose = options.pose ?? 'standing';
    this.standingHeight = options.look.heightMeters;
    this.eyeHeight = getHumanEyeHeight(options.look);
    this.name = `HumanAvatar:${options.displayName ?? options.look.displayName}`;
    this.userData.lookId = options.look.id;
    this.userData.faceTextureSize = 0;
    this.textures = createHumanTextures(options.look);
    this.anchors = resolveHeadAnchors(options.look.head);

    const skin = createSkinMaterial(options.look, this.textures, { face: true });
    const bodySkin = createSkinMaterial(options.look, this.textures);
    const coat = createClothMaterial(options.look.coatHex, this.textures);
    const trousers = createClothMaterial(options.look.trouserHex, this.textures, { roughness: 0.9 });
    const shirt = createClothMaterial(options.look.shirtHex, this.textures, { roughness: 0.78 });
    const cravat = createClothMaterial(options.look.cravatHex, this.textures, { roughness: 0.55 });
    const shoes = new THREE.MeshPhysicalMaterial({
      color: options.look.shoeHex,
      roughness: 0.35,
      metalness: 0.08,
      clearcoat: 0.7,
      clearcoatRoughness: 0.28,
      bumpMap: this.textures.clothBump,
      bumpScale: 0.25,
    });
    const hair = createHairMaterial(options.look, this.textures);
    const gold = new THREE.MeshStandardMaterial({
      color: 0xd8b56a,
      roughness: 0.28,
      metalness: 0.9,
    });
    const sclera = new THREE.MeshPhysicalMaterial({
      color: 0xdcd0be,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      metalness: 0,
    });
    const cornea = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.02,
      metalness: 0,
      transparent: true,
      opacity: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      depthWrite: false,
    });
    const iris = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: this.textures.irisMap,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x120e10, roughness: 0.45 });
    this.materials.push(
      skin, bodySkin, coat, trousers, shirt, cravat, shoes, hair, gold, sclera, cornea, iris, dark,
    );

    // قد: مدل با تاجِ سر (نه مرکز سر) تا قدِ واقعی مطابق look.heightMeters باشد
    const standingTop = getHumanStandingTop(options.look.head);
    this.scale.setScalar(options.look.heightMeters / standingTop);

    // ─── تنه و کت ───
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.name = 'avatar-body';
    this.torsoGroup.position.set(0, this.pose === 'seated' ? 0.52 : HIP_Y, 0);
    this.add(this.torsoGroup);
    this.buildTorso(coat, shirt, cravat, gold);

    // ─── گردن و سر ───
    this.neckGroup = new THREE.Group();
    this.neckGroup.name = 'avatar-neck';
    this.neckGroup.position.set(0, this.pose === 'seated' ? 1.16 : 1.52, 0);
    this.add(this.neckGroup);
    this.buildNeck(bodySkin);

    this.headGroup = new THREE.Group();
    this.headGroup.name = 'avatar-head';
    this.headGroup.position.set(0, this.pose === 'seated' ? 1.24 : HEAD_Y, 0);
    this.add(this.headGroup);
    this.buildHead(skin, bodySkin, dark, sclera, cornea, iris);

    this.hairGroup = new THREE.Group();
    this.hairGroup.name = 'avatar-hair';
    this.hairGroup.position.copy(this.headGroup.position);
    this.add(this.hairGroup);
    this.buildHair(hair);

    // ─── دست‌ها ───
    this.leftArm = this.buildArm(-1, coat, shirt, bodySkin, gold);
    this.rightArm = this.buildArm(1, coat, shirt, bodySkin, gold);
    this.leftElbow = this.leftArm.getObjectByName('avatar-elbow-left') as THREE.Group;
    this.rightElbow = this.rightArm.getObjectByName('avatar-elbow-right') as THREE.Group;

    // ─── پاها ───
    if (this.pose === 'seated') {
      // پای نشسته یک مجسمهٔ ژست‌گرفته است: ران افقی، ساق عمود، کفش روی زمین.
      // (ساختار تخت نگه داشته می‌شود تا کفش آخرین فرزند گروه پا بماند.)
      this.leftLeg = this.buildSeatedLeg(-1, trousers, shoes);
      this.rightLeg = this.buildSeatedLeg(1, trousers, shoes);
      this.applySeatedPose();
    } else {
      this.leftLeg = this.buildLeg(-1, trousers, shoes);
      this.rightLeg = this.buildLeg(1, trousers, shoes);
      this.leftKnee = this.leftLeg.getObjectByName('avatar-knee-left') as THREE.Group;
      this.rightKnee = this.rightLeg.getObjectByName('avatar-knee-right') as THREE.Group;
      this.leftAnkle = this.leftLeg.getObjectByName('avatar-ankle-left') as THREE.Group;
      this.rightAnkle = this.rightLeg.getObjectByName('avatar-ankle-right') as THREE.Group;
    }

    this.applyAccessories(gold, dark, coat);

    this.userData.parts = {
      head: 'avatar-head',
      hair: 'avatar-hair',
      body: 'avatar-body',
      eyes: 'avatar-eyes',
    };
    this.userData.faceTextureSize = this.textures.faceMap?.image
      ? (this.textures.faceMap.image as HTMLCanvasElement).width
      : 0;
  }

  // ─────────────────────────────────────────────────────────────
  // ساخت اجزا
  // ─────────────────────────────────────────────────────────────

  private buildTorso(
    coat: THREE.Material,
    shirt: THREE.Material,
    cravat: THREE.Material,
    gold: THREE.Material,
  ): void {
    const build = this.look.build;
    const trimMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(this.look.coatHex).multiplyScalar(0.72),
      roughness: 0.78,
      metalness: 0.04,
      map: this.textures.clothMap,
      bumpMap: this.textures.clothBump,
      bumpScale: 0.6,
      sheen: 0.5,
      sheenColor: new THREE.Color(0xffffff).multiplyScalar(0.35),
      sheenRoughness: 0.8,
    });
    this.materials.push(trimMaterial);

    // کت: یک لوفتِ پیوسته از یقه تا دامن؛ پهن‌ترین نقطه شانه است و دامن از باسن
    // گشادتر می‌مانَد تا ران‌ها از زیرش بیرون نزنند (خطای مدل قبلی).
    const coatGeometry = buildLoft(
      [
        // یقه
        { y: 0.5, rx: 0.056 * build, rz: 0.056 * build },
        { y: 0.485, rx: 0.09 * build, rz: 0.072 * build },
        // شیب کتف تا مفصل شانه
        { y: 0.47, rx: 0.132 * build, rz: 0.088 * build },
        { y: 0.445, rx: 0.166 * build, rz: 0.098 * build },
        // پهن‌ترین: سرشانه (شانهٔ واقعی از سینه پهن‌تر است)
        { y: 0.42, rx: 0.172 * build, rz: 0.1 * build },
        { y: 0.38, rx: 0.166 * build, rz: 0.104 * build },
        // سینه و زیربغل
        { y: 0.31, rx: 0.155 * build, rz: 0.103 * build },
        { y: 0.24, rx: 0.144 * build, rz: 0.099 * build },
        // کمر (کمی باریک‌تر)
        { y: 0.14, rx: 0.135 * build, rz: 0.094 * build },
        { y: 0.05, rx: 0.133 * build, rz: 0.092 * build },
        // باسن و دامن کت
        { y: -0.06, rx: 0.144 * build, rz: 0.096 * build },
        { y: -0.18, rx: 0.154 * build, rz: 0.1 * build },
        { y: -0.28, rx: 0.16 * build, rz: 0.103 * build },
      ],
      32,
      { noise: 0.008, seed: 31, capTop: false, capBottom: true },
    );
    const torsoMesh = new THREE.Mesh(coatGeometry, coat);
    torsoMesh.name = 'avatar-torso-mesh';
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.torsoGroup.add(torsoMesh);

    // پیراهن: فقط یک V کوچک زیر گلو
    const shirtShape = new THREE.Shape();
    shirtShape.moveTo(-0.026, 0.475);
    shirtShape.lineTo(0.026, 0.475);
    shirtShape.lineTo(0.007, 0.33);
    shirtShape.lineTo(-0.007, 0.33);
    shirtShape.closePath();
    const shirtMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shirtShape, {
        depth: 0.008,
        bevelEnabled: true,
        bevelSize: 0.003,
        bevelThickness: 0.002,
        bevelSegments: 2,
      }),
      shirt,
    );
    shirtMesh.position.set(0, 0, -0.079 * build);
    shirtMesh.rotation.x = -0.03;
    this.torsoGroup.add(shirtMesh);

    // یقهٔ برگردان: دو نوارِ باریکِ چسبیده به سینه (نه دو تیغهٔ بیرون‌زده)
    for (const side of [-1, 1] as const) {
      const lapel = new THREE.Shape();
      lapel.moveTo(0, 0.46);
      lapel.lineTo(side * 0.048, 0.46);
      lapel.quadraticCurveTo(side * 0.058, 0.33, side * 0.022, 0.25);
      lapel.lineTo(0, 0.3);
      lapel.closePath();
      const mesh = new THREE.Mesh(
        new THREE.ExtrudeGeometry(lapel, {
          depth: 0.012,
          bevelEnabled: true,
          bevelSize: 0.004,
          bevelThickness: 0.003,
          bevelSegments: 2,
          curveSegments: 10,
        }),
        trimMaterial,
      );
      mesh.position.set(0, 0, -0.076 * build);
      mesh.rotation.y = side * 0.06;
      mesh.castShadow = true;
      this.torsoGroup.add(mesh);
    }

    // دستمال گردن کوچک + سنجاق
    const cravatShape = new THREE.Shape();
    cravatShape.moveTo(-0.017, 0.465);
    cravatShape.lineTo(0.017, 0.465);
    cravatShape.lineTo(0.008, 0.375);
    cravatShape.lineTo(0, 0.345);
    cravatShape.lineTo(-0.008, 0.375);
    cravatShape.closePath();
    const cravatMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(cravatShape, {
        depth: 0.01,
        bevelEnabled: true,
        bevelSize: 0.0025,
        bevelThickness: 0.002,
        bevelSegments: 2,
      }),
      cravat,
    );
    cravatMesh.position.set(0, 0, -0.083 * build);
    this.torsoGroup.add(cravatMesh);

    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), gold);
    pin.position.set(0.004, 0.375, -0.086 * build);
    pin.scale.z = 0.45;
    this.torsoGroup.add(pin);

    // درز مرکزی کت: خطی باریک که «دو لبهٔ روی‌هم‌افتاده» را نشان می‌دهد
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.74, 0.004), trimMaterial);
    seam.name = 'avatar-coat-seam';
    seam.position.set(-0.012, 0.03, -0.092 * build);
    this.torsoGroup.add(seam);

    for (const y of [0.14, 0.02, -0.1, -0.22]) {
      const button = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.005, 12), gold);
      button.rotation.x = Math.PI / 2;
      button.position.set(0.018, y, -0.09 * build + Math.max(0, -y) * 0.045);
      this.torsoGroup.add(button);
    }

  }

  private buildNeck(skin: THREE.Material): void {
    const neck = new THREE.Mesh(
      buildLoft(
        [
          { y: -0.19, rx: 0.052, rz: 0.05 },
          { y: -0.08, rx: 0.047, rz: 0.045 },
          { y: 0.02, rx: 0.044, rz: 0.043 },
        ],
        20,
        { noise: 0.01, seed: 12 },
      ),
      skin,
    );
    neck.castShadow = true;
    neck.receiveShadow = true;
    this.neckGroup.add(neck);

    // سیبِ گلو: یک برجستگی بسیار ملایم، نه یک کرهٔ چسبیده
    const throat = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), skin);
    throat.scale.set(1.1, 1.5, 0.35);
    throat.position.set(0, -0.055, -0.036);
    this.neckGroup.add(throat);
  }

  private buildHead(
    skin: THREE.Material,
    bodySkin: THREE.Material,
    dark: THREE.Material,
    sclera: THREE.Material,
    cornea: THREE.Material,
    iris: THREE.Material,
  ): void {
    const head = this.look.head;

    // جمجمه: کرهٔ پرتراکم که با توابع تحلیلی به سر انسان تبدیل می‌شود
    const skullGeometry = new THREE.SphereGeometry(1, HEAD_FACE_SEGMENTS.width, HEAD_FACE_SEGMENTS.height);
    const position = skullGeometry.getAttribute('position') as THREE.BufferAttribute;
    const direction = new THREE.Vector3();
    const sculpted = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      direction.set(position.getX(i), position.getY(i), position.getZ(i)).normalize();
      sculptHead(direction, head, sculpted);
      position.setXYZ(i, sculpted.x, sculpted.y, sculpted.z);
    }
    position.needsUpdate = true;
    skullGeometry.computeVertexNormals();
    skullGeometry.computeBoundingSphere();

    const skull = new THREE.Mesh(skullGeometry, skin);
    skull.name = 'avatar-skull';
    skull.castShadow = true;
    skull.receiveShadow = true;
    this.headGroup.add(skull);

    // نقطهٔ دقیق سطح جمجمه برای هر جهت: اجزای صورت روی همین سطح می‌نشینند،
    // نه با حدس و ضریب (منبع اصلی «چشمِ بیرون‌زده» و «لبِ گم‌شده» همین بود).
    const surfaceAt = (direction: THREE.Vector3, inset = 0): THREE.Vector3 =>
      sculptHead(direction.clone().normalize(), head).multiplyScalar(1 - inset);

    // چشم‌ها: کرهٔ صلبیه + عنبیهٔ بافت‌دار + قرنیهٔ شفاف + پلک متحرک + مژه
    const eyeScale = head.eyeSize;
    const eyeRadius = 0.0124 * eyeScale;
    const buildEye = (side: -1 | 1): { eye: THREE.Group; lid: THREE.Group } => {
      const anchor = side < 0 ? this.anchors.eyeL : this.anchors.eyeR;
      const point = surfaceAt(anchor);
      const eye = new THREE.Group();
      eye.name = side < 0 ? 'avatar-eye-left' : 'avatar-eye-right';
      // مرکز کره کمی داخل کاسه، تا فقط قطبِ جلویی از پوست بیرون بزند
      eye.position.set(point.x * 0.99, point.y + HUMAN_EYE_VERTICAL_OFFSET, point.z + eyeRadius * 0.42);

      const eyeball = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 24, 18), sclera);
      eyeball.name = 'avatar-eyeball';
      eyeball.castShadow = false;
      eye.add(eyeball);

      // عنبیه: کلاهک کره‌ای با UV قطبیِ دست‌ساز تا مردمکِ بافت دقیقاً روی قطب بیفتد
      // نسبت واقعی: عنبیه ~۱۱ میلی‌متر روی کرهٔ ۲۳ میلی‌متری → نیم‌زاویهٔ ~۲۹ درجه
      const irisCap = new THREE.Mesh(buildIrisCap(eyeRadius * 1.006, 0.5), iris);
      irisCap.name = 'avatar-iris';
      eye.add(irisCap);

      const corneaShell = new THREE.Mesh(
        new THREE.SphereGeometry(eyeRadius * 1.03, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
        cornea,
      );
      corneaShell.rotation.x = -Math.PI / 2;
      corneaShell.position.z = -eyeRadius * 0.02;
      eye.add(corneaShell);

      // پلک بالا: کلاهک کره که با چرخش، چشم را می‌پوشاند (پلک‌زدن واقعی)
      const lidGroup = new THREE.Group();
      lidGroup.name = side < 0 ? 'avatar-eyelid-left' : 'avatar-eyelid-right';
      const lidMesh = new THREE.Mesh(
        new THREE.SphereGeometry(eyeRadius * 1.045, 32, 22, 0, Math.PI * 2, 0, Math.PI * 0.42),
        skin,
      );
      lidMesh.rotation.x = 0;
      lidGroup.add(lidMesh);
      eye.add(lidGroup);


      // خط مژه روی لبهٔ پلک
      eye.rotation.set(-0.02, side * 0.04, 0);
      return { eye, lid: lidGroup };
    };

    const left = buildEye(-1);
    const right = buildEye(1);
    this.leftEye = left.eye;
    this.rightEye = right.eye;
    this.leftEyelid = left.lid;
    this.rightEyelid = right.lid;
    const eyes = new THREE.Group();
    eyes.name = 'avatar-eyes';
    eyes.add(this.leftEye, this.rightEye);
    this.headGroup.add(eyes);

    // گوش‌ها: شکل مجسم با لالهٔ داخلی و نرمه
    const buildEar = (side: -1 | 1): THREE.Group => {
      const earRoot = new THREE.Group();
      earRoot.name = side < 0 ? 'avatar-ear-left' : 'avatar-ear-right';
      const earSize = head.earSize;
      const anchor = side < 0 ? this.anchors.earL : this.anchors.earR;
      earRoot.position.set(
        anchor.x * head.width * 0.95,
        anchor.y * head.height,
        anchor.z * head.depth * 0.55,
      );
      earRoot.rotation.y = side * -1.35;
      earRoot.scale.setScalar(earSize * 0.82);

      const shape = new THREE.Shape();
      shape.moveTo(0.004, 0.028);
      shape.bezierCurveTo(0.024, 0.03, 0.026, 0.0, 0.016, -0.016);
      shape.bezierCurveTo(0.008, -0.03, -0.004, -0.032, -0.008, -0.018);
      shape.bezierCurveTo(-0.014, 0.0, -0.01, 0.022, 0.004, 0.028);
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.016,
        bevelEnabled: true,
        bevelSize: 0.005,
        bevelThickness: 0.005,
        bevelSegments: 3,
        curveSegments: 14,
      });
      geometry.center();
      geometry.scale(0.9, 0.95, 0.8);
      const earMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(this.look.skinHex).multiplyScalar(1.02),
        roughness: 0.6,
        sheen: 0.3,
        sheenColor: new THREE.Color(0xff9f86),
        sheenRoughness: 0.6,
      });
      this.materials.push(earMaterial);
      const shell = new THREE.Mesh(geometry, earMaterial);
      shell.rotation.y = (side * Math.PI) / 2;
      shell.castShadow = true;
      earRoot.add(shell);

      const conchaMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(this.look.skinHex).multiplyScalar(0.72),
        roughness: 0.75,
      });
      this.materials.push(conchaMaterial);
      const concha = new THREE.Mesh(new THREE.SphereGeometry(0.01, 12, 10), conchaMaterial);
      concha.scale.set(0.5, 1.4, 0.55);
      concha.position.set(side * 0.0075, -0.003, -0.001);
      earRoot.add(concha);
      // لبهٔ گوش (helix)
      const helix = new THREE.Mesh(new THREE.TorusGeometry(0.0135, 0.0024, 6, 18, Math.PI * 1.4), earMaterial);
      helix.rotation.set(Math.PI / 2, side * Math.PI / 2, 0.35);
      helix.position.set(side * 0.006, 0.002, 0);
      earRoot.add(helix);

      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 8), bodySkin);
      lobe.scale.set(0.5, 1, 0.85);
      lobe.position.set(side * 0.004, -0.026, 0.002);
      earRoot.add(lobe);

      return earRoot;
    };
    this.headGroup.add(buildEar(-1), buildEar(1));

    // ابروهای تاربه‌تار: ۷۰ تار مو در هر ابرو با جهت طبیعی
    const browMaterial = new THREE.MeshStandardMaterial({
      color: this.look.hairHex,
      roughness: 0.55,
      metalness: 0.02,
    });
    this.materials.push(browMaterial);
    const browStrand = buildStrand(0.006, 0.0006, 0.0012);
    const browArc = resolveBrowArc(this.look.head);
    // روبانِ ابرو: مش پیوستهٔ نازک روی قوس؛ از چند متری «ابرو» خوانده می‌شود،
    // تارهای مجزا فقط بافت نزدیک را می‌سازند.
    for (const side of [-1, 1] as const) {
      const mirrorForCharacterLeft = (point: THREE.Vector3) =>
        side < 0 ? point.clone().setX(-point.x) : point.clone();
      const inner = mirrorForCharacterLeft(browArc.inner);
      const outer = mirrorForCharacterLeft(browArc.outer);
      const steps = 22;
      const positions: number[] = [];
      const indices: number[] = [];
      const halfThickness = this.look.feminine ? 0.0021 : 0.0027;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const dir = new THREE.Vector3().copy(inner).lerp(outer, t);
        dir.y += Math.sin(t * Math.PI) * browArc.arch;
        dir.normalize();
        const taper = Math.min(1, t * 5) * (1 - t * 0.82) * (1 - t * 0.05);
        const center = new THREE.Vector3(
          dir.x * this.look.head.width * 1.03,
          dir.y * this.look.head.height * 1.03,
          dir.z * this.look.head.depth * 1.03,
        );
        positions.push(
          center.x - side * 0.0002,
          center.y + halfThickness * taper,
          center.z,
          center.x,
          center.y - halfThickness * taper,
          center.z,
        );
        if (i < steps) {
          const a = i * 2;
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const ribbon = new THREE.BufferGeometry();
      ribbon.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      ribbon.setIndex(indices);
      ribbon.computeVertexNormals();
      const ribbonMesh = new THREE.Mesh(ribbon, browMaterial);
      ribbonMesh.name = side < 0 ? 'avatar-brow-ribbon-left' : 'avatar-brow-ribbon-right';
      this.headGroup.add(ribbonMesh);
    }
    for (const side of [-1, 1] as const) {
      const strands = new THREE.InstancedMesh(browStrand, browMaterial, 56);
      strands.name = side < 0 ? 'avatar-brow-left' : 'avatar-brow-right';
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const positionVec = new THREE.Vector3();
      const scaleVec = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      const tangent = new THREE.Vector3();
      const mirrorForCharacterLeft = (point: THREE.Vector3) =>
        side < 0 ? point.clone().setX(-point.x) : point.clone();
      const inner = mirrorForCharacterLeft(browArc.inner);
      const outer = mirrorForCharacterLeft(browArc.outer);
      for (let i = 0; i < 56; i++) {
        const t = this.seeded();
        const dir = new THREE.Vector3().copy(inner).lerp(outer, t);
        dir.y += Math.sin(t * Math.PI) * browArc.arch;
        dir.normalize();
        positionVec.set(
          dir.x * this.look.head.width * 1.04,
          dir.y * this.look.head.height * 1.04,
          dir.z * this.look.head.depth * 1.04,
        );
        tangent.copy(outer).sub(inner).normalize();
        const out = dir.clone().addScaledVector(tangent, 0.35).add(new THREE.Vector3(0, 0.35, 0)).normalize();
        quaternion.setFromUnitVectors(up, out);
        quaternion.multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), side * (this.seeded() - 0.5) * 0.6),
        );
        scaleVec.set(1, 0.55 + this.seeded() * 0.7, 1);
        matrix.compose(positionVec, quaternion, scaleVec);
        strands.setMatrixAt(i, matrix);
      }
      strands.instanceMatrix.needsUpdate = true;
      this.headGroup.add(strands);
    }

    // بینی به‌صورت مجسمه‌سازی روی خود جمجمه ساخته می‌شود؛ فقط نوک را با یک
    // کرهٔ بسیار کوچک و هم‌رنگ پوست نرم می‌کنیم تا لبهٔ مش تیز نماند.
    const nosePoint = (direction: THREE.Vector3, inset = 0) => surfaceAt(direction, inset);
    const noseTipMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), skin);
    noseTipMesh.name = 'avatar-nose-tip';
    noseTipMesh.scale.set(0.006 + this.look.head.noseWidth * 0.002, 0.0055, 0.006);
    noseTipMesh.position.copy(nosePoint(this.anchors.noseTip, 0.002));
    this.headGroup.add(noseTipMesh);

    // لب‌ها و خط دهان: مش مجزا تا «دهان» از فاصلهٔ دو متر هم خوانده شود
    const lipMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(this.look.skinHex).lerp(new THREE.Color(0x8c3a36), 0.42),
      roughness: 0.34,
      clearcoat: 0.55,
      clearcoatRoughness: 0.35,
      sheen: 0.3,
      sheenColor: new THREE.Color(0xff9a8a),
      sheenRoughness: 0.6,
    });
    const mouthLineMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x3a1b1c),
      roughness: 0.55,
    });
    this.materials.push(lipMaterial, mouthLineMaterial);
    const buildLips = () => {
      const head3 = this.look.head;
      const mouthDir = this.anchors.mouth.clone();
      const mouthPoint = surfaceAt(mouthDir, 0.004);
      const outward = mouthDir.clone().normalize();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, -1),
        outward,
      );
      const lipWidth = 0.022 + head3.lipFullness * 0.005;
      const eyeLineThickness = () => 0.00055;
      const group = new THREE.Group();
      group.name = 'avatar-lips';
      group.position.copy(mouthPoint);
      group.quaternion.copy(quaternion);

      const upper = new THREE.Mesh(
        new THREE.SphereGeometry(1, 18, 12),
        lipMaterial,
      );
      upper.scale.set(lipWidth * 1.15, 0.0045, head3.lipFullness * 0.0022);
      upper.position.set(0, 0.0042, 0);
      group.add(upper);

      const lower = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), lipMaterial);
      lower.scale.set(lipWidth * 1.05, 0.0058, head3.lipFullness * 0.0026);
      lower.position.set(0, -0.0062, 0.0004);
      group.add(lower);

      const separation = new THREE.Mesh(
        new THREE.BoxGeometry(lipWidth * 1.8, eyeLineThickness(), 0.0012),
        mouthLineMaterial,
      );
      separation.position.set(0, 0.0004, -0.0024);
      group.add(separation);

      // خط بستهٔ دهان: یک باکسِ بسیار نازک که فقط شکاف را تیره می‌کند
      this.headGroup.add(group);
    };
    buildLips();

    // سوراخ‌های بینی: دو حفرهٔ کوچک دقیقاً در «کفِ» بینی
    const noseBase = surfaceAt(this.anchors.noseTip, 0.002);
    for (const side of [-1, 1] as const) {
      const nostrilMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.0026, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x3a201c, roughness: 0.8 }),
      );
      nostrilMesh.name = side < 0 ? 'avatar-nostril-left' : 'avatar-nostril-right';
      nostrilMesh.position.set(
        side * (0.0042 + this.look.head.noseWidth * 0.004),
        noseBase.y - 0.0044,
        noseBase.z + 0.0022,
      );
      nostrilMesh.scale.set(1.15, 0.6, 0.75);
      this.headGroup.add(nostrilMesh);
    }

    // ریش/سبیل برای صورت‌های مردانه: تارهای کوتاه روی خط فک
    if (this.look.facialHair === 'beard' || this.look.facialHair === 'moustache' || this.look.facialHair === 'stubble') {
      const beardMaterial = new THREE.MeshStandardMaterial({
        color: this.look.hairHex,
        roughness: 0.6,
        transparent: true,
        opacity: this.look.facialHair === 'stubble' ? 0.55 : 0.95,
      });
      this.materials.push(beardMaterial);
      const count = this.look.facialHair === 'beard' ? 240 : this.look.facialHair === 'moustache' ? 90 : 150;
      const strands = new THREE.InstancedMesh(buildStrand(0.008, 0.0007, 0.0012), beardMaterial, count);
      strands.name = 'avatar-facial-hair';
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const positionVec = new THREE.Vector3();
      for (let i = 0; i < count; i++) {
        const t = this.seeded();
        const side = this.seeded() < 0.5 ? -1 : 1;
        const onMoustache = this.look.facialHair === 'moustache' || this.seeded() < 0.25;
        const dir = onMoustache
          ? new THREE.Vector3(side * (0.03 + t * 0.08), -0.42, -0.9).normalize()
          : new THREE.Vector3(side * (0.1 + t * 0.28), -0.55 - t * 0.18, -0.72).normalize();
        positionVec.set(dir.x * this.look.head.width * 1.03, dir.y * this.look.head.height * 1.03, dir.z * this.look.head.depth * 1.03);
        quaternion.setFromUnitVectors(up, dir.clone().add(new THREE.Vector3(0, 0.1, 0)).normalize());
        matrix.compose(positionVec, quaternion, new THREE.Vector3(1, 0.7 + this.seeded() * 0.5, 1));
        strands.setMatrixAt(i, matrix);
      }
      strands.instanceMatrix.needsUpdate = true;
      this.headGroup.add(strands);
    }
  }

  private buildHair(material: THREE.Material): void {
    const head = this.look.head;
    const style = this.look.hair.style;
    const volume = this.look.hair.volume;
    const radial = 84;
    const rings = 26;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const hairline = (u: number): number => {
      // frontness: ۱ در صورت، ۰ در پشت سر
      const frontness = Math.cos((u - 0.75) * Math.PI * 2) * 0.5 + 0.5;
      const base = THREE.MathUtils.degToRad(56 + (1 - frontness) * 44);
      const styleLift =
        style === 'slick' ? -4 : style === 'bun' ? 4 : style === 'long' ? 10 : style === 'curly' ? 2 : 0;
      // خط موی نامنظم + عقب‌نشینی شقیقه‌ها: خطِ صافِ کلاه‌خود، مصنوعی‌ترین چیز ممکن است
      const wobble =
        Math.sin(u * Math.PI * 18 + 1.7) * 2.6 +
        Math.sin(u * Math.PI * 7 + 0.4) * 3.4 +
        Math.sin(u * Math.PI * 41) * 1.1;
      const temple = Math.pow(Math.abs(Math.cos((u - 0.75) * Math.PI * 2)), 6) * 5.5;
      return (
        base +
        THREE.MathUtils.degToRad(styleLift) * (1 - frontness * 0.4) +
        THREE.MathUtils.degToRad(wobble + temple)
      );
    };

    for (let i = 0; i <= rings; i++) {
      const v = i / rings;
      for (let j = 0; j <= radial; j++) {
        const u = j / radial;
        const phi = u * Math.PI * 2;
        const thetaMax = hairline(u);
        const theta = Math.pow(v, 0.9) * thetaMax;
        const sinTheta = Math.sin(theta);
        const x = -Math.cos(phi) * sinTheta;
        const y = Math.cos(theta);
        const z = Math.sin(phi) * sinTheta;

        const lift = (0.004 + volume * 0.012) * Math.sin(Math.min(1, v * 1.4) * Math.PI * 0.5);
        const wave = style === 'wavy' || style === 'curly'
          ? Math.sin(theta * 9 + phi * 3) * 0.0035 * volume
          : 0;
        const thickness = 1 + (lift + wave) / Math.max(0.04, head.width);
        // تاج مو بالاتر از پوست سر و با موجِ آرام
        positions.push(
          x * head.width * 1.05 * thickness,
          y * head.height * 1.05 + 0.006 + wave * 0.4,
          z * head.depth * 1.055 * thickness,
        );
        uvs.push(u, v);
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j;
        const b = a + radial + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const cap = new THREE.Mesh(geometry, material);
    cap.name = 'avatar-hair-cap';
    cap.castShadow = true;
    this.hairGroup.add(cap);

    // تارهای مجزا: حس «مو» در نور کناری
    const strandCount = 420;
    const strands = new THREE.InstancedMesh(buildStrand(0.032, 0.0013, 0.004), material, strandCount);
    strands.name = 'avatar-hair-strands';
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const positionVec = new THREE.Vector3();
    const scaleVec = new THREE.Vector3();
    for (let i = 0; i < strandCount; i++) {
      const u = this.seeded();
      const v = 0.22 + Math.sqrt(this.seeded()) * 0.7;
      const phi = u * Math.PI * 2;
      const theta = v * hairline(u) * 0.8;
      const sinTheta = Math.sin(theta);
      const dir = new THREE.Vector3(-Math.cos(phi) * sinTheta, Math.cos(theta), Math.sin(phi) * sinTheta);
      positionVec.set(dir.x * head.width * 1.035, dir.y * head.height * 1.03, dir.z * head.depth * 1.04);
      // تارها روی سطح می‌خوابند و به سمت پایین شانه می‌شوند (نه سیخِ بیرون‌زده)
      const comb = new THREE.Vector3(dir.x * 0.9, -0.42, dir.z * 0.9).normalize();
      quaternion.setFromUnitVectors(up, comb);
      scaleVec.set(1, 0.45 + this.seeded() * 0.5, 1);
      matrix.compose(positionVec, quaternion, scaleVec);
      strands.setMatrixAt(i, matrix);
    }
    strands.instanceMatrix.needsUpdate = true;
    this.hairGroup.add(strands);

    // سایهٔ شقیقه/گیس‌بند: دو گوهٔ کوچک روبه‌روی گوش
    for (const side of [-1, 1] as const) {
      const sideburn = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
        material,
      );
      sideburn.name = side < 0 ? 'avatar-sideburn-left' : 'avatar-sideburn-right';
      sideburn.scale.set(0.3, 1.1, 0.5);
      sideburn.position.set(side * head.width * 0.9, head.height * 0.26, head.depth * 0.1);
      sideburn.rotation.z = side * 0.22;
      this.hairGroup.add(sideburn);
    }

    if (style === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 16), material);
      bun.name = 'avatar-hair-bun';
      bun.position.set(0, head.height * 0.55, head.depth * 0.75);
      bun.scale.set(1, 0.85, 0.9);
      bun.castShadow = true;
      this.hairGroup.add(bun);
    }
    if (style === 'long') {
      const fall = new THREE.Mesh(
        buildLoft(
          [
            { y: head.height * 0.5, rx: head.width * 0.9, rz: head.depth * 0.75, cz: head.depth * 0.15 },
            { y: -head.height * 0.5, rx: head.width * 1.02, rz: head.depth * 0.82, cz: head.depth * 0.25 },
            { y: -head.height * 1.5, rx: head.width * 0.95, rz: head.depth * 0.72, cz: head.depth * 0.3 },
            { y: -head.height * 2.1, rx: head.width * 0.7, rz: head.depth * 0.5, cz: head.depth * 0.25 },
          ],
          22,
          { noise: 0.03, seed: 91, capTop: false, capBottom: false },
        ),
        material,
      );
      fall.name = 'avatar-hair-fall';
      fall.castShadow = true;
      this.hairGroup.add(fall);
    }
  }

  private buildArm(
    side: -1 | 1,
    coat: THREE.Material,
    shirt: THREE.Material,
    skin: THREE.Material,
    gold: THREE.Material,
  ): THREE.Group {
    const arm = new THREE.Group();
    arm.name = side < 0 ? 'avatar-arm-left' : 'avatar-arm-right';
    arm.position.set(side * 0.188, SHOULDER_Y - 0.02, 0);
    arm.rotation.z = side * -0.06;
    this.add(arm);

    // کتف و بازو
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.049, 20, 16), coat);
    shoulderCap.name = side < 0 ? 'avatar-shoulder-left' : 'avatar-shoulder-right';
    shoulderCap.position.set(side * 0.0, -0.02, 0);
    shoulderCap.scale.set(1, 1.05, 1);
    shoulderCap.castShadow = true;
    arm.add(shoulderCap);

    const upper = new THREE.Mesh(
      buildLoft(
        limbRings(0.29, [
          { t: 0, radius: 0.05 },
          { t: 0.14, radius: 0.052 },
          { t: 0.5, radius: 0.046 },
          { t: 0.92, radius: 0.039 },
        ], 0.95),
        20,
        { noise: 0.02, seed: 43, capTop: true, capBottom: false },
      ),
      coat,
    );
    upper.castShadow = true;
    arm.add(upper);

    const elbow = new THREE.Group();
    elbow.name = side < 0 ? 'avatar-elbow-left' : 'avatar-elbow-right';
    elbow.position.set(0, -0.29, 0);
    arm.add(elbow);

    const forearm = new THREE.Mesh(
      buildLoft(
        limbRings(0.24, [
          { t: 0, radius: 0.045 },
          { t: 0.2, radius: 0.046 },
          { t: 0.6, radius: 0.037 },
          { t: 1, radius: 0.028 },
        ], 0.9),
        18,
        { noise: 0.018, seed: 51, capTop: false, capBottom: false },
      ),
      coat,
    );
    forearm.castShadow = true;
    elbow.add(forearm);

    // سرآستین سفید
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.031, 0.033, 0.035, 18),
      shirt,
    );
    cuff.position.set(0, -0.235, 0);
    elbow.add(cuff);

    const cufflink = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 10), gold);
    cufflink.rotation.z = Math.PI / 2;
    cufflink.position.set(0, -0.233, -0.032);
    elbow.add(cufflink);

    // دست: کف دست مجسم + چهار انگشت + شست
    const hand = new THREE.Group();
    hand.name = side < 0 ? 'avatar-hand-left' : 'avatar-hand-right';
    hand.position.set(0, -0.258, 0);
    elbow.add(hand);

    const palm = new THREE.Mesh(
      buildLoft(
        [
          { y: 0, rx: 0.026, rz: 0.017 },
          { y: -0.03, rx: 0.031, rz: 0.019 },
          { y: -0.062, rx: 0.033, rz: 0.018 },
          { y: -0.082, rx: 0.031, rz: 0.015 },
        ],
        14,
        { noise: 0.02, seed: 77, capTop: true, capBottom: true },
      ),
      skin,
    );
    palm.castShadow = true;
    hand.add(palm);

    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Group();
      const x = (f - 1.5) * 0.016;
      finger.position.set(x, -0.078, 0);
      finger.rotation.x = -0.22 - f * 0.03;
      finger.rotation.z = side * (f - 1.5) * 0.05;
      const length = 0.05 - Math.abs(f - 1.2) * 0.004;
      const geometry = buildLoft(
        [
          { y: 0, rx: 0.0072, rz: 0.0072 },
          { y: -length * 0.45, rx: 0.0068, rz: 0.0068 },
          { y: -length * 0.8, rx: 0.0058, rz: 0.0058 },
          { y: -length, rx: 0.0046, rz: 0.0046 },
        ],
        8,
        { noise: 0.02, seed: 90 + f, capTop: false, capBottom: true },
      );
      const mesh = new THREE.Mesh(geometry, skin);
      mesh.castShadow = true;
      finger.add(mesh);
      hand.add(finger);
    }

    const thumb = new THREE.Group();
    thumb.name = side < 0 ? 'avatar-thumb-left' : 'avatar-thumb-right';
    thumb.position.set(side * 0.03, -0.032, -0.004);
    thumb.rotation.set(-0.7, 0, side * 0.9);
    const thumbMesh = new THREE.Mesh(
      buildLoft(
        [
          { y: 0, rx: 0.0085, rz: 0.009 },
          { y: -0.03, rx: 0.0078, rz: 0.008 },
          { y: -0.045, rx: 0.006, rz: 0.006 },
        ],
        8,
        { noise: 0.02, seed: 101, capTop: true, capBottom: true },
      ),
      skin,
    );
    thumb.add(thumbMesh);
    hand.add(thumb);

    return arm;
  }

  private buildLeg(side: -1 | 1, trousers: THREE.Material, shoes: THREE.Material): THREE.Group {
    const leg = new THREE.Group();
    leg.name = side < 0 ? 'avatar-leg-left' : 'avatar-leg-right';
    leg.position.set(side * 0.079, HIP_Y, 0);
    this.add(leg);

    const thigh = new THREE.Mesh(
      buildLoft(
        limbRings(0.44, [
          { t: 0, radius: 0.062 },
          { t: 0.16, radius: 0.072 },
          { t: 0.5, radius: 0.066 },
          { t: 0.85, radius: 0.057 },
          { t: 1, radius: 0.055 },
        ], 1.02),
        20,
        { noise: 0.018, seed: 113, capTop: true, capBottom: false },
      ),
      trousers,
    );
    thigh.castShadow = true;
    leg.add(thigh);

    const knee = new THREE.Group();
    knee.name = side < 0 ? 'avatar-knee-left' : 'avatar-knee-right';
    knee.position.set(0, -0.44, 0);
    leg.add(knee);

    const calf = new THREE.Mesh(
      buildLoft(
        limbRings(0.4, [
          { t: 0, radius: 0.053 },
          { t: 0.25, radius: 0.055 },
          { t: 0.6, radius: 0.041 },
          { t: 0.9, radius: 0.03 },
          { t: 1, radius: 0.027 },
        ], 0.95),
        18,
        { noise: 0.02, seed: 127, capTop: false, capBottom: false },
      ),
      trousers,
    );
    calf.castShadow = true;
    knee.add(calf);

    const ankle = new THREE.Group();
    ankle.name = side < 0 ? 'avatar-ankle-left' : 'avatar-ankle-right';
    ankle.position.set(0, -0.4, 0);
    knee.add(ankle);

    // کفش: نمای جانبیِ مجسم با پاشنه و پنجهٔ گرد، رو به -Z
    const shape = new THREE.Shape();
    shape.moveTo(0.055, 0.078);
    shape.lineTo(0.062, 0.04);
    shape.lineTo(0.058, 0.004);
    shape.quadraticCurveTo(0.05, -0.008, 0.02, -0.008);
    shape.lineTo(-0.14, -0.006);
    shape.quadraticCurveTo(-0.175, -0.002, -0.176, 0.018);
    shape.quadraticCurveTo(-0.17, 0.048, -0.12, 0.055);
    shape.quadraticCurveTo(-0.03, 0.066, 0.02, 0.082);
    shape.closePath();
    const shoeGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.088,
      bevelEnabled: true,
      bevelSize: 0.008,
      bevelThickness: 0.006,
      bevelSegments: 3,
      curveSegments: 12,
    });
    shoeGeometry.translate(0, 0, -0.044);
    shoeGeometry.rotateY(Math.PI / 2);
    const shoe = new THREE.Mesh(shoeGeometry, shoes);
    shoe.name = 'avatar-shoe';
    shoe.position.set(0, -0.075, 0);
    shoe.castShadow = true;
    shoe.receiveShadow = true;
    ankle.add(shoe);

    const sole = new THREE.Mesh(
      new THREE.BoxGeometry(0.094, 0.012, 0.245),
      new THREE.MeshStandardMaterial({ color: 0x0c0909, roughness: 0.9 }),
    );
    sole.name = 'avatar-sole';
    sole.position.set(0, -0.094, -0.055);
    ankle.add(sole);

    return leg;
  }

  private buildSeatedLeg(
    side: -1 | 1,
    trousers: THREE.Material,
    shoes: THREE.Material,
  ): THREE.Group {
    const leg = new THREE.Group();
    leg.name = side < 0 ? 'avatar-leg-left' : 'avatar-leg-right';
    leg.position.set(side * 0.095, 0.52, 0.02);
    this.add(leg);

    // رانِ افقی (رو به صحنهٔ -Z)
    const thigh = new THREE.Mesh(
      buildLoft(
        limbRings(0.42, [
          { t: 0, radius: 0.094 },
          { t: 0.2, radius: 0.09 },
          { t: 0.6, radius: 0.076 },
          { t: 1, radius: 0.062 },
        ], 1.05),
        20,
        { noise: 0.018, seed: 141, capTop: true, capBottom: false },
      ),
      trousers,
    );
    thigh.rotation.x = Math.PI / 2 - 0.055;
    thigh.position.set(0, 0, -0.006);
    thigh.castShadow = true;
    leg.add(thigh);

    // ساق از زانو تا مچ، عمود بر زمین
    const calf = new THREE.Mesh(
      buildLoft(
        limbRings(0.43, [
          { t: 0, radius: 0.06 },
          { t: 0.25, radius: 0.062 },
          { t: 0.62, radius: 0.045 },
          { t: 1, radius: 0.031 },
        ], 0.95),
        18,
        { noise: 0.02, seed: 151, capTop: false, capBottom: false },
      ),
      trousers,
    );
    calf.position.set(0, -0.015, -0.425);
    calf.rotation.x = -0.035;
    calf.castShadow = true;
    leg.add(calf);

    // کفش (آخرین فرزند گروه پا — قرارداد تست/برخورد صندلی)
    const shape = new THREE.Shape();
    shape.moveTo(0.055, 0.078);
    shape.lineTo(0.062, 0.04);
    shape.lineTo(0.058, 0.004);
    shape.quadraticCurveTo(0.05, -0.008, 0.02, -0.008);
    shape.lineTo(-0.14, -0.006);
    shape.quadraticCurveTo(-0.175, -0.002, -0.176, 0.018);
    shape.quadraticCurveTo(-0.17, 0.048, -0.12, 0.055);
    shape.quadraticCurveTo(-0.03, 0.066, 0.02, 0.082);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.088,
      bevelEnabled: true,
      bevelSize: 0.008,
      bevelThickness: 0.006,
      bevelSegments: 3,
      curveSegments: 12,
    });
    geometry.translate(0, 0, -0.044);
    geometry.rotateY(Math.PI / 2);
    const shoe = new THREE.Mesh(geometry, shoes);
    shoe.name = 'avatar-shoe';
    shoe.position.set(0, -0.495, -0.42);
    shoe.castShadow = true;
    shoe.receiveShadow = true;
    leg.add(shoe);

    return leg;
  }

  private applySeatedPose(): void {
    // دست‌ها روی ران‌ها؛ شانه‌ها پایین‌تر از حالت ایستاده
    this.leftArm.position.set(-0.19, 1.02, 0.02);
    this.rightArm.position.set(0.19, 1.02, 0.02);
    for (const [arm, side] of [[this.leftArm, -1], [this.rightArm, 1]] as const) {
      arm.rotation.x = -0.32;
      arm.rotation.z = side * 0.06;
    }
    if (this.leftElbow) {
      this.leftElbow.rotation.x = -0.78;
      this.rightElbow.rotation.x = -0.78;
      this.leftElbow.rotation.y = -0.18;
      this.rightElbow.rotation.y = 0.18;
    }
    this.torsoGroup.rotation.x = -0.035;
    const skirt = this.torsoGroup.getObjectByName('avatar-coat-skirt');
    if (skirt) skirt.visible = false;
  }

  private applyAccessories(gold: THREE.Material, dark: THREE.Material, coat: THREE.Material): void {
    if (this.look.accessory === 'glasses') {
      // عینک دورِ چشم‌ها ساخته می‌شود، نه شناور در جلوی صورت: حلقه دور هر چشم
      // و یک پل کوتاه که دقیقاً روی پل بینی می‌نشیند.
      const frame = new THREE.MeshStandardMaterial({ color: 0x241c16, roughness: 0.3, metalness: 0.7 });
      this.materials.push(frame);
      const eyeScale = this.look.head.eyeSize;
      for (const [eye, side] of [[this.leftEye, -1], [this.rightEye, 1]] as const) {
        const lens = new THREE.Mesh(new THREE.TorusGeometry(0.0138 * eyeScale, 0.0011, 6, 26), frame);
        lens.name = side < 0 ? 'avatar-glasses-lens-left' : 'avatar-glasses-lens-right';
        lens.position.set(0, 0.0005, -0.0195);
        eye.add(lens);
        // دستک عینک روی گوش (نازک، تقریباً نامرئی از روبه‌رو)
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, 0.085, 5), frame);
        arm.rotation.x = Math.PI / 2;
        arm.rotation.z = side * 0.2;
        arm.position.set(side * 0.016, 0.004, 0.03);
        eye.add(arm);
      }
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 0.016, 5), frame);
      bridge.rotation.z = Math.PI / 2;
      const bridgePoint = this.leftEye.position.clone().lerp(this.rightEye.position, 0.5);
      bridge.position.set(bridgePoint.x, bridgePoint.y + 0.003, bridgePoint.z - 0.019);
      this.headGroup.add(bridge);
    }
    if (this.look.accessory === 'earring') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0075, 0.0012, 6, 16), gold);
      ring.position.set(-this.look.head.width * 0.99, -0.026, 0.012);
      ring.rotation.y = Math.PI / 2;
      this.headGroup.add(ring);
    }
    if (this.look.accessory === 'pocket-watch') {
      const chainMaterial = gold;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.03, 0.2, -0.115),
        new THREE.Vector3(0.05, 0.12, -0.12),
        new THREE.Vector3(0.035, 0.02, -0.118),
        new THREE.Vector3(0.015, -0.02, -0.112),
      ]);
      const chain = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0014, 5, false), chainMaterial);
      this.torsoGroup.add(chain);
      const watch = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.005, 18), chainMaterial);
      watch.rotation.x = Math.PI / 2;
      watch.position.set(0.012, -0.03, -0.112);
      this.torsoGroup.add(watch);
      void dark;
      void coat;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // لایهٔ زندگی: پلک، تنفس، نگاه، گام
  // ─────────────────────────────────────────────────────────────

  update(deltaSeconds: number, motion: HumanMotion): void {
    const dt = THREE.MathUtils.clamp(deltaSeconds, 0, 0.1);
    if (dt <= 0) return;
    this.elapsed += dt;

    const targetStride = THREE.MathUtils.clamp(motion.speed / 2.1, 0, 1);
    this.strideBlend += (targetStride - this.strideBlend) * Math.min(1, dt * 8);

    this.walkPhase += motion.speed * dt * 3.4 + dt * this.strideBlend * 1.6;
    const stride = this.strideBlend;
    const legSwing = Math.sin(this.walkPhase) * 0.52 * stride;
    const armSwing = Math.sin(this.walkPhase) * 0.4 * stride;

    if (this.pose === 'standing') {
      this.leftLeg.rotation.x = legSwing;
      this.rightLeg.rotation.x = -legSwing;
      this.leftLeg.rotation.z = 0.02;
      this.rightLeg.rotation.z = -0.02;

      // زانو فقط در فاز عقب خم می‌شود؛ راه‌رفتنِ قفل‌شده کارتونی است
      const leftFlex = Math.max(0, -Math.sin(this.walkPhase + 0.5)) * 0.85 * stride;
      const rightFlex = Math.max(0, Math.sin(this.walkPhase + 0.5)) * 0.85 * stride;
      if (this.leftKnee && this.rightKnee && this.leftAnkle && this.rightAnkle) {
        this.leftKnee.rotation.x = leftFlex + 0.02;
        this.rightKnee.rotation.x = rightFlex + 0.02;
        this.leftAnkle.rotation.x = -legSwing * 0.5 + leftFlex * 0.35;
        this.rightAnkle.rotation.x = legSwing * 0.5 + rightFlex * 0.35;
      }

      this.leftArm.rotation.x = -armSwing;
      this.rightArm.rotation.x = armSwing;
      this.leftArm.rotation.z = -0.055 - Math.abs(armSwing) * 0.04;
      this.rightArm.rotation.z = 0.055 + Math.abs(armSwing) * 0.04;

      const elbowBend = 0.16 + Math.max(0, armSwing) * 0.9;
      this.leftElbow.rotation.x = -elbowBend;
      this.rightElbow.rotation.x = -elbowBend;

      const idlePhase = this.elapsed * 1.55;
      const breath = Math.sin(idlePhase) * 0.006;
      const walkBounce = Math.abs(Math.cos(this.walkPhase)) * 0.018 * stride;
      this.torsoGroup.position.y = HIP_Y + breath + walkBounce;
      this.torsoGroup.position.z = -0.012 * stride;
      this.torsoGroup.rotation.z = Math.sin(idlePhase * 0.6) * 0.012 * (1 - stride);
      this.torsoGroup.rotation.y = Math.sin(this.walkPhase) * 0.05 * stride;
      this.torsoGroup.rotation.x = -0.02 * stride + Math.sin(idlePhase * 0.5) * 0.006;
      this.torsoGroup.scale.set(1 + breath * 0.9, 1 + breath * 0.5, 1 + breath * 0.9);

      this.neckGroup.position.y = 1.52 + breath * 0.8 + walkBounce * 0.6;
      this.neckGroup.rotation.y = this.torsoGroup.rotation.y * 0.4;

      this.headGroup.position.y = HEAD_Y + breath * 0.7 + walkBounce * 0.5;
      this.hairGroup.position.y = this.headGroup.position.y;
    } else {
      const idlePhase = this.elapsed * 1.4;
      const breath = Math.sin(idlePhase) * 0.0045;
      this.torsoGroup.position.y = 0.52 + breath;
      this.torsoGroup.rotation.z = Math.sin(idlePhase * 0.5) * 0.01;
      this.torsoGroup.rotation.x = -0.03 + breath * 0.5;
      this.neckGroup.position.y = 1.16 + breath * 0.8;
      this.headGroup.position.y = 1.24 + breath * 0.7;
      this.hairGroup.position.y = this.headGroup.position.y;
      // دست‌ها روی زانو آرام تکان می‌خورند
      if (this.leftElbow) {
        this.leftElbow.rotation.x = -0.78 + Math.sin(idlePhase + 0.4) * 0.012;
        this.rightElbow.rotation.x = -0.78 + Math.sin(idlePhase + 1.1) * 0.012;
      }
    }

    // ── سر: نگاه به ارتفاع هدف + ریزحرکتِ انسانی
    const pitchRad = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(motion.pitchDeg ?? 0, -30, 30),
    );
    this.headYaw += ((motion.yawRate ?? 0) * dt * 0.12 - this.headYaw) * Math.min(1, dt * 2);
    const microYaw = Math.sin(this.elapsed * 0.37) * 0.02 + Math.sin(this.elapsed * 0.13 + 1.7) * 0.012;
    const microPitch = Math.sin(this.elapsed * 0.29 + 0.6) * 0.008;
    this.headGroup.rotation.x = pitchRad * 0.62 + microPitch;
    this.headGroup.rotation.y = this.headYaw + microYaw;
    this.headGroup.rotation.z = Math.sin(this.elapsed * 0.21) * 0.006;

    // ── چشم: ساکاد (پرش‌های ریزِ نگاه) و پلک‌زدن
    this.saccadeTimer -= dt;
    if (this.saccadeTimer <= 0) {
      this.saccadeTimer = 0.8 + this.seeded() * 2.4;
      const range = this.strideBlend > 0.3 ? 0.05 : 0.13;
      this.saccadeTarget.set((this.seeded() - 0.5) * range, (this.seeded() - 0.5) * range * 0.5);
    }
    this.saccadeCurrent.lerp(this.saccadeTarget, Math.min(1, dt * 12));
    this.leftEye.rotation.y = this.saccadeCurrent.x + 0.02;
    this.rightEye.rotation.y = this.saccadeCurrent.x + 0.02;
    this.leftEye.rotation.x = -this.saccadeCurrent.y;
    this.rightEye.rotation.x = -this.saccadeCurrent.y;

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && !this.blinking) {
      this.blinking = true;
      this.blinkProgress = 0;
      this.doubleBlink = this.seeded() < 0.18;
    }
    if (this.blinking) {
      this.blinkProgress += dt / 0.1;
      if (this.blinkProgress >= 1) {
        if (this.doubleBlink && this.blinkProgress < 1.5) {
          // پلک دومِ کوتاه؛ آدم‌ها اغلب دوبار پلک می‌زنند
          this.blinkProgress = 0.15;
          this.doubleBlink = false;
        } else {
          this.blinking = false;
          this.blinkProgress = 0;
          this.blinkTimer = 2.4 + this.seeded() * 4.2;
        }
      }
    }
    const blinkEase = Math.sin(Math.min(1, this.blinkProgress) * Math.PI);
    const lidRotation = THREE.MathUtils.lerp(-0.2, -1.05, blinkEase);
    this.leftEyelid.rotation.x = lidRotation;
    this.rightEyelid.rotation.x = lidRotation;

    // ── تغییر وزن و لرزش بسیار ملایم بدن
    this.position.y = Math.sin(this.elapsed * 0.9) * 0.0015 * (1 - this.strideBlend);
  }

  /** مختصات دقیق نقطهٔ میانی دو چشم در فضای جهان (هم در حالت ایستاده و هم نشسته) */
  getEyeWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    this.updateWorldMatrix(true, true);
    const left = this.leftEye.getWorldPosition(new THREE.Vector3());
    const right = this.rightEye.getWorldPosition(new THREE.Vector3());
    return target.copy(left).add(right).multiplyScalar(0.5);
  }

  /** پلک‌زدن دستی (برای برش‌ها/جامپ‌اسکر) */
  blink(): void {
    this.blinkTimer = 0;
    this.blinking = true;
    this.blinkProgress = 0;
  }

  dispose(): void {
    this.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
        object.geometry.dispose();
        if (object instanceof THREE.InstancedMesh) object.dispose();
      }
    });
    for (const material of this.materials) material.dispose();
    this.textures.dispose();
    this.clear();
  }
}

/** ساخت آواتار با چهرهٔ مشتق‌شده از playerId/صندلی */
export function createHumanAvatar(
  look: HumanLook,
  options: { pose?: HumanPose; displayName?: string } = {},
) : ProceduralHumanAvatar {
  return new ProceduralHumanAvatar({ look, pose: options.pose, displayName: options.displayName ?? look.displayName });
}

export {
  BASE_HEIGHT_METERS,
  HIP_Y,
  SHOULDER_Y,
  HEAD_Y,
  DEFAULT_PLAYER_EYE_HEIGHT,
  getHumanEyeHeight,
  calibrateHumanHeightForEyeLevel,
};
