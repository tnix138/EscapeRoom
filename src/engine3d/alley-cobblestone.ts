'use client';

/**
 * alley-cobblestone.ts — سنگ‌فرش کف کوچه: میدان ارتفاعِ مشترکِ بافت و هندسه (امیر)
 * ---------------------------------------------------------------------------
 * چرا یک ماژول جدا؟ تا پیش از این سنگ‌فرش فقط یک تکسچر ۲۵۶ پیکسلی بود که
 * ارتفاعش داخل همان پیکسل‌ها می‌مرد: شبکه‌ای منظم و بی‌نقص، همهٔ سنگ‌ها
 * هم‌اندازه و همتراز، بندِ سیاهِ خطی و بدون هیچ اختلاف ارتفاعی ⇒ کف
 * «نقاشی‌شده» به‌نظر می‌رسید، نه سنگ‌چینی‌شده.
 *
 * حالا یک بار میدان ارتفاع ساخته می‌شود (`buildCobbleField`) و **دو** مصرف‌کننده
 * همان یک میدان را می‌خوانند:
 *   ۱. `cobblestoneSurfaceMaps` — نقشه‌های color / normal / roughness / ao
 *   ۲. `field.sampleLevel(u, v)` — ترازِ هر سنگ روی هندسهٔ کف واقعی می‌شود،
 *      پس اختلاف ارتفاعِ سنگ‌ها در نورِ مایل و کنارِ پای بازیکن دیده می‌شود و
 *      فقط توهمِ نورپردازی نیست.
 *
 * چهار چیزی که چینیِ واقعی را از الگوی کامپیوتری جدا می‌کند:
 *   - **شبکهٔ کج:** مختصات هر سلول با نویزِ دوره‌ای warp می‌شود ⇒ بندها
 *     خط‌کش‌کشیده و بی‌نقص نیستند و سنگ‌ها کمی کج‌وشکلند.
 *   - **هر سنگ اندازه و بندِ خودش را دارد:** نیم‌عرض بندِ هر سنگ فرق می‌کند
 *     (فاصلهٔ چینش نامنظم) و ~هر ششمِ خانه‌ها به دو نیم‌سنگ تقسیم می‌شود، مثل
 *     سنگ‌های پرکنندهٔ بین سنگ‌های بزرگ.
 *   - **تفاوت ارتفاعی مشخص:** هر سنگ یک `level` دارد (سنگِ بلند و سنگِ نشسته) و
 *     صفحهٔ بالایش کمی **شیب** دارد — سنگ کهنه تراز نیست. ترازِ بلندترین و
 *     پایین‌ترین سنگ تا ۴٫۵ سانتی‌متر فرق می‌کند و همین روی رأس‌های کف هم اعمال
 *     می‌شود.
 *   - **بندِ فرورفته و پُر از خاک:** کفِ بند ۰٫۶۲ واحد پایین‌تر از تاجِ سنگ است،
 *     رنگش قهوه‌ای خاکی است نه سیاهِ تخت، و زبری‌اش بیشتر.
 *
 * همه‌چیز قطعی (deterministic) و بدون DOM است تا در تستِ Node دقیقاً همان خروجی
 * مرورگر را بدهد، و همهٔ نویزها **دوره‌ای‌اند** ⇒ تایل‌شدنِ بافت هیچ درزی نمی‌اندازد.
 */

import * as THREE from 'three';
import type { ProceduralSurfaceMaps } from './materials/procedural-textures';

/** پارامترهای چینی سنگ‌فرش — تنها منبع حقیقتِ بافت و هندسه */
export const COBBLE = {
  /** تعداد ستون و ردیفِ خانه در هر تایل ۱×۱ بافت */
  cols: 11,
  rows: 14,
  /**
   * دامنهٔ جابه‌جایی هندسه (متر). ترازِ بلندترین سنگ روی صفرِ کف می‌نشیند و
   * پایین‌ترین سنگ ۵ سانتی‌متر فرو می‌رود — پس هیچ سنگی بالاتر از سطحِ نامیِ
   * بیشتر از این کف را پله‌پله می‌کند: شبکهٔ رأس‌ها ~۲۲ سانتی‌متر است و
   * سنگِ چینی‌شده لبهٔ تیزِ این‌قدر بلندقامت ندارد.
   * کف (و چاله‌های آب و هالهٔ نورِ چراغ‌ها که روی همین سطح‌اند) نمی‌زند.
   */
  relief: 0.05,
  /** تاجِ سنگ بر حسبِ ترازِ خودش؛ سنگِ نشسته کوتاه‌تر تراشیده می‌شود */
  topForLevel: (level: number): number => 0.6 + 0.3 * level,
  /** ارتفاع نرمالیزهٔ کفِ بند */
  jointLevel: 0.18,
  /** پهنای regionِ انتقالِ تراز بین دو سنگ (کسرِ خانه) — بقیهٔ سنگ تخت است */
  levelEdge: 0.26,
  /** پهنای پیچِ لبهٔ سنگ؛ لبهٔ تیزِ ماشین‌کاری‌شده نیست */
  bevelDrop: 0.075,
  /** کمینه و بیشینهٔ نیم‌عرض بند ⇒ فاصلهٔ چینش از سنگی به سنگ دیگر عوض می‌شود */
  jointMin: 0.035,
  jointMax: 0.095,
  /** چقدر طول می‌کشد تا از لبهٔ سنگ به کفِ بند برسیم (واحدِ سلول) */
  jointFeather: 0.03,
  /** دامنهٔ نویز ریزِ تراش روی صفحهٔ سنگ */
  grain: 0.026,
  /** شیبِ مجازِ صفحهٔ بالای هر سنگ */
  tiltRange: 0.03,
  /** نسبتِ خانه‌هایی که به دو نیم‌سنگ تقسیم می‌شوند */
  splitRatio: 0.2,
  /** تکرار بافت روی کف کوچه (۱۳٫۲ × ۴۲ متر) — با جابه‌جاییِ هندسه یکی باید بماند */
  repeatX: 4,
  repeatY: 10,
  /** اندازهٔ تکسچر؛ توانِ دو باشد تا mipmaps و RepeatWrapping سالم بمانند */
  textureSize: 512,
} as const;

/**
 * چگالیِ شبکهٔ کف. سنگ‌ها ~۳۰ سانتی‌مترند و ترازِ هر سنگ روی چهار رأس میانگین
 * می‌شود، پس رأس‌ها باید از خودِ سنگ ریزتر باشند — وگرنه موجِ کف گم می‌شود.
 */
export const COBBLE_GROUND_SEGMENTS = { x: 72, y: 228 } as const;

/** پالت رنگِ سنگ‌های کوچه: بازالتِ خاکستری تا ماسه‌ایِ روشن، سرد تا گرم */
const STONE_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [76, 74, 70],
  [98, 92, 82],
  [68, 72, 77],
  [88, 84, 76],
  [108, 100, 86],
  [62, 63, 60],
  [92, 82, 68],
];

/** رنگِ ملات و خاکِ داخل بند — قهوه‌ایِ خاکی، نه سیاهِ تخت */
const MORTAR_COLOR: readonly [number, number, number] = [52, 44, 35];
/** رنگِ خزه و گچ روی لبهٔ سایه‌دارِ سنگ */
const MOSS_COLOR: readonly [number, number, number] = [74, 90, 58];

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function byte(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

/** هش صحیحِ قطعی — همان خانوادهٔ هشِ بقیهٔ بافت‌های کوچه */
function hash2D(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** نویز مقداری با lattice دوره‌ای: روی u و v در [۰،۱) بدون درز تایل می‌شود */
function periodicNoise(u: number, v: number, period: number, seed: number): number {
  const p = Math.max(1, Math.round(period));
  const x = u * p;
  const y = v * p;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const wrap = (n: number) => ((n % p) + p) % p;
  const a = hash2D(wrap(ix), wrap(iy), seed);
  const b = hash2D(wrap(ix + 1), wrap(iy), seed);
  const c = hash2D(wrap(ix), wrap(iy + 1), seed);
  const d = hash2D(wrap(ix + 1), wrap(iy + 1), seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * وزنِ «صفحهٔ تخت»: تا فاصلهٔ `f` از مرزِ خانه بیشتر از `edge` باشد وزن ۱ است
 * (سنگ روی ترازِ خودش تخت می‌ماند) و نزدیک مرز با smoothstep به صفر می‌رسد تا
 * شیب فقط داخل بند بیفتد — همان‌طور که در سنگ‌فرش واقعی پله لبهٔ سنگ است.
 */
function plateauWeight(f: number, edge: number): number {
  const t = clamp(Math.min(f, 1 - f) / Math.max(0.02, edge), 0, 1);
  return t * t * (3 - 2 * t);
}

/** ویژگی‌های یک خانهٔ چینی‌شده (خانه ممکن است دو نیم‌سنگ داشته باشد) */
export interface CobbleCell {
  /** ترازِ صفحهٔ بالای سنگ: ۰ = نشسته، ۱ = بلند — همان چیزی که هندسه جابه‌جا می‌کند */
  level: number;
  /** کمینه و بیشینهٔ نیم‌عرضِ بند در دو راستا */
  jx: number;
  jy: number;
  /** ۱ یا ۲: بعضی خانه‌ها دو نیم‌سنگِ کنارِ همند */
  subX: number;
  /** نمایهٔ اولین سنگِ این خانه در جدولِ سنگ‌ها */
  firstVariant: number;
  /** لغزشِ جزئیِ خانه تا رج‌ها خطِ راستِ بی‌نقص نمانند */
  jitterX: number;
  jitterY: number;
}

/** ویژگی‌های رنگ و تراشِ یک **سنگِ واقعی** (خانهٔ تقسیم‌شده دو سنگ دارد) */
export interface CobbleStone {
  level: number;
  tiltX: number;
  tiltY: number;
  jx: number;
  jy: number;
  tone: number;
  warm: number;
  /** سنگ‌های زیرِ مسیرِ رفت‌وآمد ساییده‌تر و صاف‌ترند */
  wear: number;
  /** احتمالِ خزه‌گرفتنِ لبهٔ سایه‌دار */
  moss: number;
  /** آفستِ نویزِ لکه‌ها: هر سنگ کهنگیِ خودش را دارد، نه یک الگوی روی کل کف */
  jit: number;
}

export interface CobbleTable {
  cells: CobbleCell[];
  stones: CobbleStone[];
}

/**
 * جدولِ چینی: خانه‌ها و سنگ‌ها. همه‌چیز از هشِ (ستون، ردیف) می‌آید، پس هم
 * قطعی است و هم دوره‌ای — خانهٔ ستون ۰ و ستونِ آخر همسایه‌اند و تایل درز نمی‌کند.
 */
export function cobbleTable(): CobbleTable {
  const cells: CobbleCell[] = [];
  const stones: CobbleStone[] = [];

  for (let row = 0; row < COBBLE.rows; row++) {
    for (let col = 0; col < COBBLE.cols; col++) {
      const levelRoll = hash2D(col, row, 7);
      const level = clamp(0.3 + Math.pow(levelRoll, 0.72) * 0.7, 0, 1);
      const subX = hash2D(col + 91, row + 13, 23) < COBBLE.splitRatio ? 2 : 1;
      cells.push({
        level,
        jx: COBBLE.jointMin + hash2D(col + 17, row + 3, 41) * (COBBLE.jointMax - COBBLE.jointMin),
        jy: COBBLE.jointMin + hash2D(col + 61, row + 29, 47) * (COBBLE.jointMax - COBBLE.jointMin),
        subX,
        firstVariant: stones.length,
        jitterX: (hash2D(col + 101, row + 61, 83) - 0.5) * 0.12,
        jitterY: (hash2D(col + 29, row + 103, 89) - 0.5) * 0.1,
      });

      for (let sub = 0; sub < subX; sub++) {
        const roll = hash2D(col * 2 + sub, row + 7, 109);
        // نیم‌سنگ‌ها از همسایه‌هایشان کوتاه‌تر و باریک‌ترند (سنگِ پرکننده)
        const filler = subX === 2;
        stones.push({
          level: clamp(level * (filler ? 0.72 + roll * 0.42 : 1) - (filler ? 0.06 : 0), 0, 1),
          tiltX: (hash2D(col + 5 + sub * 17, row + 53, 29) - 0.5) * 2 * COBBLE.tiltRange,
          tiltY: (hash2D(col + 71, row + 11 + sub * 7, 37) - 0.5) * 2 * COBBLE.tiltRange,
          jx: filler
            ? COBBLE.jointMin + (COBBLE.jointMax - COBBLE.jointMin) * (0.45 + roll * 0.5)
            : cells[row * COBBLE.cols + col].jx,
          jy: cells[row * COBBLE.cols + col].jy,
          tone: hash2D(col + 13 + sub * 3, row + 7, 53),
          warm: hash2D(col + 31, row + 19 + sub * 5, 67),
          wear: Math.pow(hash2D(col + 83, row + 43 + sub * 11, 71), 1.6),
          moss: hash2D(col + 7 + sub * 13, row + 97, 79),
          jit: hash2D(col + 149, row + 151 + sub * 3, 157),
        });
      }
    }
  }

  return { cells, stones };
}

/** نتیجهٔ نمونه‌برداریِ میدان در یک نقطهٔ [۰،۱)×[۰،۱) */
export interface CobbleSample {
  /** ارتفاع نرمالیزهٔ سطح (..۱) */
  h: number;
  /** ۰ روی تاجِ سنگ تا ۱ کفِ بند */
  mortar: number;
  /** پهن‌شدگیِ صفحهٔ بالا: ۱ مرکزِ سنگ، ۰ لبهٔ آن */
  dome: number;
  /** نمایهٔ سنگِ این نقطه در `table.stones` */
  stone: number;
}

/**
 * ارتفاعِ سنگ‌فرش در مختصاتِ بافت. خانه‌ها از یک شبکهٔ warp‌شده می‌آیند ⇒ بندها
 * موج‌دارند، ولی شبکه روی لبهٔ تایل دقیقاً به خودش می‌رسد.
 */
export function sampleCobbleHeight(u: number, v: number, table: CobbleTable): CobbleSample {
  const { cells, stones } = table;

  const warpU = (periodicNoise(u, v, 7, 5) - 0.5) * 0.36;
  const warpV = (periodicNoise(u, v, 6, 9) - 0.5) * 0.22;

  const rf = v * COBBLE.rows + warpV;
  const rowFloor = Math.floor(rf);
  const row = mod(rowFloor, COBBLE.rows);
  const fyRaw = rf - rowFloor;
  // نیم‌خشت + لغزشِ ملایمِ هر رج
  const rowShift = (row % 2) * 0.5 + (hash2D(mod(rowFloor, COBBLE.rows), 3, 71) - 0.5) * 0.26;

  const cf = u * COBBLE.cols + rowShift + warpU;
  const colFloor = Math.floor(cf);
  const col = mod(colFloor, COBBLE.cols);
  let fx = cf - colFloor;
  let fy = fyRaw;

  const cell = cells[row * COBBLE.cols + col];
  let stoneIdx = cell.firstVariant;
  if (cell.subX === 2) {
    const sub = Math.floor(mod(fx * 2, 2));
    fx = mod(fx * 2, 1);
    stoneIdx = cell.firstVariant + sub;
  }

  const stone = stones[stoneIdx];
  fx = clamp(fx + cell.jitterX * 0.3, 0, 1);
  fy = clamp(fy + cell.jitterY * 0.3, 0, 1);

  // فاصله تا نزدیک‌ترین مرزِ خانه، منهای بندِ خودِ سنگ
  const inX = Math.min(fx, 1 - fx) - stone.jx;
  const inY = Math.min(fy, 1 - fy) - stone.jy;
  const inStone = Math.min(inX, inY);
  const mortar = clamp(1 - inStone / COBBLE.jointFeather, 0, 1);

  // بالشتکِ صفحهٔ بالا: وسطِ سنگ تخت است و نزدیک لبه پیچ می‌خورد
  const px = clamp(inX / Math.max(0.05, 0.5 - stone.jx), 0, 1);
  const py = clamp(inY / Math.max(0.05, 0.5 - stone.jy), 0, 1);
  const dome = Math.sin(clamp(Math.min(px, py), 0, 1) * Math.PI * 0.5) ** 0.6;

  const top = COBBLE.topForLevel(stone.level);
  const tilt = (stone.tiltX * (fx - 0.5) + stone.tiltY * (fy - 0.5)) * 2 * (1 - mortar);
  const grain =
    (periodicNoise(u, v, 96, 23) - 0.5) * 2 * COBBLE.grain * (1 - mortar * 0.55);
  // کنده‌خوردگی: نوار باریک روی پیچِ لبه + چند گودالِ ریز
  const chipBand = 1 - clamp(Math.abs(dome - 0.62) / 0.34, 0, 1);
  const pit = periodicNoise(u, v, 41, 127) > 0.9 ? 0.03 : 0;

  const h = clamp(
    top +
      tilt -
      (1 - dome) * COBBLE.bevelDrop -
      mortar * (top - COBBLE.jointLevel) +
      grain * (0.6 + dome * 0.4) -
      chipBand * 0.02 -
      pit * (1 - mortar),
    0.02,
    1,
  );

  return { h, mortar, dome, stone: stoneIdx };
}

/**
 * میدانِ سنگ‌فرش: ارتفاع، بند و بالشتکِ هر پیکسل + جدولِ سنگ‌ها + دو نمونه‌گیر
 * (یکیِ ترازِ خانه‌ها برای جابه‌جایی رأس‌های کف، یکیِ ارتفاعِ پیکسل‌ها).
 */
export interface CobbleField {
  readonly size: number;
  readonly heights: Float32Array;
  readonly mortar: Float32Array;
  readonly dome: Float32Array;
  readonly stoneIndex: Uint16Array;
  readonly table: CobbleTable;
  /** ارتفاعِ پیکسل‌ها با درون‌یابی دوخطی و wrap دوره‌ای */
  sampleHeight(u: number, v: number): number;
  /**
   * ترازِ سنگِ آن نقطه، نرم‌شده با چهار همسایه — برای جابه‌جاییِ رأس‌های کف.
   * چون روی خودِ شبکهٔ سنگ تعریف می‌شود، با رأسِ تنبل هم کج‌ونابرابر نمی‌شود.
   */
  sampleLevel(u: number, v: number): number;
}

export function buildCobbleField(size: number = COBBLE.textureSize): CobbleField {
  const n = Math.max(16, Math.round(size));
  const heights = new Float32Array(n * n);
  const mortarField = new Float32Array(n * n);
  const domeField = new Float32Array(n * n);
  const stoneIndex = new Uint16Array(n * n);
  const table = cobbleTable();

  for (let py = 0; py < n; py++) {
    const v = py / n;
    for (let px = 0; px < n; px++) {
      const sample = sampleCobbleHeight(px / n, v, table);
      const idx = py * n + px;
      heights[idx] = sample.h;
      mortarField[idx] = sample.mortar;
      domeField[idx] = sample.dome;
      stoneIndex[idx] = sample.stone;
    }
  }

  const bilinear = (get: (x: number, y: number) => number, u: number, v: number) => {
    const x = mod(u, 1) * n;
    const y = mod(v, 1) * n;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const xa = mod(x0, n);
    const xb = mod(x0 + 1, n);
    const ya = mod(y0, n);
    const yb = mod(y0 + 1, n);
    return (
      (get(xa, ya) * (1 - tx) + get(xb, ya) * tx) * (1 - ty) +
      (get(xa, yb) * (1 - tx) + get(xb, yb) * tx) * ty
    );
  };

  const cellLevel = (u: number, v: number) => {
    const col = mod(Math.floor(mod(u, 1) * COBBLE.cols), COBBLE.cols);
    const row = mod(Math.floor(mod(v, 1) * COBBLE.rows), COBBLE.rows);
    return table.cells[row * COBBLE.cols + col].level;
  };

  return {
    size: n,
    heights,
    mortar: mortarField,
    dome: domeField,
    stoneIndex,
    table,
    sampleHeight: (u, v) => {
      if (!Number.isFinite(u) || !Number.isFinite(v)) return 1;
      return bilinear((x, y) => heights[y * n + x], u, v);
    },
    sampleLevel: (u, v) => {
      if (!Number.isFinite(u) || !Number.isFinite(v)) return 1;
      // صفحهٔ هر سنگ روی ترازِ *خودش* تخت است و فقط نزدیک بند به ترازِ همسایه
      // می‌رسد (وزنِ پله‌ای، نه میانگینِ ساده) — وگرنه اختلافِ ارتفاعِ سنگ‌ها در
      // میانگینِ چهار همسایه گم می‌شود و کف دوباره صافِ نقاشی‌شده به‌نظر می‌رسد.
      const cu = 1 / COBBLE.cols;
      const cv = 1 / COBBLE.rows;
      const fu = mod(u * COBBLE.cols, 1);
      const fv = mod(v * COBBLE.rows, 1);
      const wu = plateauWeight(fu, COBBLE.levelEdge);
      const wv = plateauWeight(fv, COBBLE.levelEdge);
      const uNeigh = fu < 0.5 ? u - cu : u + cu;
      const vNeigh = fv < 0.5 ? v - cv : v + cv;
      const self = cellLevel(u, v);
      const sideU = cellLevel(uNeigh, v);
      const sideV = cellLevel(u, vNeigh);
      const corner = cellLevel(uNeigh, vNeigh);
      return clamp(
        self * wu * wv + sideU * (1 - wu) * wv + sideV * wu * (1 - wv) + corner * (1 - wu) * (1 - wv),
        0,
        1,
      );
    },
  };
}

/**
 * چهار نقشهٔ PBR از روی میدانِ ارتفاع. نورمل از گرادیانِ ۳×۳ (سابل) ساخته می‌شود
 * تا لبهٔ سنگ‌ها تیز بماند، و یک لایهٔ ریزِ تراش روی آن می‌نشیند که صفحهٔ سنگ
 * پلاستیک‌وار صاف نباشد.
 */
export function cobblestoneSurfaceMaps(
  field: CobbleField,
  repeatX: number = COBBLE.repeatX,
  repeatY: number = COBBLE.repeatY,
): ProceduralSurfaceMaps {
  const n = field.size;
  const pixels = n * n;
  const colorData = new Uint8Array(pixels * 4);
  const normalData = new Uint8Array(pixels * 4);
  const roughnessData = new Uint8Array(pixels * 4);
  const aoData = new Uint8Array(pixels * 4);
  const { heights, mortar: mortarField, dome: domeField, stoneIndex, table } = field;
  const stones = table.stones;
  // توانِ نورمل با رزولوشن مقیاس می‌شود تا در هر اندازه شیبِ یکسانی بدهد
  const strength = 2.9 * (n / 256);

  const at = (x: number, y: number) => heights[mod(y, n) * n + mod(x, n)];

  for (let py = 0; py < n; py++) {
    const v = py / n;
    for (let px = 0; px < n; px++) {
      const u = px / n;
      const idx = py * n + px;
      const off = idx * 4;
      const mortar = mortarField[idx];
      const dome = domeField[idx];
      const onStone = 1 - mortar;
      const stone = stones[stoneIndex[idx]];

      // ------------------------------------------------ نورمل (سابل ۳×۳ + تراش ریز)
      let gx = 0;
      let gy = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const rowWeight = dy === 0 ? 2 : 1;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const h = at(px + dx, py + dy);
          gx += dx * rowWeight * h;
          gy += dy * rowWeight * h;
        }
      }
      const gritX = hash2D(mod(px + 1, n), py, 991) - hash2D(mod(px - 1, n), py, 991);
      const gritY = hash2D(px, mod(py + 1, n), 997) - hash2D(px, mod(py - 1, n), 997);
      const nx = -gx * 0.25 * strength + gritX * 0.05 * onStone;
      const ny = gy * 0.25 * strength + gritY * 0.05 * onStone;
      const invLen = 1 / Math.hypot(nx, ny, 1);
      normalData[off] = byte((nx * invLen * 0.5 + 0.5) * 255);
      normalData[off + 1] = byte((ny * invLen * 0.5 + 0.5) * 255);
      normalData[off + 2] = byte((invLen * 0.5 + 0.5) * 255);
      normalData[off + 3] = 255;

      // ------------------------------------------------ رنگ سنگ
      const tonePos = stone.tone * (STONE_PALETTE.length - 1);
      const p0 = STONE_PALETTE[Math.floor(tonePos) % STONE_PALETTE.length];
      const p1 = STONE_PALETTE[(Math.floor(tonePos) + 1) % STONE_PALETTE.length];
      const mixT = tonePos - Math.floor(tonePos);
      let r = p0[0] + (p1[0] - p0[0]) * mixT;
      let g = p0[1] + (p1[1] - p0[1]) * mixT;
      let b = p0[2] + (p1[2] - p0[2]) * mixT;

      // سنگِ بلندتر روشن‌تر و سنگِ ساییده کمی خنثی‌تر؛ لکه‌های کهنگی روی هر سنگ
      const blotch = periodicNoise(u + stone.jit, v + stone.jit * 0.5, 21, 311) - 0.5;
      const scale =
        (0.8 + stone.level * 0.26) *
        (0.86 + dome * 0.24) *
        (1 + blotch * 0.16) *
        (1 - stone.wear * 0.06);
      r *= (0.94 + stone.warm * 0.16) * scale;
      g *= (0.96 + stone.warm * 0.08) * scale;
      b *= (1.06 - stone.warm * 0.1) * scale;

      // نوارِ روشنِ لبه: جایی که تراش خورده و سنگِ تازه پیدا است
      const chip = 1 - clamp(Math.abs(dome - 0.5) / 0.3, 0, 1);
      const chipLight = chip * 16 * onStone;
      r += chipLight;
      g += chipLight * 0.96;
      b += chipLight * 0.9;

      // خزه و گچ: فقط روی لبهٔ سایه‌دارِ سنگ‌هایی که زمینِ مرطوب‌تری دارند
      const mossMask =
        stone.moss > 0.58
          ? clamp((periodicNoise(u, v, 17, 61) - 0.62) * 4, 0, 1) * clamp(0.65 - dome, 0, 1)
          : 0;
      r += (MOSS_COLOR[0] - r) * mossMask * 0.55;
      g += (MOSS_COLOR[1] - g) * mossMask * 0.55;
      b += (MOSS_COLOR[2] - b) * mossMask * 0.55;

      // بند: ملاتِ خاکیِ پر از دانه‌ریزه — نه خطِ سیاهِ تخت
      const mortarTint = 0.7 + hash2D(px * 3 + 7, py * 3 + 11, 1451) * 0.55;
      const mortarMix = mortar * mortar * (3 - 2 * mortar);
      r = r * (1 - mortarMix) + MORTAR_COLOR[0] * mortarTint * mortarMix;
      g = g * (1 - mortarMix) + MORTAR_COLOR[1] * mortarTint * mortarMix;
      b = b * (1 - mortarMix) + MORTAR_COLOR[2] * mortarTint * mortarMix;

      const speckle = (hash2D(px, py, 1301) - 0.5) * 11;
      colorData[off] = byte(r + speckle);
      colorData[off + 1] = byte(g + speckle);
      colorData[off + 2] = byte(b + speckle);
      colorData[off + 3] = 255;

      // ------------------------------------------------ زبری (همیشه خشک و مات)
      const rough = clamp(
        0.93 -
          dome * 0.05 -
          stone.wear * 0.05 +
          mortar * 0.05 +
          mossMask * 0.03 +
          blotch * 0.03 +
          (stone.level - 0.7) * 0.02,
        0.82,
        0.985,
      );
      const roughByte = byte(rough * 255);
      roughnessData[off] = roughByte;
      roughnessData[off + 1] = roughByte;
      roughnessData[off + 2] = roughByte;
      roughnessData[off + 3] = 255;

      // ------------------------------------------------ AO: بند و پشتِ لبه سایه می‌گیرند
      const ao = clamp(0.18 + onStone * (0.5 + dome * 0.32) + onStone * 0.06, 0, 1);
      const aoByte = byte(ao * 255);
      aoData[off] = aoByte;
      aoData[off + 1] = aoByte;
      aoData[off + 2] = aoByte;
      aoData[off + 3] = 255;
    }
  }

  const mkTex = (data: Uint8Array, srgb: boolean) => {
    const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 16;
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
