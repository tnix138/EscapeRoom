'use client';

/**
 * alley-props.ts — تجهیزات شهری، تیرهای چراغ برق سوسوزن، کابل‌های هوایی و جعبه‌های کوچه (علیرضا)
 * - تیر چراغ برق قدیمی (پایهٔ بتنی، ستون چوب/چدن، بازوی عایق چینی، تابلو برق، چراغ کلاهک‌دار،
 *   حباب نورانی، پرتو مخروطی مه، و SpotLight سوسوزن واقع‌گرایانه)
 * - کابل‌های برق شکم‌داده (Catenary) در طول کوچه و عرض آسمان بین ساختمان‌ها
 * - دسته جعبه‌های چوبی میخ‌کوب، پالت باربری، بشکهٔ فلزی زنگ‌زده و چادر برزنتی
 */

import * as THREE from 'three';
import type { ProceduralSurfaceMaps } from './materials/procedural-textures';
import { withUv2 } from './alley-materials';

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

/** تکسچر گرادیان نرم برای مخروط مهِ زیر چراغ برق */
export function createLightConeAlphaTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = y / (size - 1); // 0 پایین مخروط، 1 نوک بالا نزدیک لامپ
    for (let x = 0; x < size; x++) {
      const verticalFade = Math.pow(v, 1.65) * (1 - Math.pow(Math.max(0, (v - 0.88) / 0.12), 2));
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

export interface UtilityPoleOptions {
  id: string;
  position: { x: number; y: number; z: number };
  /** +1 یعنی بازوی چراغ به سمت +X (برای تیر سمت چپ)، -1 یعنی به سمت -X (برای تیر سمت راست) */
  armSide: 1 | -1;
  profile: FlickerProfile;
  seed: number;
  baseIntensity: number;
  castShadow?: boolean;
  woodMaps: ProceduralSurfaceMaps;
  beamTexture: THREE.DataTexture;
  environmentMap: THREE.Texture;
}

export interface UtilityPoleInstance {
  readonly group: THREE.Group;
  readonly spotLight: THREE.SpotLight;
  readonly insulatorWorldPositions: THREE.Vector3[];
  update(elapsedSeconds: number): number;
}

export function createUtilityPole(opts: UtilityPoleOptions): UtilityPoleInstance {
  const root = new THREE.Group();
  root.name = `UtilityPole_${opts.id}`;
  root.position.set(opts.position.x, opts.position.y, opts.position.z);

  const poleWoodMat = new THREE.MeshStandardMaterial({
    color: 0x5c4634,
    map: opts.woodMaps.colorMap,
    normalMap: opts.woodMaps.normalMap,
    roughnessMap: opts.woodMaps.roughnessMap,
    roughness: 0.9,
    metalness: 0.04,
  });

  const darkIronMat = new THREE.MeshStandardMaterial({
    color: 0x26292e,
    roughness: 0.52,
    metalness: 0.72,
    envMap: opts.environmentMap,
    envMapIntensity: 0.7,
  });

  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x4c4d52,
    roughness: 0.92,
    metalness: 0.04,
  });

  const porcelainMat = new THREE.MeshStandardMaterial({
    color: 0xd6e2e0,
    roughness: 0.2,
    metalness: 0.08,
    envMap: opts.environmentMap,
  });

  // ۱. پایهٔ بتنی هشت‌وجهی و طوقهٔ فولادی کف تیر برق
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, 0.34, 8), concreteMat);
  plinth.position.y = 0.17;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  root.add(plinth);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.185, 0.28, 12), darkIronMat);
  collar.position.y = 0.42;
  collar.castShadow = true;
  root.add(collar);

  // ۲. ستون اصلی تیر چراغ برق با مخروط طبیعی (ارتفاع ۶.۴ متر)
  const poleHeight = 6.35;
  const poleShaft = new THREE.Mesh(
    withUv2(new THREE.CylinderGeometry(0.095, 0.155, poleHeight, 12, 1)),
    poleWoodMat,
  );
  poleShaft.position.y = poleHeight * 0.5 + 0.18;
  poleShaft.castShadow = true;
  poleShaft.receiveShadow = true;
  poleShaft.name = `PoleShaft_${opts.id}`;
  root.add(poleShaft);

  // رکاب‌های آهنی بالا رفتن از تیر برق + جعبه تقسیم فلزی
  for (let step = 0; step < 7; step++) {
    const side = step % 2 === 0 ? 1 : -1;
    const peg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.025), darkIronMat);
    peg.position.set(0, 1.9 + step * 0.58, side * 0.16);
    root.add(peg);
  }

  const junctionBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.18), darkIronMat);
  junctionBox.position.set(-opts.armSide * 0.16, 1.55, 0);
  junctionBox.castShadow = true;
  root.add(junctionBox);

  const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 3.3, 6), darkIronMat);
  conduit.position.set(-opts.armSide * 0.15, 3.35, 0.05);
  root.add(conduit);

  // ۳. تراورس‌های افقی بالای تیر برق + مهاربند مورب + مقره/عایق‌های چینی
  const insulatorWorldPositions: THREE.Vector3[] = [];
  const crossArmHeights = [5.72, 6.22];

  crossArmHeights.forEach((armY, idx) => {
    const width = idx === 0 ? 1.56 : 1.16;
    const crossArm = new THREE.Mesh(new THREE.BoxGeometry(width, 0.09, 0.09), poleWoodMat);
    crossArm.position.set(0, armY, 0);
    crossArm.castShadow = true;
    root.add(crossArm);

    for (const braceDir of [-1, 1] as const) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.03), darkIronMat);
      brace.position.set(braceDir * 0.24, armY - 0.19, 0.055);
      brace.rotation.z = braceDir * 0.68;
      root.add(brace);
    }

    const pinOffsets = idx === 0 ? [-0.66, -0.24, 0.24, 0.66] : [-0.46, 0.46];
    for (const px of pinOffsets) {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 6), darkIronMat);
      pin.position.set(px, armY + 0.075, 0);
      root.add(pin);

      const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.058, 0.095, 10), porcelainMat);
      insulator.position.set(px, armY + 0.13, 0);
      root.add(insulator);

      if (idx === 0 && (px === -0.66 || px === 0.24 || px === 0.66)) {
        insulatorWorldPositions.push(
          new THREE.Vector3(opts.position.x + px, opts.position.y + armY + 0.16, opts.position.z),
        );
      }
    }
  });

  // ۴. بازوی قوس‌دار چراغ کوچه + کلاهک لعابی زنگ‌زده + حباب سوسوزن
  const armReach = opts.armSide * 1.38;
  const lampY = 4.78;

  const armBar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 1.52, 8), darkIronMat);
  armBar.position.set(armReach * 0.5, lampY + 0.16, 0);
  armBar.rotation.z = -opts.armSide * 1.34;
  armBar.castShadow = true;
  root.add(armBar);

  const armStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.96, 6), darkIronMat);
  armStrut.position.set(armReach * 0.36, lampY - 0.14, 0);
  armStrut.rotation.z = -opts.armSide * 0.92;
  root.add(armStrut);

  // کلاهک فلزی بازتابنده
  const hoodOuter = new THREE.Mesh(
    new THREE.ConeGeometry(0.34, 0.20, 16, 1, true),
    darkIronMat,
  );
  hoodOuter.position.set(armReach, lampY + 0.04, 0);
  hoodOuter.castShadow = true;
  root.add(hoodOuter);

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe6bd,
    emissive: new THREE.Color(0xff9d3b),
    emissiveIntensity: 2.6,
    roughness: 0.16,
    metalness: 0.05,
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), bulbMat);
  bulb.position.set(armReach, lampY - 0.06, 0);
  bulb.name = `LampBulb_${opts.id}`;
  root.add(bulb);

  // ۵. مخروط نور در مه شب زیر چراغ برق
  const beamMat = new THREE.MeshBasicMaterial({
    map: opts.beamTexture,
    transparent: true,
    opacity: 0.075,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  const beamGeo = new THREE.ConeGeometry(2.15, 4.72, 18, 1, true);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(armReach, lampY - 2.42, 0);
  beam.name = `LampVolumetricBeam_${opts.id}`;
  root.add(beam);

  // ۶. SpotLight فیزیکی چراغ برق با هدف روی سنگ‌فرش زیر چراغ
  const spotLight = new THREE.SpotLight(
    0xffa958,
    opts.baseIntensity,
    17.5,
    Math.PI * 0.34,
    0.68,
    1.55,
  );
  spotLight.name = `PoleSpotLight_${opts.id}`;
  spotLight.position.set(armReach, lampY - 0.12, 0);
  spotLight.target.position.set(armReach * 1.35, 0, 0);
  spotLight.castShadow = Boolean(opts.castShadow);
  if (opts.castShadow) {
    spotLight.shadow.mapSize.set(512, 512);
    spotLight.shadow.camera.near = 0.6;
    spotLight.shadow.camera.far = 16;
    spotLight.shadow.bias = -0.0008;
  }
  root.add(spotLight, spotLight.target);

  return {
    group: root,
    spotLight,
    insulatorWorldPositions,
    update(elapsedSeconds: number) {
      const factor = computeStreetlampFlicker(elapsedSeconds, opts.seed, opts.profile);
      spotLight.intensity = opts.baseIntensity * factor;
      bulbMat.emissiveIntensity = Math.max(0.08, 2.75 * factor);
      beamMat.opacity = Math.max(0.004, 0.072 * factor);
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
