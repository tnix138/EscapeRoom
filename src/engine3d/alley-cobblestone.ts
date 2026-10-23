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
 *   - **قرینگیِ چینی:** تایل بافت حولِ خطِ مرکزی کوچه **آینه** است (نیمهٔ راستِ
 *     تایل قرینهٔ نیمهٔ چپ). رج‌های سنگ‌فرش در کوچهٔ واقعی دورِ ناودانیِ وسط
 *     چیده می‌شوند، پس چینیِ بی‌قوارّه که از دو طرفِ کوچه دیده می‌شد خطای
 *     اصلی بود. `COBBLE.mirrorX` همین کار را می‌کند: چیدمان و رنگ و ارتفاع
 *     همه حولِ u=0 (یعنی x=0، چون تایل روی لبه در محور می‌افتد) قرینه‌اند.
 *   - **هر سنگ خودش است:** رج‌ها صاف و موازی‌اند (warp کم)، ولی اندازه، رنگ،
 *     قُدم‌ونوی و پهنای بندِ هر سنگ فرق می‌کند؛ بعضی خانه‌ها دو نیم‌سنگ‌اند و
 *     بعضی سه‌تا، مثل سنگ‌های پرکنندهٔ بین سنگ‌های بزرگ.
 *   - **تفاوت ارتفاعی مشخص:** هر سنگ یک `level` دارد (سنگِ بلند و سنگِ نشسته) و
 *     صفحهٔ بالایش کمی **شیب** دارد. `COBBLE.relief` دامنهٔ جابه‌جاییِ هندسه است
 *     و همان عدد روی رأس‌های مشِ کف می‌نشیند.
 *   - **بندِ فرورفته و پُر از خاک:** کفِ بند ~۰٫۶۵ واحد پایین‌تر از تاجِ سنگ
 *     است، رنگش قهوه‌ای خاکی است نه سیاهِ تخت، و زبری‌اش بیشتر.
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
   * پایین‌ترین سنگ ۵ سانتی‌متر فرو می‌رود. جهتِ جابه‌جایی عمداً فقط روپایین است
   * تا چاله‌های آب و هالهٔ نورِ چراغ‌ها که روی همین سطح‌اند زیرِ سنگ نروند.
   */
  relief: 0.05,
  /** تاجِ سنگ بر حسبِ ترازِ خودش؛ سنگِ نشسته کوتاه‌تر تراشیده می‌شود */
  topForLevel: (level: number): number => 0.58 + 0.34 * level,
  /** ارتفاع نرمالیزهٔ کفِ بند */
  jointLevel: 0.16,
  /** پهنای regionِ انتقالِ تراز بین دو سنگ (کسرِ خانه) — بقیهٔ سنگ تخت است */
  levelEdge: 0.24,
  /** پهنای پیچِ لبهٔ سنگ؛ لبهٔ تیزِ ماشین‌کاری‌شده نیست */
  bevelDrop: 0.062,
  /** کمینه و بیشینهٔ نیم‌عرض بند ⇒ فاصلهٔ چینش از سنگی به سنگ دیگر عوض می‌شود */
  jointMin: 0.024,
  jointMax: 0.055,
  /** چقدر طول می‌کشد تا از لبهٔ سنگ به کفِ بند برسیم (واحدِ سلول) */
  jointFeather: 0.03,
  /** دامنهٔ نویز ریزِ تراش روی صفحهٔ سنگ */
  grain: 0.042,
  /** دامنهٔ خط‌های تراشِ موازی (چکش‌کاریِ روی سنگ) */
  chisel: 0.011,
  /** شیبِ مجازِ صفحهٔ بالای هر سنگ */
  tiltRange: 0.028,
  /** دامنهٔ کجیِ رج‌ها — کم است تا چینی «قوارّه» بماند، نه آشفته */
  warpX: 0.22,
  warpY: 0.13,
  /** لغزشِ هر رج تا رج‌ها خطِ راستِ بی‌نقص نمانند (نیم‌خشت + کمی خطا) */
  rowJitter: 0.16,
  /** نسبتِ خانه‌هایی که دو نیم‌سنگ می‌شوند و نسبتِ آن‌هایی که سه‌تا */
  splitTwoRatio: 0.24,
  splitThreeRatio: 0.1,
  /** نسبتِ سنگ‌های بلندِ برجسته به سنگ‌های نشسته (توانِ توزیعِ تراز) */
  levelExponent: 0.62,
  levelFloor: 0.16,
  /** آینه‌کردنِ چیدمان حولِ مرکزِ تایل (خطِ مرکزیِ کوچه) */
  mirrorX: true,
  /** تکرار بافت روی کف کوچه (۱۳٫۲ × ۴۲ متر) — با جابه‌جاییِ هندسه یکی باید بماند */
  repeatX: 4,
  repeatY: 10,
  /** اندازهٔ تکسچر؛ توانِ دو باشد تا mipmaps و RepeatWrapping سالم بمانند */
  textureSize: 1024,
} as const;

/**
 * چگالیِ شبکهٔ کف. سنگ‌ها ~۳۰ سانتی‌مترند و ترازِ هر سنگ روی رأس‌های اطرافش
 * پخش می‌شود، پس رأس‌ها باید از خودِ سنگ ریزتر باشند — وگرنه موجِ کف گم می‌شود.
 */
export const COBBLE_GROUND_SEGMENTS = { x: 72, y: 228 } as const;

/**
 * پالت رنگِ سنگ‌های کوچه: بازالتِ تیره تا ماسه‌ایِ روشن، سرد تا گرم.
 * دوازده رنگ است تا هیچ دو سنگِ همسایه‌ای همرنگ نیفتند (سنگِ کوچه از چند
 * معدنِ مختلف می‌آمد؛ تک‌رنگ بودنِ کف بزرگ‌ترین نشانهٔ «بافتِ ارزان» است).
 */
const STONE_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [58, 58, 60],
  [72, 70, 66],
  [84, 80, 74],
  [96, 92, 84],
  [108, 101, 89],
  [120, 112, 97],
  [68, 72, 79],
  [80, 86, 92],
  [92, 84, 72],
  [104, 92, 76],
  [112, 104, 92],
  [126, 118, 104],
];

/** رنگِ ملات و خاکِ داخل بند — قهوه‌ایِ خاکی، نه سیاهِ تخت */
const MORTAR_COLOR: readonly [number, number, number] = [47, 40, 32];
/** رنگِ خزه و گچ روی لبهٔ سایه‌دارِ سنگ */
const MOSS_COLOR: readonly [number, number, number] = [74, 90, 58];

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function byte(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** هش صحیحِ قطعی — همان خانوادهٔ هشِ بقیهٔ بافت‌های کوچه */
function hash2D(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * نویز مقداری روی یک lattice دوره‌ای: روی u و v در [۰،۱) بدون درز تایل می‌شود
 * و جدولِ lattice یک‌بار ساخته و کش می‌شود، پس ساختِ میدانِ ۱۰۲۴ پیکسلی فقط
 * چند خواندنِ آرایه است و نه میلیون‌ها بار هشِ دوبعدی (هزینۀ بارگذاریِ صحنه).
 * دو دورۀ مستقل می‌گیرد تا بشود نویزِ «دراز‌کشیده» ساخت — خطِّ تراش روی سنگ در
 * یک راستا کشیده است و نه نقطه‌ای.
 */
class LatticeNoise {
  private readonly values: Float32Array;

  constructor(readonly periodX: number, readonly periodY: number, seed: number) {
    const values = new Float32Array(this.periodX * this.periodY);
    for (let y = 0; y < this.periodY; y++) {
      for (let x = 0; x < this.periodX; x++) values[y * this.periodX + x] = hash2D(x, y, seed);
    }
    this.values = values;
  }

  at(u: number, v: number): number {
    const px = this.periodX;
    const x = u * px;
    const y = v * this.periodY;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const x0 = ((ix % px) + px) % px;
    const x1 = (x0 + 1) % px;
    const y0 = ((iy % this.periodY) + this.periodY) % this.periodY;
    const y1 = (y0 + 1) % this.periodY;
    const values = this.values;
    const a = values[y0 * px + x0];
    const b = values[y0 * px + x1];
    const c = values[y1 * px + x0];
    const d = values[y1 * px + x1];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
}

// جدول‌ها ثابتِ ماژول‌اند: یک بار ساخته می‌شوند و در حلقۀ پیکسل فقط خوانده
// می‌شوند (ساختنِ کلید یا هشِ دوبعدی در ۱٬۰۴۸٬۵۷۶ پیکسل گران تمام می‌شود)
const N_WARP_U = new LatticeNoise(7, 7, 5);
const N_WARP_V = new LatticeNoise(6, 6, 9);
const N_GRAIN = new LatticeNoise(54, 42, 23);
const N_GRAIN_FINE = new LatticeNoise(140, 110, 733);
// خطِّ تراشِ سنگ. نویز روی مختصاتِ *داخلِ خودِ سنگ* نمونه می‌شود، پس خط‌های
// هر سنگ در لبه‌اش تمام می‌شوند و با سنگِ کناری هم‌فاصله نمی‌افتند — وگرنه
// کل کف نوارِ عمودیِ سراسری (کُردُرو) می‌شود
const N_CHISEL = new LatticeNoise(6, 6, 419);
const N_PIT = new LatticeNoise(33, 26, 127);
const N_BLOTCH = new LatticeNoise(15, 12, 311);
const N_GRIME = new LatticeNoise(9, 5, 373);
const N_MOSS = new LatticeNoise(17, 17, 61);

/**
 * وزنِ «صفحهٔ تخت»: تا فاصلهٔ `f` از مرزِ خانه بیشتر از `edge` باشد وزن ۱ است
 * (سنگ روی ترازِ خودش تخت می‌ماند) و نزدیک مرز با smoothstep به صفر می‌رسد تا
 * شیب فقط داخل بند بیفتد — همان‌طور که در سنگ‌فرش واقعی پله لبهٔ سنگ است.
 */
function plateauWeight(f: number, edge: number): number {
  const t = clamp(Math.min(f, 1 - f) / Math.max(0.02, edge), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * آینهٔ عمودیِ تایل: u را روی [۰،۰٫۵] تا می‌کند ⇒ هرچه در نیمهٔ راست بافت
 * می‌بینیم قرینهٔ نیمهٔ چپ است. چون `repeatX` زوج است، خطِ تاشدگی u=0 دقیقاً
 * روی محورِ کوچه (x=0) می‌افتد و چینی دورِ ناودانیِ وسط قرینه می‌شود.
 */
function mirrorU(u: number): number {
  const t = mod(u, 1);
  return t > 0.5 ? 1 - t : t;
}

/** ویژگی‌های یک خانهٔ چینی‌شده (خانه ممکن است دو یا سه نیم‌سنگ داشته باشد) */
export interface CobbleCell {
  /** ترازِ صفحهٔ بالای سنگ: ۰ = نشسته، ۱ = بلند — همان چیزی که هندسه جابه‌جا می‌کند */
  level: number;
  /** کمینه و بیشینهٔ نیم‌عرضِ بند در دو راستا */
  jx: number;
  jy: number;
  /** ۱ تا ۳: بعضی خانه‌ها دو یا سه نیم‌سنگِ کنارِ همند */
  subX: number;
  /** جایِ شکستِ خانه وقتی دو نیم‌سنگ است (۰٫۳۴..۰٫۶۶ ⇒ نیم‌سنگ‌ها هم‌عرض نیستند) */
  splitA: number;
  /** نمایهٔ اولین سنگِ این خانه در جدولِ سنگ‌ها */
  firstVariant: number;
  /** لغزشِ جزئیِ خانه تا سنگ‌ها ذره‌ای از خطِ رج بیرون بزنند */
  jitterX: number;
  jitterY: number;
}

/** ویژگی‌های رنگ و تراشِ یک **سنگِ واقعی** (خانهٔ تقسیم‌شده دو یا سه سنگ دارد) */
export interface CobbleStone {
  level: number;
  tiltX: number;
  tiltY: number;
  jx: number;
  jy: number;
  /** جایِ سنگ در پالت (۰..۱ ⇒ روی اندیسِ پالت نگاشت می‌شود) */
  tone: number;
  /** گرم/سرد بودنِ سنگ — سنگِ ماسه‌ای گرم‌تر و سنگِ بازالت سردتر */
  warm: number;
  /** روشناییِ مستقلِ هر سنگ تا همسایه‌ها از هم جدا دیده شوند */
  light: number;
  /** سنگ‌های زیرِ مسیرِ رفت‌وآمد ساییده‌تر و صاف‌ترند */
  wear: number;
  /** احتمالِ خزه‌گرفتنِ لبهٔ سایه‌دار */
  moss: number;
  /** گردیِ سنگ: ۰ = تراشِ تیزِ مربعی، ۱ = سنگِ رودخانه‌ایِ گِرد */
  round: number;
  /** چکش‌کاری: چند خطِّ موازی روی صفحهٔ سنگ (۰ = صافِ سنباده‌خورده) */
  chiselBias: number;
  /** راستای خطِّ تراش: ۰ = موازیِ محورِ کوچه، ۱ = عمود بر آن */
  chiselDir: number;
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
      const level = clamp(
        COBBLE.levelFloor + Math.pow(levelRoll, COBBLE.levelExponent) * (1 - COBBLE.levelFloor),
        0,
        1,
      );
      // بعضی خانه‌ها دو نیم‌سنگ می‌شوند و بعضی سه‌تا — مثل سنگ‌های پرکنندهٔ
      // باریک بین سنگ‌های بزرگِ کوچه، که مهم‌ترین نشانهٔ «چینیِ دستی» است
      const splitRoll = hash2D(col + 91, row + 13, 23);
      const subX =
        splitRoll < COBBLE.splitThreeRatio ? 3 : splitRoll < COBBLE.splitTwoRatio + COBBLE.splitThreeRatio ? 2 : 1;
      const jx = COBBLE.jointMin + hash2D(col + 17, row + 3, 41) * (COBBLE.jointMax - COBBLE.jointMin);
      const jy = COBBLE.jointMin + hash2D(col + 61, row + 29, 47) * (COBBLE.jointMax - COBBLE.jointMin);
      cells.push({
        level,
        jx,
        jy,
        subX,
        splitA: 0.34 + hash2D(col + 5, row + 41, 59) * 0.32,
        firstVariant: stones.length,
        jitterX: (hash2D(col + 101, row + 61, 83) - 0.5) * COBBLE.rowJitter,
        jitterY: (hash2D(col + 29, row + 103, 89) - 0.5) * COBBLE.rowJitter * 0.8,
      });

      for (let sub = 0; sub < subX; sub++) {
        const roll = hash2D(col * 3 + sub, row + 7, 109);
        // نیم‌سنگ‌ها از همسایه‌هایشان کوتاه‌تر و باریک‌ترند (سنگِ پرکننده)
        const filler = subX > 1;
        stones.push({
          level: clamp(
            level * (filler ? 0.82 + roll * 0.34 : 1) - (filler ? 0.03 : 0),
            0,
            1,
          ),
          tiltX: (hash2D(col + 5 + sub * 17, row + 53, 29) - 0.5) * 2 * COBBLE.tiltRange,
          tiltY: (hash2D(col + 71, row + 11 + sub * 7, 37) - 0.5) * 2 * COBBLE.tiltRange,
          jx: filler
            ? COBBLE.jointMin + (COBBLE.jointMax - COBBLE.jointMin) * (0.5 + roll * 0.5)
            : jx,
          jy: jy,
          tone: hash2D(col + 13 + sub * 3, row + 7, 53),
          warm: hash2D(col + 31, row + 19 + sub * 5, 67),
          light: 0.72 + hash2D(col + 23 + sub * 11, row + 71, 97) * 0.56,
          wear: Math.pow(hash2D(col + 83, row + 43 + sub * 11, 71), 1.6),
          moss: hash2D(col + 7 + sub * 13, row + 97, 79),
          round: hash2D(col + 37 + sub * 5, row + 83, 113),
          chiselBias: Math.pow(hash2D(col + 53 + sub * 19, row + 29, 127), 1.35),
          chiselDir: hash2D(col + 67 + sub * 23, row + 37, 131),
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
  /** روشن/تاریکِ خطِّ تراش (−۱..۱) — نورمل و رنگِ سنگ هر دو از همین عدد می‌آیند */
  chisel: number;
}

/**
 * ارتفاعِ سنگ‌فرش در مختصاتِ بافت (نیمهٔ چپِ تایل؛ `buildCobbleField` همان را
 * آینه می‌کند). خانه‌ها از یک شبکهٔ کمی warp‌شده می‌آیند ⇒ بندها بی‌نقصِ
 * خط‌کش‌کشیده نیستند، ولی رج‌ها همچنان قوارّه می‌مانند.
 */
export function sampleCobbleHeight(u: number, v: number, table: CobbleTable): CobbleSample {
  const { cells, stones } = table;

  // فاصله تا خطِ تاشدگیِ تایل (u=0 و u=۰٫۵): هرچه نزدیک‌تر، کجیِ شبکه کمتر،
  // تا بندِ روی محورِ قرینگی شکسته و V‌شکل نشود
  const crease = clamp(Math.min(mod(u, 0.5), 0.5 - mod(u, 0.5)) / 0.055, 0, 1);
  const creaseFade = crease * crease * (3 - 2 * crease);
  const warpU = (N_WARP_U.at(u, v) - 0.5) * COBBLE.warpX * creaseFade;
  const warpV = (N_WARP_V.at(u, v) - 0.5) * COBBLE.warpY * creaseFade;

  const rf = v * COBBLE.rows + warpV;
  const rowFloor = Math.floor(rf);
  const row = mod(rowFloor, COBBLE.rows);
  const fyRaw = rf - rowFloor;
  // نیم‌خشت + لغزشِ ملایمِ هر رج
  const rowShift =
    (row % 2) * 0.5 +
    (hash2D(mod(rowFloor, COBBLE.rows), 3, 71) - 0.5) * COBBLE.rowJitter * creaseFade;

  const cf = u * COBBLE.cols + rowShift + warpU;
  const colFloor = Math.floor(cf);
  const col = mod(colFloor, COBBLE.cols);
  let fx = cf - colFloor;
  let fy = fyRaw;

  const cell = cells[row * COBBLE.cols + col];
  let stoneIdx = cell.firstVariant;
  if (cell.subX > 1) {
    // مرزهای شکستِ خانه (بستری که `subBounds` می‌سازد داخل حلقۀ پیکسل گران است،
    // پس همین‌جا بازنویسی می‌شود)
    const a = cell.subX === 2 ? cell.splitA : cell.splitA * 0.62;
    const b = cell.subX === 3 ? 0.5 + cell.splitA * 0.25 : 1;
    let lo = 0;
    let hi = a;
    if (fx >= hi) {
      stoneIdx++;
      lo = hi;
      hi = cell.subX === 2 ? 1 : b;
      if (fx >= hi) {
        stoneIdx++;
        lo = hi;
        hi = 1;
      }
    }
    fx = (fx - lo) / (hi - lo);
  }

  const stone = stones[stoneIdx];
  fx = clamp(fx + cell.jitterX * 0.3 * creaseFade, 0, 1);
  fy = clamp(fy + cell.jitterY * 0.3 * creaseFade, 0, 1);

  // فاصله تا نزدیک‌ترین مرزِ خانه، منهای بندِ خودِ سنگ
  const inX = Math.min(fx, 1 - fx) - stone.jx;
  const inY = Math.min(fy, 1 - fy) - stone.jy;
  const inStone = Math.min(inX, inY);
  const mortar = clamp(1 - inStone / COBBLE.jointFeather, 0, 1);

  // بالشتکِ صفحهٔ بالا: وسطِ سنگ تخت است و نزدیک لبه پیچ می‌خورد. سنگِ گِرد
  // پیچِ نرم‌تری دارد و سنگِ تراش‌خورده صفحهٔ پهن‌ترِ تخت‌تر
  const px = clamp(inX / Math.max(0.05, 0.5 - stone.jx), 0, 1);
  const py = clamp(inY / Math.max(0.05, 0.5 - stone.jy), 0, 1);
  const domeExp = 0.45 + stone.round * 0.4;
  const dome = Math.sin(clamp(Math.min(px, py), 0, 1) * Math.PI * 0.5) ** domeExp;

  const top = COBBLE.topForLevel(stone.level);
  const tilt = (stone.tiltX * (fx - 0.5) + stone.tiltY * (fy - 0.5)) * 2 * (1 - mortar);
  const grain =
    (N_GRAIN.at(u, v) - 0.5) * 2 * COBBLE.grain * (1 - mortar * 0.55) +
    (N_GRAIN_FINE.at(u, v) - 0.5) * 2 * COBBLE.grain * 0.28 * (1 - mortar * 0.5);
  // چکش‌کاری: خط‌های موازیِ ریزِ تراش روی صفحهٔ سنگ. راستا و فازِ خط‌ها به خودِ
  // سنگ ربط دارد (نه به کل کف) و سنگِ صیقلی/ساییده هیچ خطی ندارد
  const chiselGate = stone.chiselBias > 0.34 ? (stone.chiselBias - 0.34) / 0.66 : 0;
  const chiselFreq = 2.2 + stone.chiselBias * 2.6;
  const chiselPhase = stone.jit * 3.7;
  const chiselMix =
    (N_CHISEL.at(fx * 0.5 + chiselPhase, fy * chiselFreq) * (1 - stone.chiselDir) +
      N_CHISEL.at(fx * chiselFreq, fy * 0.5 + chiselPhase) * stone.chiselDir) *
    chiselGate *
    (1 - stone.wear) +
    0.5 * (1 - chiselGate * (1 - stone.wear));
  const chiselShade = (chiselMix - 0.5) * 2 * (1 - mortar);
  const chisel = chiselShade * COBBLE.chisel;
  // کنده‌خوردگی: نوار باریک روی پیچِ لبه + چند گودالِ ریز
  const chipBand = 1 - clamp(Math.abs(dome - 0.62) / 0.34, 0, 1);
  const pit = N_PIT.at(u, v) > 0.9 ? 0.03 : 0;

  const h = clamp(
    top +
      tilt +
      chisel -
      (1 - dome) * COBBLE.bevelDrop * (0.75 + stone.round * 0.5) -
      mortar * (top - COBBLE.jointLevel) +
      grain * (0.6 + dome * 0.4) -
      chipBand * 0.02 -
      pit * (1 - mortar),
    0.02,
    1,
  );

  return { h, mortar, dome, stone: stoneIdx, chisel: clamp(chiselShade, -1, 1) };
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
  /** خطِّ تراشِ هر پیکسل (۱۲۷ = بدون خط)؛ همان عدد در نقشۀ نور و رنگ می‌نشیند */
  readonly chisel: Uint8Array;
  readonly table: CobbleTable;
  /** ارتفاعِ پیکسل‌ها با درون‌یابی دوخطی و wrap دوره‌ای */
  sampleHeight(u: number, v: number): number;
  /**
   * ترازِ سنگِ آن نقطه — برای جابه‌جاییِ رأس‌های کف. چون روی خودِ شبکهٔ سنگ
   * تعریف می‌شود، با رأسِ تنبل هم کج‌ونابرابر نمی‌شود.
   */
  sampleLevel(u: number, v: number): number;
}

export function buildCobbleField(size: number = COBBLE.textureSize): CobbleField {
  const n = Math.max(16, Math.round(size));
  const heights = new Float32Array(n * n);
  const mortarField = new Float32Array(n * n);
  const domeField = new Float32Array(n * n);
  const stoneIndex = new Uint16Array(n * n);
  const chiselField = new Uint8Array(n * n);
  const table = cobbleTable();
  const half = COBBLE.mirrorX ? Math.floor(n / 2) : n - 1;

  for (let py = 0; py < n; py++) {
    const v = py / n;
    // نیمهٔ چپ محاسبه و در نیمهٔ راست **آینه** می‌شود: هم هزینهٔ ساخت نصف
    // می‌شود و هم قرینگی دقیقاً برقرار است (نه تقریبی)
    for (let px = 0; px <= half; px++) {
      const sample = sampleCobbleHeight(px / n, v, table);
      const src = py * n + px;
      const dst = py * n + mod(n - px, n);
      const chiselByte = byte((sample.chisel + 1) * 127.5);
      heights[src] = sample.h;
      mortarField[src] = sample.mortar;
      domeField[src] = sample.dome;
      stoneIndex[src] = sample.stone;
      chiselField[src] = chiselByte;
      if (dst !== src) {
        heights[dst] = sample.h;
        mortarField[dst] = sample.mortar;
        domeField[dst] = sample.dome;
        stoneIndex[dst] = sample.stone;
        chiselField[dst] = chiselByte;
      }
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
    chisel: chiselField,
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
      const uu = COBBLE.mirrorX ? mirrorU(u) : u;
      const cu = 1 / COBBLE.cols;
      const cv = 1 / COBBLE.rows;
      const fu = mod(uu * COBBLE.cols, 1);
      const fv = mod(v * COBBLE.rows, 1);
      const wu = plateauWeight(fu, COBBLE.levelEdge);
      const wv = plateauWeight(fv, COBBLE.levelEdge);
      const uNeigh = fu < 0.5 ? uu - cu : uu + cu;
      const vNeigh = fv < 0.5 ? v - cv : v + cv;
      const self = cellLevel(uu, v);
      const sideU = cellLevel(uNeigh, v);
      const sideV = cellLevel(uu, vNeigh);
      const corner = cellLevel(uNeigh, vNeigh);
      return clamp(
        self * wu * wv +
          sideU * (1 - wu) * wv +
          sideV * wu * (1 - wv) +
          corner * (1 - wu) * (1 - wv),
        0,
        1,
      );
    },
  };
}

/**
 * چهار نقشهٔ PBR از روی میدانِ ارتفاع. نورمل از گرادیانِ ۳×۳ (سابل) ساخته می‌شود
 * تا لبهٔ سنگ‌ها تیز بماند، و دو لایهٔ ریزِ تراش (دانه + خطِّ چکش) روی آن
 * می‌نشیند که صفحهٔ سنگ پلاستیک‌وار صاف نباشد.
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
  const {
    heights,
    mortar: mortarField,
    dome: domeField,
    stoneIndex,
    chisel: chiselField,
    table,
  } = field;
  const stones = table.stones;
  // توانِ نورمل با رزولوشن مقیاس می‌شود تا در هر اندازه شیبِ یکسانی بدهد
  const strength = 2.9 * (n / 256);
  const half = COBBLE.mirrorX ? Math.floor(n / 2) : n - 1;

  // نمایهٔ سابل بدون `at` و `mod` در هر همسایه (۹ × ۵۱۲٬۴۱۶ بار در هر ساخت)
  const xm = new Int32Array(n + 2);
  for (let x = -1; x <= n; x++) xm[x + 1] = mod(x, n);
  const ym = new Int32Array(n + 2);
  for (let y = -1; y <= n; y++) ym[y + 1] = mod(y, n);

  for (let py = 0; py < n; py++) {
    const v = py / n;
    for (let px = 0; px <= half; px++) {
      const u = px / n;
      const idx = py * n + px;
      const mortar = mortarField[idx];
      const dome = domeField[idx];
      const onStone = 1 - mortar;
      const stone = stones[stoneIndex[idx]];

      // ------------------------------------------------ نورمل (سابل ۳×۳ + تراش ریز)
      const c0 = ym[py] * n;
      const c1 = ym[py + 1] * n;
      const c2 = ym[py + 2] * n;
      const l = xm[px];
      const m = xm[px + 1];
      const r2 = xm[px + 2];
      const h00 = heights[c0 + l];
      const m0 = heights[c0 + m];
      const h02 = heights[c0 + r2];
      const h10 = heights[c1 + l];
      const m1 = heights[c1 + m];
      const h12 = heights[c1 + r2];
      const h20 = heights[c2 + l];
      const m2 = heights[c2 + m];
      const h22 = heights[c2 + r2];
      const gx = h02 - h00 + (h12 - h10) * 2 + h22 - h20;
      const gy = m2 - m0 + (h20 + h22 - h00 - h02);
      // دانهٔ ریزِ سنگ — از نویزِ پیکسلی می‌آید و روی نیمهٔ آینه کپی می‌شود
      const gritX = hash2D(mod(px + 1, n), py, 991) - hash2D(mod(px - 1, n), py, 991);
      const gritY = hash2D(px, mod(py + 1, n), 997) - hash2D(px, mod(py - 1, n), 997);
      const nxRaw = -gx * 0.25 * strength + gritX * 0.055 * onStone;
      const nyRaw = gy * 0.25 * strength + gritY * 0.055 * onStone;
      const invLen = 1 / Math.hypot(nxRaw, nyRaw, 1);
      const nx = nxRaw * invLen;
      const ny = nyRaw * invLen;
      const nz = invLen;

      // ------------------------------------------------ رنگ سنگ
      const tonePos = stone.tone * (STONE_PALETTE.length - 1);
      const p0 = STONE_PALETTE[Math.floor(tonePos) % STONE_PALETTE.length];
      const p1 = STONE_PALETTE[(Math.floor(tonePos) + 1) % STONE_PALETTE.length];
      const mixT = tonePos - Math.floor(tonePos);
      let r = p0[0] + (p1[0] - p0[0]) * mixT;
      let g = p0[1] + (p1[1] - p0[1]) * mixT;
      let b = p0[2] + (p1[2] - p0[2]) * mixT;

      // سنگِ بلندتر روشن‌تر و سنگِ ساییده کمی خنثی‌تر؛ لکه‌های کهنگی روی هر سنگ
      const blotch = N_BLOTCH.at(u + stone.jit, v + stone.jit * 0.5) - 0.5;
      const grime = N_GRIME.at(u + stone.jit * 0.7, v - stone.jit) - 0.5;
      // گودالچه‌ها فقط روی صفحهٔ سنگ (تاریکیِ کم‌عمق، نه سیاهی)
      const pitDark = N_PIT.at(u, v) > 0.88 ? (1 - mortar) * 0.1 : 0;
      const scale =
        stone.light *
        (0.88 + dome * 0.2) *
        (1 + blotch * 0.34) * (1 - pitDark * 0.55) *
        (1 - grime * 0.16) *
        (1 - stone.wear * 0.05);
      r *= (0.92 + stone.warm * 0.2) * scale;
      g *= (0.955 + stone.warm * 0.1) * scale;
      b *= (1.08 - stone.warm * 0.13) * scale;

      // خطِّ تراشِ روشن و سایه‌اش: سنگِ چکش‌خورده در نورِ مایل نوارنوار می‌شود
      // خطِّ تراش از همان کانالی می‌آید که نورمل را می‌سازد ⇒ نور و رنگِ سنگ
      // روی یک رگه نمی‌جنگند
      const chiselLight = (chiselField[idx] - 127.5) * (8 / 127.5);
      r += chiselLight;
      g += chiselLight * 0.97;
      b += chiselLight * 0.92;

      // نوارِ روشنِ لبه: جایی که تراش خورده و سنگِ تازه پیدا است
      const chip = 1 - clamp(Math.abs(dome - 0.42) / 0.17, 0, 1);
      const chipLight = chip * 9 * onStone * (0.45 + stone.round * 0.55);
      r += chipLight;
      g += chipLight * 0.96;
      b += chipLight * 0.9;

      // خزه و گچ: فقط روی لبهٔ سایه‌دارِ سنگ‌هایی که زمینِ مرطوب‌تری دارند
      const mossMask =
        stone.moss > 0.58
          ? clamp((N_MOSS.at(u, v) - 0.62) * 4, 0, 1) * clamp(0.65 - dome, 0, 1)
          : 0;
      r += (MOSS_COLOR[0] - r) * mossMask * 0.55;
      g += (MOSS_COLOR[1] - g) * mossMask * 0.55;
      b += (MOSS_COLOR[2] - b) * mossMask * 0.55;

      // بند: ملاتِ خاکیِ پر از دانه‌ریزه — نه خطِ سیاهِ تخت
      const mortarTint = 0.62 + hash2D(px * 3 + 7, py * 3 + 11, 1451) * 0.66;
      const mortarMix = mortar * mortar * (3 - 2 * mortar);
      r = r * (1 - mortarMix) + MORTAR_COLOR[0] * mortarTint * mortarMix;
      g = g * (1 - mortarMix) + MORTAR_COLOR[1] * mortarTint * mortarMix;
      b = b * (1 - mortarMix) + MORTAR_COLOR[2] * mortarTint * mortarMix;

      const speckle = (hash2D(px, py, 1301) - 0.5) * 7;
      const cr = byte(r + speckle);
      const cg = byte(g + speckle);
      const cb = byte(b + speckle);

      // ------------------------------------------------ زبری (همیشه خشک و مات)
      const rough = clamp(
        0.93 -
          dome * 0.055 -
          stone.wear * 0.05 +
          mortar * 0.05 +
          mossMask * 0.03 +
          blotch * 0.03 +
          stone.chiselBias * 0.012 +
          (stone.level - 0.7) * 0.02,
        0.82,
        0.985,
      );
      const roughByte = byte(rough * 255);

      // ------------------------------------------------ AO: بند و پشتِ لبه سایه می‌گیرند
      // «حفره» = فرقِ ارتفاعِ این پیکسل با چهار همسایه ⇒ لبهٔ پایینِ سنگِ بلند
      // سایهٔ تماسی می‌گیرد و افتادگیِ کف فقط تغییرِ رنگ نمی‌ماند
      const cavity = clamp((h10 + h12 + m0 + m2) * 0.25 - m1, 0, 0.5);
      const ao = clamp(
        0.17 + onStone * (0.47 + dome * 0.3) + onStone * 0.06 + cavity * 0.42,
        0,
        1,
      );
      const aoByte = byte(ao * 255);

            // ---- نوشتنِ پیکسل؛ نیمهٔ راست همان است، فقط شیبِ x قرینه می‌شود
      const off = idx * 4;
      colorData[off] = cr;
      colorData[off + 1] = cg;
      colorData[off + 2] = cb;
      colorData[off + 3] = 255;
      normalData[off] = byte((nx * 0.5 + 0.5) * 255);
      normalData[off + 1] = byte((ny * 0.5 + 0.5) * 255);
      normalData[off + 2] = byte((nz * 0.5 + 0.5) * 255);
      normalData[off + 3] = 255;
      roughnessData[off] = roughByte;
      roughnessData[off + 1] = roughByte;
      roughnessData[off + 2] = roughByte;
      roughnessData[off + 3] = 255;
      aoData[off] = aoByte;
      aoData[off + 1] = aoByte;
      aoData[off + 2] = aoByte;
      aoData[off + 3] = 255;

      const mx = mod(n - px, n);
      if (mx !== px) {
        const moff = (py * n + mx) * 4;
        colorData[moff] = cr;
        colorData[moff + 1] = cg;
        colorData[moff + 2] = cb;
        colorData[moff + 3] = 255;
        normalData[moff] = byte((-nx * 0.5 + 0.5) * 255);
        normalData[moff + 1] = byte((ny * 0.5 + 0.5) * 255);
        normalData[moff + 2] = byte((nz * 0.5 + 0.5) * 255);
        normalData[moff + 3] = 255;
        roughnessData[moff] = roughByte;
        roughnessData[moff + 1] = roughByte;
        roughnessData[moff + 2] = roughByte;
        roughnessData[moff + 3] = 255;
        aoData[moff] = aoByte;
        aoData[moff + 1] = aoByte;
        aoData[moff + 2] = aoByte;
        aoData[moff + 3] = 255;
      }
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
