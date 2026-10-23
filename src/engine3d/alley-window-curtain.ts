'use client';

/**
 * alley-window-curtain.ts — پردهٔ مخملِ سه پنجرۀ بالای سردرِ تماشاخانه (امیر)
 * ---------------------------------------------------------------------------
 * این سه پنجره پیش‌تر یک صفحهٔ صافِ یکدستِ سرخ بود: بدون چین، بدون سایه، بدون
 * هیچ حسِ پارچه‌ای — یعنی «یک مستطیلِ قرمز». خواستهٔ بازبینی:
 *   ۱. پر از **چین‌چینِ عمودیِ ریز** باشد (پردهٔ جمع‌شده، نه پارچۀ صاف)
 *   ۲. **بالا و پایینش تیره شود** و وسطش قرمزِ معمولی بماند، آن‌هم با گذارِ
 *      حاله‌ای و محو (نه نوارِ تیزِ سیاه و قرمز)
 *   ۳. دورِ دوم: حاله **محوتر** و مشکی **کمتر**
 *   ۴. دورِ سوم: «قرمزش بیشتر، مشکی‌اش کمتر + یه نوار خیلی ریز بالا و
 *      پایین مشکی باشه، بقیش قرمز باشه» ⇒ بدنۀ پرده بدون هیچ تاریکیِ جهانی
 *      قرمزِ سیراب است (`pileColor`، `troughColor`، نورِ پشتِ پرده) و سیاهی به
 *      یک نوارِ ~۶ سانتی‌متری در دو سر (`blackBand`/`blackFade`) خلاصه شده بود
 *   ۵. دورِ چهارم (قطعیِ این نسخه): «اون خطِ مشکی‌ها محو بشه و اتصالِ قرمز و
 *      مشکی نرم و بدون خط باشه، حالتِ محو مانند» ⇒ هستۀ سیاه تقریباً حذف شد
 *      (`blackBand: ۰٫۰۰۴` ≈ ۱ سانتی‌متر) و گذار به یک محوشدگیِ بلندِ
 *      ~۴۵ سانتی‌متری در هر سر رسید (`blackFade: ۰٫۱۶`) با `smootherstep`
 *      (مشتقِ اول و دومِ صفر در دو سر) تا هیچ «خطی» بین سیاه و قرمز دیده نشود.
 *      ضمناً چین‌ها از ۱۳ به ۹ رسیدند: «چین‌چین‌هاش فکر کنم ۱۳ تاست، بکنش ۹ تا»
 *
 * همان درسی که کف سنگ‌فرش گرفت: چین‌ها باید از **یک** میدانِ ارتفاع بیایند و
 * هم نقشه‌ها و هم خودِ هندسه همان میدان را بخوانند، وگرنه نورِ نقشه روی
 * قلمۀ اشتباه می‌افتد و چین «نقاشی‌شده» به‌نظر می‌رسد. پس:
 *   - `curtainPleat(u, v)` → چین‌های درشت؛ تنها همین روی مش می‌نشیند
 *   - `curtainFacing(u, v)` → چین‌های درشت + ریزچین + پرز؛ همان که نقشه‌ها می‌خوانند
 *   - `curtainDepth(u, v)` → جابه‌جاییِ رأس‌های مش (متر، هرگز مثبت نیست)
 *   - `createCurtainFabricMaps()` → رنگ / نورمل / زبری / نورِ پشتِ پرده از همان عدد
 *
 * `curtainShade(v)` همان envelopeٔ عمودی است: داخلِ هستۀ باریکِ دو سر ۰ و بیرون
 * از آن ۱. چون هم در رنگ و هم در نورِ سرخِ پشتِ پرده نوشته می‌شود، نوار واقعاً
 * سیاه است و نه فقط کم‌نور — ولی گذارِ بلند و `smootherstep` آن را «محو» می‌کند،
 * نه یک نوارِ بریده با لبهٔ خط‌دار.
 *
 * همه‌چیز قطعی و بدون DOM است؛ نویزها دوره‌اند تا جابه‌جاییِ UV (که هر سه
 * پنجره را از هم متفاوت می‌کند) هیچ درزی نسازد.
 */

import * as THREE from 'three';

export const CURTAIN = {
  /** تعداد چین‌های اصلی روی هر پنجره (۱٫۳۶ متر ÷ ۹ ≈ هر چین ۱۵٫۱ سانتی‌متر).
      بازبینیِ امیر: «چین‌چین‌هاش فکر کنم ۱۳ تاست، بکنش ۹ تا» */
  pleats: 9,
  /** چین‌های ریزِ دوم روی هر چینِ اصلی (پارچه همیشه دو مقیاس چین دارد) */
  microPleats: 4,
  microAmount: 0.14,
  /** چقدر پهنای چین‌ها از هم فرق می‌کند (پردۀ دست‌چین، نه ویوِ ریاضی) */
  pleatWobble: 0.42,
  wobbleCells: 5,
  /** چین‌های پارچه صافِ خط‌کش‌کشیده نیستند: هرچه بالاتر/پایین‌تر می‌رویم کمی
      به چپ و راست می‌لغزند (برآمدگیِ نرمِ پارچه) */
  meander: 0.16,
  meanderCells: 3,
  /** تیزیِ قله: کم = نوارِ روشنِ پهن و نرم (مخمل)، زیاد = خطِ براقِ باریک */
  crestSharp: 0.72,
  /** چقدر شیبِ چین در نورمل بزرگ‌نمایی می‌شود (برقِ چین‌ها زیرِ چراغِ کوچه).
      با ۹ چینِ پهن‌تر (به‌جای ۱۳ چینِ باریک) شیبِ هر پیکسل کم می‌شود، پس
      بزرگ‌نمایی بالا رفت تا چین‌ها همان برق و خواناییِ قبلی را داشته باشند */
  normalGradient: 8.5,
  /** ژرفایِ واقعیِ چین روی هندسه (متر) — روشناییِ نقشه این را کامل می‌کند */
  foldDepth: 0.02,
  /** دامنهٔ پرز/راپِ مخمل روی صورتِ پارچه */
  nap: 0.05,
  napCells: 150,
  /** پهنای هستۀ تمام‌سیاه در بالا و پایین پرده (کسرِ ارتفاع؛ ۰٫۰۰۴ ≈ ۱٫۱
      سانتی‌متر). خواستۀ دورِ چهارمِ امیر: «خطِ مشکی محو بشه» ⇒ دیگر نوارِ
      ضخیمِ سیاه نداریم، فقط یک لبۀ خاموش که بلافاصله محو می‌شود */
  blackBand: 0.004,
  /** طولِ محوشدگی از آن لبه تا قرمزِ کامل (کسرِ ارتفاع؛ ۰٫۱۶ ≈ ۴۴ سانتی‌متر).
      بلند است تا گذار «حاله» باشد و لبه‌اش دیده نشود؛ بیرونِ این کسری
      `curtainShade` دقیقاً ۱ است، پس بدنۀ پرده همان قرمزِ سیراب است */
  blackFade: 0.16,
  /** نوارِ خاموشِ سرِ پرده کمی بلندتر از نوارِ پایینی است (سایۀ جعبۀ نورِ بالای
      سردر): ۰٫۹۴ ⇒ فاصلۀ مؤثرِ لبۀ بالا ۶٪ کوتاه‌تر حساب می‌شود */
  topBias: 0.94,
  /** رنگِ بدنۀ مخمل: قرمزِ سیراب (بازبینی: «قرمزش بیشتر می‌شد، نه فقط کم‌نور») */
  pileColor: [172, 30, 42],
  troughColor: [78, 16, 23],
  /** در گذارِ نوارِ سیاه، سبز و آبی زودتر از قرمز می‌میرند ⇒ حاشیه «قرمزِ
      سوخته» است، نه خاکستریِ بی‌رنگ: توانِ کانال قرمز (کم = دیرتر تیره می‌شود) */
  shadowRedHold: 0.55,
  /** و توانِ کانال‌های سبز/آبی (زیاد = زودتر به سیاه) */
  shadowCoolCrush: 1.7,
  /** بازتابِ مخمل: قله‌ها صاف‌تر (براق‌تر) و دره‌ها مات‌اند */
  roughCrest: 0.84,
  roughTrough: 0.975,
  /** اندازهٔ تکسچر؛ u = عرضِ پرده، v = ارتفاعِ پرده */
  textureSize: 512,
  /** جایِ سه پنجره روی نما و اندازهٔ پرده */
  windowXs: [-3.9, 0, 3.9],
  curtainWidth: 1.36,
  curtainHeight: 2.74,
  /** پرده جلوی شیشه آویزان است: فاصلهٔ قله از صفحهٔ شیشه و برآمدگیِ قاب */
  hangOffset: 0.03,
  /** فاز و مقیاسِ هر پنجره — سه پنجره نباید سه کپیِ هم‌رگه باشند */
  variants: [
    { phase: 0.0, scale: 1.0 },
    { phase: 0.37, scale: 0.92 },
    { phase: 0.71, scale: 1.07 },
  ],
} as const;

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
const mod = (n: number, m: number) => ((n % m) + m) % m;
const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
/**
 * مشتقِ اول و دوم در دو سرِ بازه هم صفر است ⇒ کنارِ مشکی نه «گوشهٔ» تیز
 * می‌ماند و نه «زانو»ی محسوس؛ همان چیزی که امیر «حالتِ محو مانند» می‌خواست.
 */
const smootherstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

function hash1D(i: number, seed: number): number {
  let h = (i * 374761393 + seed * 668265263 + 1013904223) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hash2D(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** نویز ۱D دوره‌ای روی [۰،۱): برای بی‌نظمیِ پهنای چین‌ها */
function noise1D(u: number, cells: number, seed: number): number {
  const p = Math.max(1, Math.round(cells));
  const x = u * p;
  const i = Math.floor(x);
  const t = x - i;
  const s = t * t * (3 - 2 * t);
  return hash1D(mod(i, p), seed) * (1 - s) + hash1D(mod(i + 1, p), seed) * s;
}

/** نویز ۲D دوره‌ای در u: پرزِ مخمل که در راستای پرده کشیده شده است */
function napNoise(u: number, v: number, cellsU: number, cellsV: number, seed: number): number {
  const pu = Math.max(1, Math.round(cellsU));
  const pv = Math.max(1, Math.round(cellsV));
  const x = u * pu;
  const y = v * pv;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const sx = smoothstep(x - ix);
  const sy = smoothstep(y - iy);
  const xa = mod(ix, pu);
  const xb = mod(ix + 1, pu);
  const ya = mod(iy, pv);
  const yb = mod(iy + 1, pv);
  const a = hash2D(xa, ya, seed);
  const b = hash2D(xb, ya, seed);
  const c = hash2D(xa, yb, seed);
  const d = hash2D(xb, yb, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

/**
 * روشنایی/جهتِ صورتِ پارچه در جهتِ افقی: ۱ بر قلهٔ چین (رو به بیننده) و ۰ در
 * درۀ چین (فرورفته و در سایه). دوره‌ای در u است ⇒ جابه‌جاییِ UVِ هر پنجره
 * هیچ درزی نمی‌سازد.
 */
function pleatPhase(u: number, v: number): number {
  const y = clamp(v, 0, 1);
  const meander = (noise1D(y, CURTAIN.meanderCells, 17) - 0.5) * CURTAIN.meander;
  const p = mod(u + meander * 0.3, 1);
  const wobble = (noise1D(p, CURTAIN.wobbleCells, 7) - 0.5) * CURTAIN.pleatWobble;
  return mod(p * CURTAIN.pleats + wobble + meander, 1);
}

/**
 * چین‌های درشت. تنها همین قسمت روی مشِ هندسه می‌نشیند: ریزچین‌ها روی ۹۶ سگمنت
 * حل نمی‌شوند و آلیاسینگ در سیلوئِ پرده می‌سازند.
 */
export function curtainPleat(u: number, v = 0.5): number {
  const ph = pleatPhase(u, v);
  // |sin| نه sin: توانِ کسری از عددِ منفی NaN می‌دهد و کل مشِ پرده را خراب می‌کند
  return Math.pow(Math.abs(Math.sin(ph * Math.PI)), CURTAIN.crestSharp);
}

export function curtainFacing(u: number, v = 0.5): number {
  const ph = pleatPhase(u, v);
  const main = curtainPleat(u, v);
  const micro =
    Math.pow(Math.abs(Math.sin(ph * Math.PI * CURTAIN.microPleats)), 0.9) * CURTAIN.microAmount;
  const nap = (noise1D(u, CURTAIN.napCells, 61) - 0.5) * CURTAIN.nap * (0.3 + main * 0.7);
  return clamp(main * (0.9 + micro) + micro * 0.35 + nap, 0, 1);
}

/** ارتفاعِ نسبیِ پارچه (۱ قله → ۰ دره)؛ همان عددی که مشِ پرده جابه‌جا می‌شود */
export function curtainHeight01(u: number, v = 0.5): number {
  return 0.12 + 0.88 * curtainPleat(u, v);
}

/** جابه‌جاییِ رأسِ پرده بر حسبِ متر (هرگز مثبت نیست ⇒ پرده از شیشه بیرون نمی‌زند) */
export function curtainDepth(u: number, v = 0.5): number {
  return -CURTAIN.foldDepth * (1 - curtainHeight01(u, v));
}

/**
 * envelopeٔ عمودی: بدنۀ پرده ۱ است (قرمزِ سیراب، بدون هیچ تاریکیِ جهانی) و فقط
 * داخلِ `blackBand` به صفر می‌رسد؛ بین این دو، گذارِ `smootherstep` روی
 * `blackFade` نشسته ⇒ سیاه در دو سر «محو» می‌شود و هیچ خطِ اتصالی بین مشکی و
 * قرمز نمی‌ماند (خواستۀ دورِ چهارمِ امیر).
 */
export function curtainShade(v: number): number {
  const y = clamp(v, 0, 1);
  // فاصلۀ مؤثر تا نزدیک‌ترین لبه (topBias نوارِ بالا را کمی بلندتر می‌کند؛ داخلِ
  // تابع نوشته می‌شود نه به‌صورت ضربِ پلکانی، وگرنه وسطِ پرده «خط» می‌افتد)
  const d = Math.min(y, (1 - y) * CURTAIN.topBias);
  const core = CURTAIN.blackBand;
  const fade = Math.max(core + 0.005, CURTAIN.blackFade);
  return smootherstep((d - core) / (fade - core));
}

export interface CurtainFabricMaps {
  readonly colorMap: THREE.DataTexture;
  readonly normalMap: THREE.DataTexture;
  readonly roughnessMap: THREE.DataTexture;
  /** نورِ گرمِ پشتِ پرده (چراغ‌های لابی از میانِ مخمل) */
  readonly glowMap: THREE.DataTexture;
  dispose: () => void;
}

function byte(v: number): number {
  return Math.round(clamp(v, 0, 255));
}

/**
 * چهار نقشه از یک میدان: رنگ، نورمل (از گرادیانِ همان ارتفاع)، زبری و نورِ
 * پشتِ پرده. همه‌جا `curtainFacing` و `curtainShade` خوانده می‌شوند، پس هیچ
 * اختلافی بین «چینِ دیده‌شده» و «چینِ لمس‌شده» نمی‌ماند.
 */
export function createCurtainFabricMaps(size: number = CURTAIN.textureSize): CurtainFabricMaps {
  const n = Math.max(64, Math.round(size));
  const pixels = n * n;
  const colorData = new Uint8Array(pixels * 4);
  const normalData = new Uint8Array(pixels * 4);
  const roughData = new Uint8Array(pixels * 4);
  const glowData = new Uint8Array(pixels * 4);

  // میدانِ ارتفاع: چین‌ها عمودی‌اند و فقط با مِآندرِ ملایم از ردیفِ ردیف فرق
  // می‌کنند، پس یک بار به ازای هر ردیف روی نوارِ u حساب می‌شود (نه هر پیکسل)
  const rowBands = 64;
  const heightRows = new Float32Array(rowBands * n);
  for (let band = 0; band < rowBands; band++) {
    const vBand = (band + 0.5) / rowBands;
    for (let px = 0; px < n; px++) heightRows[band * n + px] = 0.12 + 0.88 * curtainFacing(px / n, vBand);
  }

  const pile = CURTAIN.pileColor;
  const trough = CURTAIN.troughColor;

  for (let py = 0; py < n; py++) {
    const v = (py + 0.5) / n;
    const shade = curtainShade(v);
    // نورِ پشتِ پرده هم با همان نوار می‌میرد ⇒ نوارِ بالا/پایین واقعاً سیاه است
    // و بدنۀ پرده از درون می‌درخشد (بدون pedestal: آنجا «سوراخِ سیاه» می‌خواهیم)
    // اوجِ نور را بالا می‌گیریم ولی «پدستال» نمی‌دهیم: نوارِ دو سر باید کاملاً
    // خاموش بماند. ۰٫۸ (نه ۰٫۹۵) تا مخمل در engine صورتی/نئون نشود
    const glowBase = 0.8 * Math.pow(shade, 1.1);
    for (let px = 0; px < n; px++) {
      const u = px / n;
      const facing = curtainFacing(u, v);
      const idx = py * n + px;
      const off = idx * 4;

      // ------------------------------------------------ رنگِ مخمل
      // قله‌ها روشن و نرم‌اند، دره‌ها تقریباً سیاه؛ پرزِ پارچه در راستای چین
      const nap = napNoise(u, v, 3, 120, 9091) - 0.5;
      const napFine = hash2D(px * 2 + 1, py * 5 + 3, 313) - 0.5;
      const sheen = Math.pow(facing, 1.6);
      const k = clamp(0.3 + sheen * 0.78 + nap * 0.1, 0, 1);
      let r = trough[0] + (pile[0] - trough[0]) * k;
      let g = trough[1] + (pile[1] - trough[1]) * k;
      let b = trough[2] + (pile[2] - trough[2]) * k;
      // مخمل در سایه سردتر و در نورِ مایل گرم‌تر می‌شود
      const cool = 1 - facing;
      r *= 1 + nap * 0.16 + napFine * 0.05;
      g *= 1 - cool * 0.12 + nap * 0.14 + napFine * 0.05;
      b *= 1 - cool * 0.16 + nap * 0.12 + napFine * 0.05;
      // envelopeٔ عمودی: بدنۀ پرده دست‌نخورده و قرمز است، فقط نوارِ باریکِ
      // بالا/پایین سیاه می‌شود. کانال‌ها با توان‌های فرق می‌میرند تا گذار
      // «قرمزِ سوخته» باشد نه خاکستری — درسِ بازبینی قبلی: فقط نور را کم
      // کردیم و خودِ رنگ مُرد.
      const foldDim = 0.68 + 0.32 * facing;
      const rEnv = 0.02 + 0.98 * Math.pow(shade, CURTAIN.shadowRedHold);
      const cEnv = Math.pow(shade, CURTAIN.shadowCoolCrush);
      colorData[off] = byte(r * foldDim * rEnv);
      colorData[off + 1] = byte(g * foldDim * cEnv);
      colorData[off + 2] = byte(b * foldDim * (0.01 + 0.99 * cEnv));
      colorData[off + 3] = 255;

      // ------------------------------------------------ نورمل از همان ارتفاع
      const hrow = heightRows.subarray(Math.floor((py * rowBands) / n) * n, Math.floor((py * rowBands) / n) * n + n);
      const hl = hrow[mod(px - 1, n)];
      const hr = hrow[mod(px + 1, n)];
      // شیبِ افقیِ چین + پرزِ ریزِ عمودی، تا چین کاملاً خط‌کشِ بی‌نقص نماند
      const slope =
        ((hr - hl) * 0.5 * CURTAIN.normalGradient + nap * 0.22 + napFine * 0.1) *
        (0.35 + facing * 0.65);
      const slopeY =
        (napNoise(u, v + 1 / n, 3, 120, 9091) - napNoise(u, v - 1 / n, 3, 120, 9091)) * 0.9;
      const nx = -slope;
      const ny = slopeY;
      const inv = 1 / Math.hypot(nx, ny, 1);
      normalData[off] = byte((nx * inv * 0.5 + 0.5) * 255);
      normalData[off + 1] = byte((ny * inv * 0.5 + 0.5) * 255);
      normalData[off + 2] = byte((inv * 0.5 + 0.5) * 255);
      normalData[off + 3] = 255;

      // ------------------------------------------------ زبری (مخمل خشک و مات)
      const rough = clamp(
        CURTAIN.roughTrough - (CURTAIN.roughTrough - CURTAIN.roughCrest) * sheen + nap * 0.03,
        0.8,
        0.99,
      );
      const roughByte = byte(rough * 255);
      roughData[off] = roughByte;
      roughData[off + 1] = roughByte;
      roughData[off + 2] = roughByte;
      roughData[off + 3] = 255;

      // ------------------------------------------------ نورِ پشتِ پرده
      // مخمل نازک است: نورِ لابی از بدنهٔ پارچه رد می‌شود و از دره‌ها کمتر
      const glow = glowBase * (0.28 + 0.72 * Math.pow(facing, 0.7));
      const glowByte = byte(glow * 255);
      glowData[off] = glowByte;
      glowData[off + 1] = byte(glow * 190);
      glowData[off + 2] = byte(glow * 150);
      glowData[off + 3] = 255;
    }
  }

  const mkTex = (data: Uint8Array, srgb: boolean) => {
    const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
    // u دوره‌ای است (جابه‌جاییِ فازِ هر پنجره) و v نه (دو سرِ پرده محو می‌شوند)
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
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
  const roughnessMap = mkTex(roughData, false);
  const glowMap = mkTex(glowData, true);

  return {
    colorMap,
    normalMap,
    roughnessMap,
    glowMap,
    dispose() {
      colorMap.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
      glowMap.dispose();
    },
  };
}

/**
 * مشِ پرده: صفحه‌ای پر‌سِر‌تر در افق که رأس‌هایش با همان `curtainDepth` به
 * داخل رانده می‌شوند، پس چین‌ها سایه و لبهٔ واقعی دارند (نه فقط نورمل) و UVها
 * جابه‌جا/کشیده می‌شوند تا هر سه پنجره فاز و شمارۀ چینِ خودش را داشته باشد.
 */
export function buildCurtainGeometry(
  width: number = CURTAIN.curtainWidth,
  height: number = CURTAIN.curtainHeight,
  variant: { phase: number; scale: number } = CURTAIN.variants[0],
  segmentsX = 96,
): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(width, height, Math.max(8, Math.round(segmentsX)), 6);
  const position = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const u = (position.getX(i) / width + 0.5) * variant.scale + variant.phase;
    const v = position.getY(i) / height + 0.5;
    uv.setX(i, u);
    position.setZ(i, curtainDepth(u, v));
  }
  position.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
