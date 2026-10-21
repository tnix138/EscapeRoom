/**
 * horror-hud.ts — مدل خالص HUD ترس (فاز ۰۷، سمت UI — امیرعلی)
 * --------------------------------------------------------------------------
 * همان اصل معماری کات‌سین: هر حالت تصویری «فقط و فقط» تابعی خالص از
 * elapsedMs است (زمان سپری‌شده بر مبنای ساعت سرور). هیچ تایمر، هیچ state
 * محلی و هیچ تاریخچه‌ای در این فایل نیست؛ در نتیجه:
 *  - همهٔ بازیکنان یک اتاق دقیقاً یک لایهٔ ترس می‌بینند؛
 *  - Refresh وسط صحنه، HUD را از همان میلی‌ثانیه ادامه می‌دهد؛
 *  - کل مدل بدون مرورگر و بدون WebGL قابل تست است (tests/amirali).
 *
 * قواعد ایمنی و دسترس‌پذیری:
 *  - فلاش نوری حداکثر ۳ بار در هر ثانیه و فقط ۱۲۰ms در آغاز هر کیو؛
 *  - حالت «کم‌حرکت» (prefers-reduced-motion) لرزش و فلاش را کامل صفر می‌کند
 *    ولی متن پردهٔ جامپ‌اسکر باقی می‌ماند؛
 *  - هیچ پاسخ معمایی (رقم در، کد ردیف یا نماد بلیط) در متن‌ها نیست؛
 *  - زمان‌های کوبش و لوستر از `cutscene-timing` (علیرضا) خوانده می‌شوند تا
 *    تصویر، صدا و HUD میلی‌ثانیه‌ای قفل بمانند.
 */

import { CHANDELIER_FALL_AT_MS, SLAM_IMPACTS } from '../../cinema/cutscene-timing';
import { CUTSCENE_DURATION_MS } from '../narration/narration-track';

export type HorrorTone = 'calm' | 'uneasy' | 'terror';

export type JumpScareKind = 'startle' | 'shock' | 'slam' | 'blackout';

export interface JumpScareCue {
  /** شناسهٔ پایدار؛ با تغییر متن عوض نمی‌شود. */
  id: string;
  /** شروع کیو (شامل) بر حسب میلی‌ثانیه از آغاز کات‌سین. */
  atMs: number;
  /** طول پردهٔ جامپ‌اسکر (برای کیوهای بدون پرده: طول پالس لرزش). */
  durationMs: number;
  /** شدت ۰ تا ۱ — هم‌زمان روی ترس، لرزش و پالس اثر می‌گذارد. */
  intensity: number;
  /** متن کوتاه فارسی روی پرده؛ هرگز پاسخ معما نیست. */
  headline: string;
  /** یک جملهٔ توضیحی فارسی زیر عنوان. */
  subline: string;
  kind: JumpScareKind;
  /** پردهٔ سیاه با متن نشان داده شود؟ (فقط لحظه‌های بزرگ) */
  overlay: boolean;
  /** فلاش لحظه‌ای مجاز است؟ (با محدودیت ۳ بار در ثانیه) */
  flash: boolean;
}

/* ==========================================================================
 * ثابت‌های عمومی مدل
 * ========================================================================== */

/** HUD از یک دقیقهٔ آخر (پیدایش مرد سیاه‌پوش) دیده می‌شود. */
export const HORROR_WINDOW_START_MS = 35_000;

/** پنجرهٔ نمایش لایهٔ ترس؛ انتهای آن پایان کات‌سین ۷۴ ثانیه‌ای است. */
export const HORROR_WINDOW = {
  startMs: HORROR_WINDOW_START_MS,
  endMs: CUTSCENE_DURATION_MS,
} as const;

/** نرخ فروکش هر کیو در ترسِ پایه. */
export const FEAR_DECAY_MS = 5_200;

/** آستانه‌های حالت‌های HUD. */
export const FEAR_LEVELS = {
  uneasy: 0.32,
  terror: 0.64,
} as const;

/** ایمنی نور حساس (photosensitivity): حداکثر ۳ فلاش در هر ثانیه. */
export const MAX_FLASHES_PER_SECOND = 3;

/** طول هر فلاش (میلی‌ثانیه). */
export const FLASH_DURATION_MS = 120;

/** کمینهٔ فاصلهٔ دو فلاش (۱۰۰۰ / ۳ ≈ ۳۳۴ms). */
export const MIN_FLASH_GAP_MS = 340;

/** حداقل فاصلهٔ پرده‌های متنی؛ پرده‌ها هرگز روی هم نمی‌افتند. */
export const MIN_OVERLAY_GAP_MS = 400;

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** تبدیل رقم‌های لاتین به فارسی، بدون ICU. */
export function toPersianNumber(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

/** محدود کردن عدد به بازهٔ [0, 1]؛ ورودی غیر متناهی صفر می‌شود. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** زمان ورودی را پاک می‌کند: غیر متناهی و منفی → ۰. */
export function safeTime(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, ms);
}

function progressBetween(value: number, startMs: number, endMs: number): number {
  if (endMs <= startMs) return value >= endMs ? 1 : 0;
  return clamp01((value - startMs) / (endMs - startMs));
}

/* ==========================================================================
 * کیوهای جامپ‌اسکر — هم‌تراز با تایم‌لاین دقیق کات‌سین
 * ========================================================================== */

const SLAM_SURFACE_LABEL: Record<string, string> = {
  door: 'در',
  'left-wall': 'دیوار چپ',
  'right-wall': 'دیوار راست',
  floor: 'زمین',
  ceiling: 'سقف',
};

/** شش کوبش پیکر — زمان‌ها مستقیماً از تایم‌لاین علیرضا می‌آیند. */
function slamCues(): JumpScareCue[] {
  return SLAM_IMPACTS.map((impact, index) => ({
    id: `slam-${index + 1}`,
    atMs: impact.atMs,
    durationMs: 900,
    intensity: 0.82,
    headline: `پیکر به ${SLAM_SURFACE_LABEL[impact.surface] ?? 'سالن'} کوبیده می‌شود`,
    subline: 'سالن می‌لرزد و گرد و غبار از سقف فرو می‌ریزد.',
    kind: 'slam',
    overlay: false,
    flash: true,
  }));
}

/**
 * فهرست ثابت کیوها (به ترتیب زمان، بدون هم‌پوشانی پرده‌ها).
 * پردهٔ متنی فقط برای سه لحظهٔ بزرگ است تا صحنه بیش از حد پوشیده نشود.
 */
export const HORROR_CUES: readonly JumpScareCue[] = [
  {
    id: 'applause',
    atMs: 40_300,
    durationMs: 1_200,
    intensity: 0.42,
    headline: 'کف زدن از سایه',
    subline: 'مرد سیاه‌پوش پایین سن ایستاده است.',
    kind: 'startle',
    overlay: false,
    flash: false,
  },
  {
    id: 'hand-rejection',
    atMs: 49_600,
    durationMs: 1_600,
    intensity: 0.55,
    headline: 'دست مرد پس زده می‌شود',
    subline: 'برای یک لحظه همه‌چیز واژگون می‌شود.',
    kind: 'shock',
    overlay: true,
    flash: true,
  },
  {
    id: 'choke-lift',
    atMs: 56_000,
    durationMs: 1_800,
    intensity: 0.74,
    headline: 'پاهای بانو از زمین کنده می‌شود',
    subline: 'گلوی او از راه دور گرفته شده است.',
    kind: 'shock',
    overlay: true,
    flash: true,
  },
  ...slamCues(),
  {
    id: 'chandelier-fall',
    atMs: CHANDELIER_FALL_AT_MS,
    durationMs: 700,
    intensity: 0.88,
    headline: 'لوستر از سقف کنده می‌شود',
    subline: 'زنجیرها یکی‌یکی پاره می‌شوند.',
    kind: 'shock',
    overlay: false,
    flash: true,
  },
  {
    id: 'chandelier-shatter',
    atMs: CHANDELIER_FALL_AT_MS + 620,
    durationMs: 1_000,
    intensity: 0.94,
    headline: 'لوستر روی زمین خرد می‌شود',
    subline: 'جرقه‌ها در تاریکی سالن می‌پرند.',
    kind: 'shock',
    overlay: false,
    flash: true,
  },
  {
    id: 'vanish',
    atMs: 67_000,
    durationMs: 2_200,
    intensity: 1,
    headline: 'زن و مرد ناپدید می‌شوند',
    subline: 'سالن تاریک است و درها قفل مانده‌اند.',
    kind: 'blackout',
    overlay: true,
    flash: true,
  },
];

/* ==========================================================================
 * ترس پایه و ترس لحظه‌ای
 * ========================================================================== */

/** ترسِ زمینه‌ای صحنه؛ با نزدیک شدن به اوج بالا می‌رود و پس از کات‌سین فروکش می‌کند. */
export function baselineFear(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs)) return 0;
  const t = Math.max(0, elapsedMs);
  if (t >= CUTSCENE_DURATION_MS) return 0.12;
  if (t < HORROR_WINDOW_START_MS) return 0.06;
  if (t < 56_000) return 0.1 + 0.22 * progressBetween(t, HORROR_WINDOW_START_MS, 56_000);
  if (t < 67_000) return 0.44;
  return 0.72;
}

/**
 * ترس کل در لحظهٔ t: ترس زمینه + جمع پالس‌های فروکش‌کنندهٔ کیوهای گذشته.
 * خروجی همیشه در [0, 1] است.
 */
export function fearAt(elapsedMs: number, cues: readonly JumpScareCue[] = HORROR_CUES): number {
  if (!Number.isFinite(elapsedMs)) return 0;
  const t = Math.max(0, elapsedMs);
  let fear = baselineFear(t);
  for (const cue of cues) {
    if (!Number.isFinite(cue.atMs) || t < cue.atMs) continue;
    const age = t - cue.atMs;
    if (age > FEAR_DECAY_MS) continue;
    const decay = 1 - age / FEAR_DECAY_MS;
    fear += clamp01(cue.intensity) * 0.7 * decay * decay;
  }
  return clamp01(fear);
}

/** حالت HUD از سطح ترس. */
export function fearTone(level: number): HorrorTone {
  const fear = clamp01(level);
  if (fear >= FEAR_LEVELS.terror) return 'terror';
  if (fear >= FEAR_LEVELS.uneasy) return 'uneasy';
  return 'calm';
}

/** برچسب فارسی حالت؛ رنگ تنها حامل معنا نیست. */
export function toneLabel(tone: HorrorTone): string {
  if (tone === 'terror') return 'وحشت';
  if (tone === 'uneasy') return 'دلواپس';
  return 'آرام';
}

/** درصد ترس با رقم فارسی (برای صفحه‌خوان و متن جایگزین). */
export function fearPercentLabel(level: number): string {
  return `${toPersianNumber(Math.round(clamp01(level) * 100))}٪`;
}

/* ==========================================================================
 * پردهٔ جامپ‌اسکر
 * ========================================================================== */

export interface ActiveOverlay {
  cue: JumpScareCue;
  /** میلی‌ثانیهٔ سپری‌شده از شروع پرده. */
  elapsedMs: number;
  /** میلی‌ثانیهٔ باقی‌مانده تا بسته شدن پرده. */
  remainingMs: number;
  /** پیشرفت ۰ تا ۱ (برای نوار ظریف پایین متن). */
  progress: number;
}

/** پردهٔ متنی فعال در این لحظه؛ حداکثر یکی و همیشه آخرین شروع‌شده. */
export function overlayAt(
  elapsedMs: number,
  cues: readonly JumpScareCue[] = HORROR_CUES,
): ActiveOverlay | null {
  const t = safeTime(elapsedMs);
  let active: ActiveOverlay | null = null;
  for (const cue of cues) {
    if (!cue.overlay) continue;
    if (!Number.isFinite(cue.atMs) || !Number.isFinite(cue.durationMs)) continue;
    const duration = Math.max(0, cue.durationMs);
    const age = t - cue.atMs;
    if (age < 0 || age >= duration) continue;
    const candidate: ActiveOverlay = {
      cue,
      elapsedMs: age,
      remainingMs: duration - age,
      progress: duration > 0 ? clamp01(age / duration) : 1,
    };
    if (!active || candidate.cue.atMs > active.cue.atMs) active = candidate;
  }
  return active;
}

/* ==========================================================================
 * فلاش ایمن
 * ========================================================================== */

/**
 * فلاش‌های مجاز: فقط کیوهای فلاش‌دار، با فاصلهٔ کمینه و حداکثر
 * `MAX_FLASHES_PER_SECOND` در هر پنجرهٔ یک‌ثانیه‌ای.
 */
export function allowedFlashCues(
  cues: readonly JumpScareCue[] = HORROR_CUES,
): readonly JumpScareCue[] {
  const sorted = [...cues].filter((cue) => cue.flash).sort((a, b) => a.atMs - b.atMs);
  const allowed: JumpScareCue[] = [];
  for (const cue of sorted) {
    if (!Number.isFinite(cue.atMs)) continue;
    const last = allowed[allowed.length - 1];
    if (last && cue.atMs - last.atMs < MIN_FLASH_GAP_MS) continue;
    const inLastSecond = allowed.filter((entry) => cue.atMs - entry.atMs < 1_000).length;
    if (inLastSecond >= MAX_FLASHES_PER_SECOND) continue;
    allowed.push(cue);
  }
  return allowed;
}

/** شدت فلاش در لحظهٔ t (۰ یعنی فلاشی نیست)؛ ورودی کم‌حرکت را جدا کنترل می‌کند. */
export function flashAt(
  elapsedMs: number,
  cues: readonly JumpScareCue[] = HORROR_CUES,
): number {
  const t = safeTime(elapsedMs);
  let intensity = 0;
  for (const cue of allowedFlashCues(cues)) {
    const age = t - cue.atMs;
    if (age < 0 || age >= FLASH_DURATION_MS) continue;
    intensity = Math.max(intensity, clamp01(cue.intensity));
  }
  return intensity;
}

/** شمارش فلاش‌ها در بازهٔ [startMs, endMs) برای تست ایمنی نور. */
export function flashCountBetween(
  startMs: number,
  endMs: number,
  cues: readonly JumpScareCue[] = HORROR_CUES,
): number {
  const start = safeTime(startMs);
  const end = Math.max(start, safeTime(endMs));
  return allowedFlashCues(cues).filter((cue) => cue.atMs >= start && cue.atMs < end).length;
}

/* ==========================================================================
 * لرزش، پالس و خروجی کامل HUD
 * ========================================================================== */

export interface HorrorOptions {
  cues?: readonly JumpScareCue[];
  /** حالت کم‌حرکت: لرزش و فلاش صفر، متن‌ها می‌مانند. */
  reducedMotion?: boolean;
  /** مقیاس لرزش ۰ تا ۱ (برای هماهنگی با شدت صحنه). */
  shakeScale?: number;
}

export interface HorrorEffects {
  visible: boolean;
  tone: HorrorTone;
  toneLabel: string;
  fear: number;
  fearPercentLabel: string;
  /** جابه‌جایی لایهٔ تزئینی (پیکسل)؛ در حالت کم‌حرکت صفر. */
  shakePx: number;
  /** شفافیت پالس قرمز. */
  pulseOpacity: number;
  /** شفافیت مه تیرهٔ گوشه‌ها. */
  vignetteOpacity: number;
  /** شفافیت دانهٔ فیلم. */
  grainOpacity: number;
  /** شدت فلاش لحظه‌ای (۰ یعنی خاموش). */
  flashIntensity: number;
  overlay: ActiveOverlay | null;
}

/** پنجرهٔ نمایش لایهٔ ترس: از ۳۵ ثانیه تا پایان کات‌سین ۷۴ ثانیه‌ای. */
export function visibleAt(elapsedMs: number): boolean {
  const t = safeTime(elapsedMs);
  return t >= HORROR_WINDOW.startMs && t <= HORROR_WINDOW.endMs;
}

/** لرزش لایه در لحظهٔ t؛ در حالت کم‌حرکت همیشه صفر. */
export function shakePxAt(elapsedMs: number, options: HorrorOptions = {}): number {
  if (options.reducedMotion) return 0;
  if (!Number.isFinite(elapsedMs)) return 0;
  const t = Math.max(0, elapsedMs);
  const cues = options.cues ?? HORROR_CUES;
  const scale = clamp01(options.shakeScale ?? 1);
  if (scale === 0) return 0;
  let impulse = 0;
  for (const cue of cues) {
    const age = t - cue.atMs;
    if (age < 0 || age > 450) continue;
    impulse = Math.max(impulse, clamp01(cue.intensity) * 4 * (1 - age / 450));
  }
  const amplitude = 0.4 + fearAt(t, cues) * 2.2 + impulse;
  return Math.min(8, amplitude * scale);
}

/** خروجی کامل و قابل‌رندر HUD در یک لحظه. */
export function effectsAt(elapsedMs: number, options: HorrorOptions = {}): HorrorEffects {
  const t = safeTime(elapsedMs);
  const cues = options.cues ?? HORROR_CUES;
  const fear = fearAt(t, cues);
  const tone = fearTone(fear);
  const reduced = options.reducedMotion === true;
  return {
    visible: visibleAt(t),
    tone,
    toneLabel: toneLabel(tone),
    fear,
    fearPercentLabel: fearPercentLabel(fear),
    shakePx: shakePxAt(t, options),
    pulseOpacity: clamp01(0.08 + fear * 0.42),
    vignetteOpacity: clamp01(0.16 + fear * 0.6),
    grainOpacity: clamp01(0.05 + fear * 0.22),
    flashIntensity: reduced ? 0 : flashAt(t, cues),
    overlay: overlayAt(t, cues),
  };
}

/** یک جملهٔ کوتاه فارسی برای اعلام تغییر حالت به صفحه‌خوان. */
export function describeFearState(effects: HorrorEffects): string {
  if (effects.tone === 'terror') return 'وحشت — ضربان قلب تندتر شده است.';
  if (effects.tone === 'uneasy') return 'دلواپسی — سایه‌ها نزدیک‌تر شده‌اند.';
  return 'آرامش نسبی — سالن نفس می‌کشد.';
}
