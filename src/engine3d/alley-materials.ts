'use client';

/**
 * alley-materials.ts — بافت‌های رویه‌ای PBR اختصاصی کوچهٔ قدیمی (علیرضا)
 * همهٔ بافت‌ها کاملاً قطعی (deterministic) و مستقل از DOM هستند تا هم در مرورگر
 * با کیفیت بالا رندر شوند و هم در تست‌های Node/Vitest بدون وابستگی اجرا شوند:
 * - سنگ‌فرش خشک و مات کج‌رج کوچه (colorMap + normalMap + roughnessMap + aoMap)
 * - سنگ‌تراش خشک پیاده‌رو و جدول کناری
 * - دیوار آجری کهنه و مات با نمِ ملایم (بدون براقیت)، اندود گچ/سنگ نماهای چندطبقه
 * - الوار چوبی میخ‌کوب جعبه‌ها و پالت‌ها
 * - ماسک نرم آلفای چاله‌های آب باران و هالهٔ نمناک باریک پیرامونشان
 */

import * as THREE from 'three';
import type { ProceduralSurfaceMaps } from './materials/procedural-textures';

/** کپی uv روی uv1 برای پشتیبانی کامل aoMap در Three.js */
export function withUv2<T extends THREE.BufferGeometry>(geometry: T): T {
  const uv = geometry.getAttribute('uv');
  if (uv && !geometry.getAttribute('uv1')) {
    geometry.setAttribute('uv1', uv);
  }
  return geometry;
}

function hash2D(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy, seed);
  const b = hash2D(ix + 1, iy, seed);
  const c = hash2D(ix, iy + 1, seed);
  const d = hash2D(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function byte(v: number): number {
  return Math.round(clamp(v, 0, 255));
}

function buildMapsFromHeightAndColor(
  size: number,
  heights: Float32Array,
  colorData: Uint8Array,
  roughnessValues: Float32Array,
  aoValues: Float32Array,
  repeatX: number,
  repeatY: number,
  normalStrength: number,
): ProceduralSurfaceMaps {
  const pixelCount = size * size;
  const normalData = new Uint8Array(pixelCount * 4);
  const roughnessData = new Uint8Array(pixelCount * 4);
  const aoData = new Uint8Array(pixelCount * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const rByte = byte(roughnessValues[idx] * 255);
      const aoByte = byte(aoValues[idx] * 255);
      const off = idx * 4;
      roughnessData[off] = rByte;
      roughnessData[off + 1] = rByte;
      roughnessData[off + 2] = rByte;
      roughnessData[off + 3] = 255;

      aoData[off] = aoByte;
      aoData[off + 1] = aoByte;
      aoData[off + 2] = aoByte;
      aoData[off + 3] = 255;

      const left = heights[y * size + ((x + size - 1) % size)];
      const right = heights[y * size + ((x + 1) % size)];
      const up = heights[((y + size - 1) % size) * size + x];
      const down = heights[((y + 1) % size) * size + x];
      const nx = (left - right) * normalStrength;
      const ny = (up - down) * normalStrength;
      const invLen = 1 / Math.hypot(nx, ny, 1);

      normalData[off] = byte((nx * invLen * 0.5 + 0.5) * 255);
      normalData[off + 1] = byte((ny * invLen * 0.5 + 0.5) * 255);
      normalData[off + 2] = byte((invLen * 0.5 + 0.5) * 255);
      normalData[off + 3] = 255;
    }
  }

  const mkTex = (data: Uint8Array, srgb: boolean) => {
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  const colorMap = mkTex(colorData, true);
  const normalMap = mkTex(normalData, false);
  const roughnessMap = mkTex(roughnessData, false);
  const aoMap = mkTex(aoData, false);
  let disposed = false;

  return {
    colorMap,
    normalMap,
    roughnessMap,
    aoMap,
    dispose() {
      if (disposed) return;
      disposed = true;
      colorMap.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
      aoMap.dispose();
    },
  };
}

/**
 * بافت سنگ‌فرش خشک کوچه با رج‌های نیم‌خشت، بندکشی تیره، تنوع رنگ هر
 * قلوه‌سنگ (بازالت، خاکی، سربی، خزه‌دار) و زبری بالای مات (۰٫۸۲–۰٫۹۸).
 */
export function createCobblestoneMaps(repeatX = 5, repeatY = 12, size = 256): ProceduralSurfaceMaps {
  const count = size * size;
  const heights = new Float32Array(count);
  const colorData = new Uint8Array(count * 4);
  const roughness = new Float32Array(count);
  const ao = new Float32Array(count);

  const cols = 7;
  const rows = 9;

  for (let py = 0; py < size; py++) {
    const v = py / size;
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const idx = py * size + px;

      const rowFloat = v * rows;
      const rowIdx = Math.floor(rowFloat);
      const fy = rowFloat - rowIdx;

      const rowShift = (rowIdx % 2) * 0.5 + (hash2D(rowIdx, 3, 71) - 0.5) * 0.14;
      const colFloat = u * cols + rowShift;
      const colIdx = Math.floor(colFloat);
      const fx = colFloat - colIdx;

      const stoneIdX = ((colIdx % cols) + cols) % cols;
      const stoneIdY = ((rowIdx % rows) + rows) % rows;
      const stoneTone = hash2D(stoneIdX, stoneIdY, 19);
      const stoneWarm = hash2D(stoneIdX + 31, stoneIdY + 17, 43);
      const stoneTilt = (hash2D(stoneIdX + 7, stoneIdY + 53, 97) - 0.5) * 0.12;

      const jointX = Math.min(fx, 1 - fx);
      const jointY = Math.min(fy, 1 - fy);
      const bevel = clamp(Math.min(jointX / 0.16, jointY / 0.19), 0, 1);
      const pillow = Math.pow(Math.sin(clamp(bevel, 0, 1) * Math.PI * 0.5), 0.72);

      const microGrain = (valueNoise(u * 64, v * 64, 5) - 0.5) * 0.13;
      const wetPatch = valueNoise(u * 4.5, v * 4.5, 29);

      const h = clamp(0.14 + pillow * 0.78 + stoneTilt + microGrain, 0, 1);
      heights[idx] = h;

      // درز ملات تیره و زبر در مقابل تاج سنگ‌های روشن‌تر
      const isMortar = bevel < 0.22;
      const baseLum = 44 + stoneTone * 34 + pillow * 22 + microGrain * 34;
      let r = baseLum * (0.94 + stoneWarm * 0.18);
      let g = baseLum * (0.95 + stoneWarm * 0.08);
      let b = baseLum * (1.06 - stoneWarm * 0.08);

      if (isMortar) {
        r *= 0.42;
        g *= 0.44;
        b *= 0.46;
      }

      // سنگ‌فرش کوچه خشک است: رطوبت فقط کمی تیرگی می‌گذارد و هیچ براقیتی نمی‌سازد
      const dampness = clamp(wetPatch * 0.5 - pillow * 0.12, 0, 1);
      const wetDarken = 1 - dampness * 0.1;
      const off = idx * 4;
      colorData[off] = byte(r * wetDarken);
      colorData[off + 1] = byte(g * wetDarken);
      colorData[off + 2] = byte(b * wetDarken);
      colorData[off + 3] = 255;

      // زبری بالا (۰٫۸–۰٫۹۸) یعنی سطح مات؛ درز ملات هم مثل خود سنگ خشک است
      roughness[idx] = isMortar
        ? 0.92
        : clamp(0.9 - dampness * 0.06 + microGrain * 0.12, 0.82, 0.98);
      ao[idx] = clamp(0.32 + bevel * 0.68, 0.22, 1.0);
    }
  }

  return buildMapsFromHeightAndColor(size, heights, colorData, roughness, ao, repeatX, repeatY, 3.6);
}

/** سنگ‌فرش تخته‌های سنگی برش‌خوردهٔ پیاده‌رو و جدول */
export function createFlagstoneMaps(repeatX = 2, repeatY = 14, size = 128): ProceduralSurfaceMaps {
  const count = size * size;
  const heights = new Float32Array(count);
  const colorData = new Uint8Array(count * 4);
  const roughness = new Float32Array(count);
  const ao = new Float32Array(count);

  const cols = 3;
  const rows = 4;

  for (let py = 0; py < size; py++) {
    const v = py / size;
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const idx = py * size + px;

      const rf = v * rows;
      const ri = Math.floor(rf);
      const fy = rf - ri;
      const cf = u * cols + (ri % 2) * 0.5;
      const ci = Math.floor(cf);
      const fx = cf - ci;

      const edge = clamp(Math.min(Math.min(fx, 1 - fx) / 0.08, Math.min(fy, 1 - fy) / 0.08), 0, 1);
      const slabSeed = hash2D(((ci % cols) + cols) % cols, ri % rows, 61);
      const grain = (valueNoise(u * 40, v * 40, 13) - 0.5) * 0.14;
      const damp = valueNoise(u * 5, v * 5, 83);

      heights[idx] = clamp(0.25 + edge * 0.65 + grain, 0, 1);
      // پیاده‌روی خشک: فقط تیرگی ملایم رطوبت، بدون بازتاب
      const lum = (68 + slabSeed * 24 + edge * 14 + grain * 30) * (1 - damp * 0.09);
      const off = idx * 4;
      colorData[off] = byte(lum * 1.02);
      colorData[off + 1] = byte(lum * 0.99);
      colorData[off + 2] = byte(lum * 0.96);
      colorData[off + 3] = 255;

      roughness[idx] = clamp(0.92 - damp * 0.05, 0.84, 0.98);
      ao[idx] = clamp(0.4 + edge * 0.6, 0.3, 1);
    }
  }

  return buildMapsFromHeightAndColor(size, heights, colorData, roughness, ao, repeatX, repeatY, 2.8);
}

/** بافت دیوار آجری فرسودهٔ دههٔ ۱۹۲۰ با بند ملات، دوده و رد شرهٔ باران */
export function createBrickWallMaps(
  baseHex: number,
  repeatX = 4,
  repeatY = 5,
  size = 256,
  seed = 101,
): ProceduralSurfaceMaps {
  const count = size * size;
  const heights = new Float32Array(count);
  const colorData = new Uint8Array(count * 4);
  const roughness = new Float32Array(count);
  const ao = new Float32Array(count);

  const base = new THREE.Color(baseHex);
  const baseR = base.r * 255;
  const baseG = base.g * 255;
  const baseB = base.b * 255;

  const cols = 6;
  const rows = 14;

  for (let py = 0; py < size; py++) {
    const v = py / size;
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const idx = py * size + px;

      const rf = v * rows;
      const ri = Math.floor(rf);
      const fy = rf - ri;
      const cf = u * cols + (ri % 2) * 0.5;
      const ci = Math.floor(cf);
      const fx = cf - ci;

      const jx = Math.min(fx, 1 - fx);
      const jy = Math.min(fy, 1 - fy);
      const mortar = clamp(Math.min(jx / 0.075, jy / 0.14), 0, 1);
      const brickVar = hash2D(((ci % cols) + cols) % cols, ri % rows, seed);
      const spall = valueNoise(u * 26, v * 26, seed + 17);
      const rainStreak = valueNoise(u * 14, v * 2.2, seed + 41);

      heights[idx] = clamp(0.18 + mortar * 0.72 + (spall - 0.5) * 0.18, 0, 1);

      const shade = 0.76 + brickVar * 0.44 + (spall - 0.5) * 0.22;
      // دیوار مات است؛ نمِ ملایم فقط ردّ شرّهٔ باران را کمی تیره‌تر می‌کند، نه براق‌تر
      const soot = 1 - rainStreak * 0.3;
      const isMortar = mortar < 0.3;

      const r = isMortar ? 62 * soot : baseR * shade * soot;
      const g = isMortar ? 59 * soot : baseG * shade * soot;
      const b = isMortar ? 56 * soot : baseB * shade * soot;

      const off = idx * 4;
      colorData[off] = byte(r);
      colorData[off + 1] = byte(g);
      colorData[off + 2] = byte(b);
      colorData[off + 3] = 255;

      // کف زبری هرگز پایین نمی‌آید؛ آجر خشک و مات است و فقط نمِ ملایم دارد
      roughness[idx] = isMortar ? 0.98 : clamp(0.95 - rainStreak * 0.08 + (spall - 0.5) * 0.04, 0.86, 0.99);
      ao[idx] = clamp(0.38 + mortar * 0.62, 0.28, 1.0);
    }
  }

  return buildMapsFromHeightAndColor(size, heights, colorData, roughness, ao, repeatX, repeatY, 3.2);
}

/** بافت الوارهای چوبی جعبه‌های باربری و تدارکات پشت‌صحنهٔ تئاتر */
export function createWoodPlankMaps(baseHex = 0x6f5034, size = 128): ProceduralSurfaceMaps {
  const count = size * size;
  const heights = new Float32Array(count);
  const colorData = new Uint8Array(count * 4);
  const roughness = new Float32Array(count);
  const ao = new Float32Array(count);

  const base = new THREE.Color(baseHex);
  const planks = 5;

  for (let py = 0; py < size; py++) {
    const v = py / size;
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const idx = py * size + px;

      const pf = v * planks;
      const pi = Math.floor(pf);
      const fy = pf - pi;
      const gap = clamp(Math.min(fy, 1 - fy) / 0.08, 0, 1);

      const fiber = Math.sin(u * 26 + valueNoise(u * 6, v * 32 + pi * 7, 211) * 7.5) * 0.5 + 0.5;
      const plankShade = 0.82 + hash2D(pi, 11, 151) * 0.34;
      const wear = valueNoise(u * 12, v * 12, 177);

      heights[idx] = clamp(0.15 + gap * 0.72 + fiber * 0.12, 0, 1);
      const factor = (gap < 0.24 ? 0.34 : plankShade * (0.84 + fiber * 0.24)) * (0.88 + wear * 0.2);

      const off = idx * 4;
      colorData[off] = byte(base.r * 255 * factor);
      colorData[off + 1] = byte(base.g * 255 * factor);
      colorData[off + 2] = byte(base.b * 255 * factor);
      colorData[off + 3] = 255;

      roughness[idx] = clamp(0.84 - fiber * 0.1 + (wear - 0.5) * 0.14, 0.55, 0.95);
      ao[idx] = clamp(0.34 + gap * 0.66, 0.25, 1);
    }
  }

  return buildMapsFromHeightAndColor(size, heights, colorData, roughness, ao, 1, 1, 2.6);
}

/**
 * چوب **بلوط** درِ اصلی لابی — کیفیت بالا و طرح‌دار برای سطح نزدیک به بازیکن.
 *
 * برخلاف الوار جعبه‌ها (۱۲۸ پیکسل با درز تخته)، این بافت **۵۱۲ پیکسل** است و
 * درز تخته ندارد. طرح آن امضای بلوط را می‌سازد: نوارهای رگهٔ مواج، دو
 * **قوس کلیسایی** که رگه را U شکل خم می‌کند، **پرتوهای مغزی** (فِلِک‌های روشن
 * کوتاه)، منافذ درشت کشیده و دو گره‌چوب. UV متری در ماژول در، کل لنگه را در
 * یک کاشی می‌نشاند تا هیچ درز تکرار دیده نشود.
 *
 * @param baseHex رنگ پایهٔ چوب (رنگ نهایی روی متریال سفید)
 */
export function createLobbyDoorWoodMaps(
  baseHex = 0x8a5a2e,
  size = 512,
  seed = 4242,
): ProceduralSurfaceMaps {
  const count = size * size;
  const heights = new Float32Array(count);
  const colorData = new Uint8Array(count * 4);
  const roughness = new Float32Array(count);
  const ao = new Float32Array(count);

  // رنگ پایه به فضای sRGB برگردانده می‌شود تا بایت‌های بافت دقیقاً همان رنگ
  // انتخاب‌شده باشند (Color داخلی three خطی است و بی‌تبدیل، چوب را سیاه می‌کند)
  const base = new THREE.Color(baseHex).convertLinearToSRGB();
  const baseR = base.r * 255;
  const baseG = base.g * 255;
  const baseB = base.b * 255;

  // تعداد نوارهای رگه در عرض یک کاشی (۱۲ نوار ⇒ هر نوار ~۲۰ سانت روی در)
  const GRAIN_BANDS = 12;
  // مرکزهای «قوس کلیسایی» بلوط: جایی که رگه به شکل U خم می‌شود
  const ARCHES: ReadonlyArray<readonly [number, number, number, number]> = [
    [0.31, 0.2, 0.155, 1.0],
    [0.74, 0.15, 0.13, 2.4],
  ];
  // گره‌چوب‌ها: مرکز، شعاع افقی/عمودی و فاز حلقه‌ها — قطعی و تکرارپذیر
  const KNOTS: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [0.2, 0.41, 0.052, 0.05, 1.7],
    [0.83, 0.76, 0.046, 0.058, 3.1],
  ];

  for (let py = 0; py < size; py++) {
    const v = py / size;
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const idx = py * size + px;

      // ---- طرح بلوط -------------------------------------------------------
      // ۱) موج رگه: خط‌های رشد در ارتفاع آرام جابه‌جا می‌شوند (نه خط‌کش)
      const wander =
        Math.sin(v * Math.PI * 2.3 + 0.6) * 0.024 +
        Math.sin(v * Math.PI * 5.9 + 2.1) * 0.009 +
        (valueNoise(u * 1.6, v * 1.3, seed + 11) - 0.5) * 0.045;

      // ۲) قوس کلیسایی: رگه‌ها دور دو مرکز به شکل U خم می‌شوند — امضای بلوط
      let arch = 0;
      for (const [ax, av, aw, aph] of ARCHES) {
        const envelope = Math.exp(-(((u - ax) / aw) ** 2));
        arch += envelope * 0.075 * (0.5 + 0.5 * Math.cos(v * Math.PI * 2 + aph + (av - 0.2) * 4));
      }

      // مختصات رگه: مجموع جابه‌جایی‌ها؛ خط‌ها در راستای عمود می‌روند
      const grain = u + wander + arch;

      // نوارهای رشد: لایهٔ نازک تیره (چوب تابستانه) و نوار پهن روشن
      const phase = grain * GRAIN_BANDS * Math.PI * 2;
      const band = 0.5 + 0.5 * Math.sin(phase);
      const latewood = band ** 7; // خط نازک و تیره
      const earlywood = band ** 1.6; // نوار روشن و پهن

      // ۳) پرتو مغزی (medullary rays): فِلِک‌های روشن و کوتاه — ویژهٔ بلوط
      const rayNoise = valueNoise(u * 54, v * 320, seed + 41);
      const rayRegion = valueNoise(u * 2.6, v * 3.2, seed + 43);
      const ray = clamp((rayNoise - 0.68) / 0.32, 0, 1) * clamp((rayRegion - 0.42) / 0.3, 0, 1);

      // ۴) منافذ درشت بلوط: حفره‌های کشیده در راستای رگه
      const poreNoise = valueNoise(u * 165, v * 42, seed + 57);
      const pore = clamp((poreNoise - 0.77) / 0.23, 0, 1);

      // ۵) گره‌چوب: حلقه‌های هم‌مرکز بیضی‌شکل که رگه را دور خود می‌پیچند
      let knot = 0;
      for (const [kx, ky, krx, kry, kseed] of KNOTS) {
        const dist = Math.hypot((u - kx) / krx, (v - ky) / kry);
        if (dist < 1.7) {
          const rings = 0.5 + 0.5 * Math.sin(dist * 20 + kseed);
          knot += rings * Math.max(0, 1 - dist / 1.7) ** 1.6;
          knot += Math.max(0, 1 - dist) * 0.7;
        }
      }
      knot = clamp(knot, 0, 1.7);

      // ۶) لکهٔ بزرگ تنه — خیلی ملایم تا دو لنگه هم‌رنگ بمانند
      const mottle = valueNoise(u * 2.2, v * 1.1, seed + 71);

      const shade = clamp(
        1.0 +
          latewood * -0.46 +
          (earlywood - 0.5) * 0.3 +
          ray * 0.42 +
          (mottle - 0.5) * 0.16 -
          knot * 0.42 -
          pore * 0.34,
        0.2,
        1.6,
      );
      // چوب تابستانه گرم‌تر و تیره‌تر، پرتوهای مغزی روشن و کمی سردتر
      const warm = 1.0 - latewood * 0.05 - ray * 0.05 + (mottle - 0.5) * 0.08;

      const off = idx * 4;
      colorData[off] = byte(baseR * shade * (1.04 * warm));
      colorData[off + 1] = byte(baseG * shade * (0.99 * warm));
      colorData[off + 2] = byte(baseB * shade * (0.93 * warm));
      colorData[off + 3] = 255;

      heights[idx] = clamp(
        0.5 -
          latewood * 0.34 +
          ray * 0.12 -
          pore * 0.44 -
          knot * 0.3 +
          (earlywood - 0.5) * 0.1,
        0,
        1,
      );
      roughness[idx] = clamp(
        0.66 + latewood * 0.1 - ray * 0.14 + pore * 0.2 + knot * 0.12 + (mottle - 0.5) * 0.07,
        0.48,
        0.92,
      );
      ao[idx] = clamp(1 - pore * 0.4 - knot * 0.22 - latewood * 0.04, 0.5, 1);
    }
  }

  // یک کاشی روی کل در: UV متری خودش مقیاس را تعیین می‌کند، پس تکرار ۱×۱
  return buildMapsFromHeightAndColor(size, heights, colorData, roughness, ao, 1, 1, 2.8);
}

/** ماسک آلفای ارگانیک برای لبهٔ نرم چاله‌های آب باران روی سنگ‌فرش */
export function createPuddleAlphaMap(seed = 307, size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    const ny = (py / (size - 1)) * 2 - 1;
    for (let px = 0; px < size; px++) {
      const nx = (px / (size - 1)) * 2 - 1;
      const dist = Math.hypot(nx, ny * 0.86);
      const warp = (valueNoise(nx * 3.2 + 8, ny * 3.2 + 4, seed) - 0.5) * 0.42;
      const alpha = clamp(1 - (dist + warp - 0.42) / 0.44, 0, 1);
      const smooth = alpha * alpha * (3 - 2 * alpha);
      const b = byte(smooth * 255);
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
  tex.name = 'AlleyPuddleAlphaMask';
  return tex;
}

/**
 * ماسک آلفای «هالهٔ نمناک» باریکی که دقیقاً پیرامون هر چالهٔ آب می‌نشیند.
 * داخل چاله و بیرون از نوار، آلفا صفر است؛ فقط یک حلقهٔ نازک دورادور لبهٔ
 * چاله مقدار می‌گیرد تا سنگ‌فرش فقط کمی اطراف آب، نمناک دیده شود — نه کل کف.
 *
 * @param innerRadius شروع نوار در مختصات ماسک (۰ = مرکز، ۱ = لبهٔ صفحه)
 * @param outerRadius پایان نوار؛ بعد از آن کاملاً خشک است
 */
export function createPuddleDampRingAlphaMap(
  seed = 307,
  size = 128,
  innerRadius = 0.56,
  outerRadius = 0.88,
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const span = Math.max(1e-4, outerRadius - innerRadius);
  for (let py = 0; py < size; py++) {
    const ny = (py / (size - 1)) * 2 - 1;
    for (let px = 0; px < size; px++) {
      const nx = (px / (size - 1)) * 2 - 1;
      const dist = Math.hypot(nx, ny * 0.86);
      // همان اغتشاش ماسک چاله تا لبهٔ هاله با لبهٔ آب هم‌شکل بماند
      const warp = (valueNoise(nx * 3.2 + 8, ny * 3.2 + 4, seed) - 0.5) * 0.3;
      const t = (dist + warp - innerRadius) / span;
      const band = clamp(Math.min(t / 0.45, (1 - t) / 0.55), 0, 1);
      const smooth = band * band * (3 - 2 * band);
      const b = byte(smooth * 255);
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
  tex.name = 'AlleyPuddleDampRingMask';
  return tex;
}
