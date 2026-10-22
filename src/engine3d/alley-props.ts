'use client';

/**
 * alley-props.ts — تجهیزات شهری، تیرهای چراغ برق سوسوزن، کابل‌های هوایی و جعبه‌های کوچه (علیرضا)
 * - تیر چراغ برق کلاسیک گالوانیزهٔ دایره‌ای (پایهٔ بتنی گرد، فلنج و پیچ، ستون فولادی مخروطی،
 *   بازوی لوله‌ای منحنی، سر چراغ گرد با گوی شیشه‌ای، پرتو مخروطی مه و SpotLight سوسوزن نرم)
 * - کابل‌های برق شکم‌داده (Catenary) در طول کوچه و عرض آسمان بین ساختمان‌ها
 * - دسته جعبه‌های چوبی میخ‌کوب، پالت باربری، بشکهٔ فلزی زنگ‌زده و چادر برزنتی
 */

import * as THREE from 'three';
import { withUv2 } from './alley-materials';
import { alleyGroundCrownAt } from './alley-ground-profile';

export type FlickerProfile = 'broken' | 'nervous' | 'dying';

function fracHash(x: number): number {
  const s = Math.sin(x * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * منحنی سوسوزدن واقع‌گرایانهٔ اتصالی برق / بالاست فرسوده (کاملاً قطعی برای تست واحد):
 * - broken: چراغ معیوب وسط کوچه با اتصالی‌های ناگهانی، خاموشی لحظه‌ای و پرش دوباره
 * - nervous: چراغ ابتدای کوچه، عمدتاً روشن با افت ولتاژهای کوتاه
 * - dying: چراغ انتهای کوچه با نوسان کند تنگستن نیمه‌سوخته
 */
export function computeStreetlampFlicker(
  elapsedSeconds: number,
  seed = 1,
  profile: FlickerProfile = 'broken',
): number {
  if (!Number.isFinite(elapsedSeconds)) return 1;
  const t = Math.max(0, elapsedSeconds);
  const hum = 0.96 + 0.04 * Math.sin(t * 37.7 + seed * 2.1);

  if (profile === 'nervous') {
    const slot = Math.floor(t * 2.4 + seed * 3.7);
    const sub = (t * 2.4 + seed * 3.7) - slot;
    const glitch = fracHash(slot + seed * 17);
    if (glitch > 0.86 && sub < 0.28) {
      return 0.34 + 0.25 * Math.sin(sub * 45);
    }
    return hum * (0.92 + 0.08 * Math.sin(t * 2.3 + seed));
  }

  if (profile === 'dying') {
    const slow = 0.72 + 0.24 * Math.sin(t * 1.35 + seed * 1.9) * Math.cos(t * 0.61 + seed);
    const slot = Math.floor(t * 3.6 + seed * 5.3);
    const glitch = fracHash(slot * 1.7 + seed * 29);
    const dip = glitch > 0.82 ? 0.38 : 1.0;
    return Math.max(0.12, slow * dip * hum);
  }

  // broken — اتصالی واقعی تیر چراغ برق قدیمی
  const windowIdx = Math.floor(t * 0.85 + seed * 1.3);
  const windowPhase = (t * 0.85 + seed * 1.3) - windowIdx;
  const burstChance = fracHash(windowIdx * 3.1 + seed * 11.7);

  // در حدود ۵۵٪ بازه‌ها چراغ با لرزش ریز روشن است، در ۴۵٪ بازه‌ها دچار اتصالی شدید می‌شود
  if (burstChance < 0.52 && windowPhase > 0.22) {
    return hum * (0.86 + 0.12 * Math.sin(t * 6.1 + seed));
  }

  const rapidSlot = Math.floor(t * 15.5 + seed * 7.9);
  const h = fracHash(rapidSlot + seed * 41.3);
  if (h < 0.28) return 0.04 + h * 0.18; // قطع لحظه‌ای جریان
  if (h < 0.56) return 0.22 + h * 0.42; // نیم‌سوز کم‌نور
  if (h > 0.88) return 1.18; // جرقهٔ وصل مجدد
  return 0.78 * hum;
}

/**
 * تکسچر گرادیان نرم برای مخروط مهِ زیر چراغ برق.
 * پروفایل ارتفاعی حالا یک زنگ نرم است (smoothstep در دو سر) به‌جای توان تیز،
 * تا پرتو از نوک چراغ با ملایمت شروع شود، در میانه قوی‌ترین حالت را داشته باشد
 * و پیش از رسیدن به زمین کاملاً محو شود — «خط نور» تیز روی سنگ‌فرش نمی‌ماند.
 */
export function createLightConeAlphaTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const smoothstep = (edge0: number, edge1: number, value: number) => {
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < size; y++) {
    const v = y / (size - 1); // 0 پایین مخروط، 1 نوک بالا نزدیک لامپ
    // بالا رفتن نرم از زمین + محو شدن نرم در نوک (دو زنگ روی هم)
    const verticalFade = smoothstep(0, 0.55, v) * (1 - smoothstep(0.62, 1, v));
    for (let x = 0; x < size; x++) {
      const val = Math.max(0, Math.min(255, Math.round(verticalFade * 255)));
      const off = (y * size + x) * 4;
      data[off] = 255;
      data[off + 1] = 214;
      data[off + 2] = 156;
      data[off + 3] = val;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  tex.name = 'StreetlampBeamAlpha';
  return tex;
}

/**
 * ماسک آلفای «هالهٔ نور» چراغ برق روی سنگ‌فرش.
 *
 * مخروط SpotLight ذاتاً یک لبهٔ هندسی دارد؛ حتی با penumbra کامل هم مرز استخر
 * نور روی زمین یک منحنی دقیق و ماشینی است. این هاله یک لکهٔ گرمِ کاملاً نرم و
 * کمی نامنظم است که زیر چراغ روی زمین می‌نشیند؛ چون لبه‌اش ارگانیک و محو است،
 * «خط نور» روی سنگ‌فرش دیگر مستقیم و مصنوعی دیده نمی‌شود.
 */
export function createLampPoolAlphaTexture(seed = 17, size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const smoothstep = (edge0: number, edge1: number, value: number) => {
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };
  for (let py = 0; py < size; py++) {
    const ny = (py / (size - 1)) * 2 - 1;
    for (let px = 0; px < size; px++) {
      const nx = (px / (size - 1)) * 2 - 1;
      const dist = Math.hypot(nx, ny * 0.92);
      // لبهٔ آلی و نامنظم (دو موج با فرکانس متفاوت) تا استخر نور دایرهٔ ماشینی نباشد
      const warp =
        (valueNoise(nx * 2.6 + 5, ny * 2.6 + 9, seed) - 0.5) * 0.26 +
        (valueNoise(nx * 6.4 + 21, ny * 6.4 + 3, seed + 37) - 0.5) * 0.1;
      const t = Math.max(0, Math.min(1, dist + warp));
      // افت نرم و پیوسته از مرکز تا لبه، با شیب صفر در هر دو سر
      const alpha = Math.pow(1 - smoothstep(0, 1, t), 1.6);
      const b = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
      const off = (py * size + px) * 4;
      data[off] = b;
      data[off + 1] = b;
      data[off + 2] = b;
      data[off + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  tex.name = 'StreetlampGroundPoolAlpha';
  return tex;
}

/** نویز مقداری دوخطی ساده (همان خانوادهٔ نویز بافت‌های کوچه) */
function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const ux = x - ix;
  const uy = y - iy;
  const a = hash2D(ix, iy, seed);
  const b = hash2D(ix + 1, iy, seed);
  const c = hash2D(ix, iy + 1, seed);
  const d = hash2D(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function hash2D(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * سبک بدنهٔ تیر چراغ برق:
 * - wood: تیر چوبی-چدنی قدیمی دههٔ ۱۹۲۰ با تراورس و مقرهٔ چینی (سه تیر فعلی کوچه)
 * - galvanized: تیر فولاد گالوانیزهٔ کلاسیک، کاملاً دایره‌ای، با سر چراغ گرد و گوی شیشه‌ای
 */
export interface UtilityPoleOptions {
  id: string;
  position: { x: number; y: number; z: number };
  /** +1 یعنی بازوی چراغ به سمت +X (برای تیر سمت چپ)، -1 یعنی به سمت -X (برای تیر سمت راست) */
  armSide: 1 | -1;
  profile: FlickerProfile;
  seed: number;
  baseIntensity: number;
  castShadow?: boolean;
  beamTexture: THREE.DataTexture;
  environmentMap: THREE.Texture;
  /** تکسچر هالهٔ نور روی زمین؛ اگر نیامده باشد خودِ تیر یکی می‌سازد */
  poolTexture?: THREE.DataTexture;
}

export interface UtilityPoleInstance {
  readonly group: THREE.Group;
  readonly spotLight: THREE.SpotLight;
  readonly insulatorWorldPositions: THREE.Vector3[];
  update(elapsedSeconds: number): number;
}

/**
 * تنظیمات مشترک نور چراغ‌های برق کوچه.
 *
 * نور قدیمی یک SpotLight با penumbra ۰٫۶۸ بود: ۳۲٪ داخلی مخروط روشنایی کامل و
 * ثابت داشت و بعد یک‌دفعه محو می‌شد؛ روی سنگ‌فرش یک لکهٔ دایره‌ای با «خط» تیز
 * لبه می‌ساخت که مصنوعی دیده می‌شد. حالا penumbra تقریباً ۱ است، یعنی روشنایی
 * از مرکز تا لبهٔ مخروط پیوسته کم می‌شود، زاویه بازتر و رنگ هم ملایم‌تر است.
 */
export const SOFT_STREETLIGHT = {
  /** نیم‌زاویهٔ مخروط نور (رادیان) — استخر نور به‌جای پوشاندن کل کوچه،
   *  حدود ۴٫۵ متر شعاع دارد، ولی لبه‌اش کاملاً محو است */
  angle: Math.PI * 0.24,
  /** محو شدن کامل لبه — هیچ خط تیزی روی زمین نمی‌ماند */
  penumbra: 1,
  /** افت نور طبیعی‌تر با فاصله */
  decay: 1.7,
  distance: 20,
  /** رنگ کهربایی ملایم‌تر و کم‌اشباع‌تر از قبل (0xffa958) */
  color: 0xffc485,
  /** ضریب شدت پایه (جبران روشنایی ازدست‌رفتهٔ سکوی مرکز مخروط) */
  intensityFactor: 1.05,
} as const;

/** فاصلهٔ دهانهٔ مخروط مهٔ حجمی از سطح زمین بر اساس زاویهٔ نور */
export function streetlightBeamRadius(lampHeight = 4.66): number {
  return Math.tan(SOFT_STREETLIGHT.angle) * lampHeight * 1.02;
}

interface PoleBodyResult {
  /** فاصلهٔ افقی سر چراغ از محور تیر (با علامت armSide) */
  armReach: number;
  /** ارتفاع سر چراغ */
  lampY: number;
  bulb: THREE.Mesh;
  bulbMat: THREE.MeshStandardMaterial;
  /** نقطهٔ نصب کابل‌ها به شکل مختصات جهانی */
  insulatorWorldPositions: THREE.Vector3[];
}

/**
 * تیر چراغ برق کلاسیک گالوانیزهٔ دایره‌ای (خواستهٔ بازبینی):
 * ستون فولاد گالوانیزهٔ کاملاً گرد و مخروطی روی صفحهٔ فلنج دایره‌ای با پیچ‌های
 * شش‌گوش، بست‌های گرد، بازوی قوس‌دار لوله‌ای و سر چراغ دایره‌ای کلاسیک با
 * کلاهک بشقابی و گوی شیشه‌ای مات — بدون تراورس چوبی و مقرهٔ چینی.
 */
function buildGalvanizedPoleBody(root: THREE.Group, opts: UtilityPoleOptions): PoleBodyResult {
  // فولاد گالوانیزه: خاکستری سرد، فلزی و با زبری متوسط (بدون برق آینه‌ای)
  const galvanizedMat = new THREE.MeshStandardMaterial({
    color: 0x9ba1a4,
    roughness: 0.46,
    metalness: 0.72,
    envMap: opts.environmentMap,
    envMapIntensity: 0.55,
  });
  const galvanizedDarkMat = new THREE.MeshStandardMaterial({
    color: 0x757c80,
    roughness: 0.52,
    metalness: 0.7,
    envMap: opts.environmentMap,
    envMapIntensity: 0.45,
  });
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x55565a,
    roughness: 0.94,
    metalness: 0.03,
  });

  // ۱. پایهٔ بتنی گرد + صفحهٔ فلنج دایره‌ای با چهار پیچ شش‌گوش گالوانیزه
  const footing = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.30, 20), concreteMat);
  footing.position.y = 0.15;
  footing.castShadow = true;
  footing.receiveShadow = true;
  root.add(footing);

  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.045, 24), galvanizedMat);
  flange.position.y = 0.325;
  flange.castShadow = true;
  root.add(flange);

  for (let bolt = 0; bolt < 4; bolt++) {
    const angle = (bolt / 4) * Math.PI * 2 + Math.PI / 4;
    const boltMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.055, 6), galvanizedDarkMat);
    boltMesh.position.set(Math.cos(angle) * 0.185, 0.362, Math.sin(angle) * 0.185);
    root.add(boltMesh);
  }

  // ۲. ستون گالوانیزهٔ مخروطی و کاملاً گرد (۲۴ ضلع گرد، بدون تیزی چندضلعی)
  const poleHeight = 6.15;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.115, poleHeight, 24, 1, false),
    galvanizedMat,
  );
  shaft.position.y = poleHeight * 0.5 + 0.35;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  shaft.name = `PoleShaft_${opts.id}`;
  root.add(shaft);

  // سه بست گرد کلاسیک روی ستون (حلقه‌های دایره‌ای)
  for (const bandY of [1.15, 3.0, 4.4]) {
    const radius = 0.115 - ((bandY - 0.35) / poleHeight) * (0.115 - 0.062);
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 0.012, 0.014, 8, 24),
      galvanizedDarkMat,
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = bandY;
    root.add(band);
  }

  // درپوش گرد نوک ستون
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), galvanizedMat);
  cap.position.y = poleHeight + 0.35;
  root.add(cap);

  // ۳. بازوی قوس‌دار لوله‌ای گرد کلاسیک (gooseneck) — یک لولهٔ دایره‌ای صاف
  const armReach = opts.armSide * 1.22;
  const lampY = 4.86;
  const armRadius = 0.028;
  const s = opts.armSide;

  // بست گرد اتصال بازو به ستون
  const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.13, 18), galvanizedDarkMat);
  clamp.position.y = lampY + 0.30;
  root.add(clamp);

  // منحنی بازو: از بدنهٔ ستون بالا می‌رود، قوس می‌زند و بالای سر چراغ می‌نشیند
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, lampY + 0.18, 0),
    new THREE.Vector3(s * 0.16, lampY + 0.44, 0),
    new THREE.Vector3(s * 0.56, lampY + 0.53, 0),
    new THREE.Vector3(s * 0.96, lampY + 0.42, 0),
    new THREE.Vector3(s * 1.19, lampY + 0.16, 0),
  ]);
  const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 26, armRadius, 10, false), galvanizedMat);
  arm.castShadow = true;
  arm.name = `LampArm_${opts.id}`;
  root.add(arm);

  // گلویی کوتاه بین انتهای بازو و کلاهک سر چراغ
  const armTip = new THREE.Mesh(
    new THREE.CylinderGeometry(armRadius, 0.034, 0.12, 12),
    galvanizedDarkMat,
  );
  armTip.position.set(s * 1.21, lampY + 0.075, 0);
  root.add(armTip);

  // ۴. سر چراغ دایره‌ای کلاسیک: کلاهک بشقابی گرد + حلقهٔ نگه‌دارنده + گوی شیشه‌ای مات
  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(0.30, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
    galvanizedMat,
  );
  hood.position.set(armReach, lampY + 0.11, 0);
  hood.castShadow = true;
  hood.name = `LampHood_${opts.id}`;
  root.add(hood);

  // حلقهٔ لبهٔ کلاهک (دایرهٔ کامل و گرد)
  const hoodRim = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.016, 8, 32), galvanizedDarkMat);
  hoodRim.rotation.x = Math.PI / 2;
  hoodRim.position.set(armReach, lampY + 0.09, 0);
  root.add(hoodRim);

  // گوی شیشه‌ای مات (مخروط/کرهٔ کامل و کلاسیک)
  const globeMat = new THREE.MeshStandardMaterial({
    color: 0xffe8c4,
    emissive: new THREE.Color(0xffb05e),
    emissiveIntensity: 2.1,
    roughness: 0.42,
    metalness: 0.02,
    transparent: true,
    opacity: 0.94,
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.235, 24, 16), globeMat);
  globe.position.set(armReach, lampY - 0.20, 0);
  globe.name = `LampBulb_${opts.id}`;
  root.add(globe);

  // پیچ گرد بالای گوی + مهرهٔ تزئینی
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 8), galvanizedDarkMat);
  finial.position.set(armReach, lampY - 0.435, 0);
  root.add(finial);

  // ۵. قلاب‌های گرد کابل روی ستون (برای عبور سیم‌های هوایی هم‌سطح بقیهٔ کوچه)
  const insulatorWorldPositions: THREE.Vector3[] = [];
  for (const hookSide of [1, -1] as const) {
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 6, 14, Math.PI * 1.3), galvanizedDarkMat);
    hook.rotation.y = Math.PI / 2;
    hook.position.set(hookSide * 0.075, poleHeight - 0.12, 0);
    root.add(hook);
    insulatorWorldPositions.push(
      new THREE.Vector3(
        opts.position.x + hookSide * 0.09,
        opts.position.y + poleHeight - 0.05,
        opts.position.z,
      ),
    );
  }
  // نقطهٔ سوم: پایین‌تر روی ستون تا کابل‌ها همه از یک نقطه بیرون نزنند
  insulatorWorldPositions.push(
    new THREE.Vector3(opts.position.x, opts.position.y + poleHeight - 0.75, opts.position.z),
  );

  return {
    armReach,
    lampY,
    bulb: globe,
    bulbMat: globeMat,
    insulatorWorldPositions,
  };
}

export function createUtilityPole(opts: UtilityPoleOptions): UtilityPoleInstance {
  const root = new THREE.Group();
  root.name = `UtilityPole_${opts.id}`;
  root.position.set(opts.position.x, opts.position.y, opts.position.z);

  const body = buildGalvanizedPoleBody(root, opts);
  const { armReach, lampY, bulbMat, insulatorWorldPositions } = body;

  // ۵. مخروط نور در مه شب زیر چراغ برق — پهن‌تر و کم‌رنگ‌تر از قبل تا لبهٔ
  // مخروط به‌جای «خط» یک محو شدن نرم باشد
  const beamMat = new THREE.MeshBasicMaterial({
    map: opts.beamTexture,
    transparent: true,
    opacity: 0.055,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  // مخروط مه باریک‌تر از گسترهٔ واقعی نور است (مه با فاصله رقیق می‌شود) و با
  // ۳۲ ضلع کاملاً گرد دیده می‌شود؛ لبهٔ آن هم با پروفایل نرم تکسچر محو است
  const beamRadius = streetlightBeamRadius(lampY - 0.2) * 0.58;
  const beamHeight = lampY - 0.25;
  const beam = new THREE.Mesh(new THREE.ConeGeometry(beamRadius, beamHeight, 32, 1, true), beamMat);
  beam.position.set(armReach, beamHeight * 0.5, 0);
  beam.name = `LampVolumetricBeam_${opts.id}`;
  root.add(beam);

  // ۶. SpotLight فیزیکی با لبهٔ کاملاً محو؛ penumbra = ۱ یعنی روشنایی از مرکز
  // مخروط تا لبه پیوسته کم می‌شود و هیچ مرز تیز یا لکهٔ مصنوعی روی سنگ‌فرش نمی‌ماند
  const spotLight = new THREE.SpotLight(
    SOFT_STREETLIGHT.color,
    opts.baseIntensity * SOFT_STREETLIGHT.intensityFactor,
    SOFT_STREETLIGHT.distance,
    SOFT_STREETLIGHT.angle,
    SOFT_STREETLIGHT.penumbra,
    SOFT_STREETLIGHT.decay,
  );
  spotLight.name = `PoleSpotLight_${opts.id}`;
  spotLight.position.set(armReach, lampY - 0.18, 0);
  // هدف کمی جلوتر از سر چراغ و کمی متمایل به وسط کوچه تا استخر نور بیضی و
  // طبیعی روی سنگ‌فرش پخش شود (نه یک دایرهٔ دقیق و ماشینی)
  spotLight.target.position.set(armReach + opts.armSide * 0.42, 0, opts.armSide * 0.18);
  spotLight.castShadow = Boolean(opts.castShadow);
  if (opts.castShadow) {
    spotLight.shadow.mapSize.set(512, 512);
    spotLight.shadow.camera.near = 0.6;
    spotLight.shadow.camera.far = 18;
    spotLight.shadow.bias = -0.0008;
    spotLight.shadow.radius = 4;
  }
  root.add(spotLight, spotLight.target);

  // ۷. هالهٔ نور نرم روی سنگ‌فرش: لکه‌ای گرم با لبهٔ آلی و کاملاً محو که مرز
  // هندسی مخروط را می‌پوشاند؛ روی تاج ملایم کف می‌خوابد تا ذره‌ای شناور نباشد
  const poolRadius = streetlightBeamRadius(lampY - 0.2) * 0.92;
  const poolTex = opts.poolTexture ?? createLampPoolAlphaTexture(Math.round(opts.seed * 13) + 7);
  const poolMat = new THREE.MeshBasicMaterial({
    color: 0xffb877,
    alphaMap: poolTex,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const poolGeo = new THREE.PlaneGeometry(poolRadius * 2, poolRadius * 2, 24, 24);
  {
    const poolPos = poolGeo.attributes.position;
    const centerX = opts.position.x + armReach + opts.armSide * 0.3;
    for (let i = 0; i < poolPos.count; i++) {
      // پس از چرخش −۹۰ درجه حول X، مختصات z محلی همان ارتفاع جهانی می‌شود؛
      // پس تاج کف را دقیقاً روی همان نقطهٔ جهانی سوار می‌کنیم
      poolPos.setZ(i, alleyGroundCrownAt(centerX + poolPos.getX(i)) + 0.008);
    }
    poolGeo.computeVertexNormals();
  }
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(armReach + opts.armSide * 0.3, -opts.position.y, 0);
  pool.name = `LampGroundPool_${opts.id}`;
  root.add(pool);

  return {
    group: root,
    spotLight,
    insulatorWorldPositions,
    update(elapsedSeconds: number) {
      const factor = computeStreetlampFlicker(elapsedSeconds, opts.seed, opts.profile);
      spotLight.intensity = opts.baseIntensity * SOFT_STREETLIGHT.intensityFactor * factor;
      bulbMat.emissiveIntensity = Math.max(0.08, 2.75 * factor);
      beamMat.opacity = Math.max(0.003, 0.052 * factor);
      poolMat.opacity = Math.max(0.008, 0.155 * factor);
      return factor;
    },
  };
}

/** کابل برق هوایی با شکم‌دادگی طبیعی (Catenary) بین دو نقطه در فضا */
export function createOverheadCable(
  from: THREE.Vector3,
  to: THREE.Vector3,
  sagMeters: number,
  material: THREE.Material,
  radius = 0.016,
): THREE.Mesh {
  const segments = 14;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new THREE.Vector3().lerpVectors(from, to, t);
    p.y -= Math.sin(t * Math.PI) * sagMeters;
    points.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, segments, radius, 5, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'OverheadPowerCable';
  return mesh;
}

export interface CrateSpec {
  size: [number, number, number];
  offset: [number, number, number];
  rotY?: number;
}

/** ساخت یک جعبهٔ چوبی واقعی با چهارچوب تقویتی گوشه‌ها و قید مورب */
export function createWoodenCrateMesh(
  width: number,
  height: number,
  depth: number,
  plankMat: THREE.Material,
  trimMat: THREE.Material,
  ironMat: THREE.Material,
): THREE.Group {
  const crate = new THREE.Group();
  crate.name = 'WoodenCrate';

  const core = new THREE.Mesh(withUv2(new THREE.BoxGeometry(width, height, depth)), plankMat);
  core.castShadow = true;
  core.receiveShadow = true;
  crate.add(core);

  const battenThick = 0.036;
  const battenW = 0.075;

  // قیدهای عمودی چهار گوشه
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(battenW, height + 0.012, battenW),
        trimMat,
      );
      post.position.set(sx * (width / 2 - battenW / 2 + 0.012), 0, sz * (depth / 2 - battenW / 2 + 0.012));
      post.castShadow = true;
      crate.add(post);

      // بست فلزی گوشه بالا و پایین
      for (const sy of [-1, 1] as const) {
        const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.055, 0.09), ironMat);
        bracket.position.set(
          sx * (width / 2 - 0.03),
          sy * (height / 2 - 0.02),
          sz * (depth / 2 - 0.03),
        );
        crate.add(bracket);
      }
    }
  }

  // قیدهای افقی بالا/پایین و قید مورب روی وجه‌های جلو و عقب
  for (const sz of [-1, 1] as const) {
    for (const sy of [-1, 1] as const) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.02, battenW, battenThick),
        trimMat,
      );
      rail.position.set(0, sy * (height / 2 - battenW / 2), sz * (depth / 2 + battenThick * 0.4));
      crate.add(rail);
    }

    const diagLen = Math.hypot(width - battenW * 1.4, height - battenW * 1.4);
    const diag = new THREE.Mesh(
      new THREE.BoxGeometry(diagLen, battenW * 0.82, battenThick * 0.85),
      trimMat,
    );
    diag.position.set(0, 0, sz * (depth / 2 + battenThick * 0.35));
    diag.rotation.z = Math.atan2(height - battenW * 1.4, width - battenW * 1.4) * sz;
    crate.add(diag);
  }

  return crate;
}

/** پالت چوبی زیر جعبه‌ها تا مستقیم داخل آب باران ننشینند */
export function createWoodenPallet(
  width: number,
  depth: number,
  trimMat: THREE.Material,
): THREE.Group {
  const pallet = new THREE.Group();
  pallet.name = 'WoodenPallet';

  for (let i = -1; i <= 1; i++) {
    const runner = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.09, depth), trimMat);
    runner.position.set(i * (width * 0.4), 0.045, 0);
    runner.castShadow = true;
    runner.receiveShadow = true;
    pallet.add(runner);
  }

  const slats = 6;
  for (let s = 0; s < slats; s++) {
    const z = -depth / 2 + 0.1 + (s / (slats - 1)) * (depth - 0.2);
    const slat = new THREE.Mesh(new THREE.BoxGeometry(width, 0.028, 0.12), trimMat);
    slat.position.set(0, 0.104, z);
    slat.castShadow = true;
    slat.receiveShadow = true;
    pallet.add(slat);
  }

  return pallet;
}

/** بشکهٔ فلزی کهنه کنار جعبه‌های تدارکات */
export function createRustyBarrel(ironMat: THREE.Material, accentHex = 0x4b2f24): THREE.Group {
  const barrel = new THREE.Group();
  barrel.name = 'RustyBarrel';

  const bodyMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.78,
    metalness: 0.42,
  });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.94, 16), bodyMat);
  drum.position.y = 0.47;
  drum.castShadow = true;
  drum.receiveShadow = true;
  barrel.add(drum);

  for (const ringY of [0.06, 0.34, 0.62, 0.91]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.318, 0.016, 6, 18), ironMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = ringY;
    barrel.add(hoop);
  }

  return barrel;
}
