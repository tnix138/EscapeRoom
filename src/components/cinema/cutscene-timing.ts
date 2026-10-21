/**
 * cutscene-timing.ts — قلب زمان‌بندی خالص کات‌سین‌های POV (موج ۲ علیرضا)
 * ------------------------------------------------------------------------------
 * اصل معماری: هر وضعیت تصویری کات‌سین «فقط و فقط» تابعی خالص از elapsedMs است
 * (زمان سپری‌شده بر مبنای ساعت سرور توحید — ARCHITECTURE.md §۳.۳).
 * هیچ تایمر یا state محلی در کامپوننت‌ها وجود ندارد؛ در نتیجه:
 *  - هر ۳ تا ۸ بازیکن دقیقاً یک فریم واحد را می‌بینند؛
 *  - Refresh وسط کات‌سین، صحنه را از همان میلی‌ثانیه ادامه می‌دهد؛
 *  - کل منطق زمان‌بندی بدون مرورگر، با تست واحد قابل‌اثبات است (tests/alireza).
 *
 * موج ۲ این فایل ثانیه‌های ۰ تا ۴۰ را پوشش می‌دهد؛ فیلدهای وحشت ثانیه ۴۰ تا ۷۴
 * در موج ۳ علیرضا به همین ساختار اضافه می‌شوند (مقادیر موج ۲ بعد از ثانیه ۴۰ ثابت و نگه داشته می‌شوند).
 */

import { DOOR_CUTSCENE_DURATION_MS } from '../../contracts/types';

/** محدود کردن عدد به بازه [0, 1] — ورودی نامعتبر 0 می‌شود */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** پیشرفت خطی بین دو لحظه از تایملاین: قبل از شروع 0، بعد از پایان 1 */
export function progressBetween(elapsedMs: number, startMs: number, endMs: number): number {
  if (endMs <= startMs) return elapsedMs >= endMs ? 1 : 0;
  return clamp01((elapsedMs - startMs) / (endMs - startMs));
}

/** نرم‌کردن سینمایی شروع/پایان حرکت */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** نرم‌کردن فقط انتهای حرکت (فرود آرام) */
export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

/** موج یک سر تکان دادن در یک پنجره زمانی: 0 ← عمق ← 0 */
function nodWave(elapsedMs: number, startMs: number, durationMs: number, depthDeg: number): number {
  const p = progressBetween(elapsedMs, startMs, startMs + durationMs);
  if (p <= 0 || p >= 1) return 0;
  return Math.sin(p * Math.PI) * depthDeg;
}

/* ====================================================================================
 * کات‌سین درب ورودی — 0 تا 11 ثانیه (UsherDoorCutsceneView)
 * ==================================================================================== */

export interface DoorTimelineState {
  /** باز شدن دریچه چشمی در (۱.۰ تا ۲.۰ ثانیه) */
  peepholeOpen: number;
  /** آزاد شدن قفل سنگین برنجی در (۱.۸ تا ۲.۶ ثانیه) */
  lockReleased: number;
  /** نیمه‌باز شدن اولیه در و پیدایش شکاف نور (۲.۰ تا ۴.۵ ثانیه) */
  doorCrack: number;
  /** شدت نور گرمی که از شکاف در به کوچه می‌ریزد (۲.۰ تا ۵.۰ ثانیه) */
  interiorLightSpill: number;
  /** ظاهر شدن دربان در شکاف در (۲.۸ تا ۴.۸ ثانیه) */
  usherReveal: number;
  /** زاویه سر تکان دادن دربان (سلام در ۴.۸s و تشکر عمیق هنگام تحویل بلیط در ۸.۶s) */
  usherNodDeg: number;
  /** سوسو زدن فانوس دربان (مقدار پیوسته در بازه [0,1]) */
  lanternFlicker: number;
  /** جلو آمدن دست اول‌شخص بازیکن با بلیط‌ها (۵.۸ تا ۸.۰ ثانیه، نرم‌شده) */
  handExtend: number;
  /** انتقال بلیط‌ها از دست بازیکن به دست دربان (۸.۰ تا ۹.۰ ثانیه؛ ۱ یعنی بلیط پیش دربان است) */
  ticketHandover: number;
  /** کنار رفتن دربان از آستانه در (۸.۸ تا ۱۰.۲ ثانیه، نرم‌شده) */
  usherStepAside: number;
  /** باز شدن کامل هر دو لنگه در (۹.۰ تا ۱۰.۹ ثانیه، نرم‌شده) */
  doorsFullOpen: number;
  /** حرکت آرام دوربین به سمت داخل سالن در پایان سکانس در (۹.۲ تا ۱۱ ثانیه) */
  cameraPush: number;
}

export function getDoorTimeline(elapsedMs: number): DoorTimelineState {
  const t = Math.max(0, Math.min(elapsedMs, DOOR_CUTSCENE_DURATION_MS));
  return {
    peepholeOpen: progressBetween(t, 1_000, 2_000),
    lockReleased: progressBetween(t, 1_800, 2_600),
    doorCrack: easeOutCubic(progressBetween(t, 2_000, 4_500)),
    interiorLightSpill: progressBetween(t, 2_000, 5_000),
    usherReveal: easeOutCubic(progressBetween(t, 2_800, 4_800)),
    usherNodDeg:
      nodWave(t, 4_800, 1_200, 7) + nodWave(t, 8_600, 1_300, 12),
    lanternFlicker: clamp01(
      0.78 + 0.22 * (0.5 + 0.5 * Math.sin(t / 110) * Math.sin(t / 47)),
    ),
    handExtend: easeInOutCubic(progressBetween(t, 5_800, 8_000)),
    ticketHandover: easeInOutCubic(progressBetween(t, 8_000, 9_000)),
    usherStepAside: easeInOutCubic(progressBetween(t, 8_800, 10_200)),
    doorsFullOpen: easeInOutCubic(progressBetween(t, 9_000, 10_900)),
    cameraPush: easeInOutCubic(progressBetween(t, 9_200, DOOR_CUTSCENE_DURATION_MS)),
  };
}

/* ====================================================================================
 * کات‌سین سالن تئاتر — نیمه اول موج ۲: 11 تا 40 ثانیه (AuditoriumPerformanceView)
 * (برای elapsedMs بزرگ‌تر از ۴۰ ثانیه، مقادیر روی وضعیت «اجرای در حال پخش» نگه داشته می‌شوند تا موج ۳)
 * ==================================================================================== */

export interface AuditoriumTimelineState {
  /** ورود دوربین از درگاه به سمت راهروی صندلی‌ها (۱۱ تا ۱۷ ثانیه) */
  entryProgress: number;
  /** پایین آمدن دوربین تا ارتفاع نشسته روی صندلی خود بازیکن (۱۶ تا ۲۱ ثانیه) */
  seatedProgress: number;
  /** تاریک شدن نور عمومی سالن پیش از شروع نمایش (۱۵ تا ۲۱ ثانیه) */
  houseDimProgress: number;
  /** شدت نور لوستر کریستالی (با تاریک شدن سالن کم‌سو می‌شود ولی خاموش نه) */
  chandelierGlow: number;
  /** تابش نورهای موضعی ضعیف روی چین‌های پرده‌های قرمز (۲۱ تا ۲۵.۵ ثانیه) */
  spotlightsProgress: number;
  /** باز شدن پرده سِن اصلی (۲۴ تا ۳۱ ثانیه، نرم‌شده) */
  curtainOpenProgress: number;
  /** رشد نور گرم صحنه پس از باز شدن پرده (۲۳.۵ تا ۳۱ ثانیه) */
  stageGlowProgress: number;
  /** ظاهر شدن بانوی رقصنده وسط صحنه (۲۶ تا ۲۹.۵ ثانیه) */
  dancerReveal: number;
  /** رفت‌وآمد رقصنده روی عرض صحنه در بازه [-1, +1] (تابعی پیوسته از زمان) */
  dancerTravelX: number;
  /** تاب خوردن بدن رقصنده (درجه) */
  dancerSwayDeg: number;
  /** حرکت دست‌های رقصنده (درجه؛ برای دو دست قرینه استفاده می‌شود) */
  dancerArmDeg: number;
  /** وزش دامن رقصنده (ضریب مقیاس افقی؛ ۱ یعنی حالت خنثی) */
  dancerSkirtFlare: number;
  /** بالا/پایین ملایم قدم‌های رقص در بازه [0,1] */
  dancerBob: number;
  /** پیدایش مرد بلندقد سیاه‌پوش در سایه سمت چپ صحنه (۳۱ تا ۳۶ ثانیه) */
  darkManReveal: number;
  /** نفس کشیدن سنگین و آرام مرد سیاه‌پوش در بازه [0,1] */
  darkManBreath: number;
  /** خم شدن سر مرد به سمت رقصنده (درجه؛ منفی یعنی خم به سمت راست صحنه) */
  darkManHeadTiltDeg: number;
  /** تاب خوردن بسیار ملایم لوستر (درجه) */
  chandelierSwayDeg: number;
}

export function getAuditoriumTimeline(elapsedMs: number): AuditoriumTimelineState {
  const t = Math.max(DOOR_CUTSCENE_DURATION_MS, elapsedMs);
  const dancerReveal = easeOutCubic(progressBetween(t, 26_000, 29_500));
  const houseDimProgress = progressBetween(t, 15_000, 21_000);
  return {
    entryProgress: easeInOutCubic(progressBetween(t, 11_000, 17_000)),
    seatedProgress: easeInOutCubic(progressBetween(t, 16_000, 21_000)),
    houseDimProgress,
    chandelierGlow: 0.9 - 0.55 * houseDimProgress,
    spotlightsProgress: progressBetween(t, 21_000, 25_500),
    curtainOpenProgress: easeInOutCubic(progressBetween(t, 24_000, 31_000)),
    stageGlowProgress: progressBetween(t, 23_500, 31_000),
    dancerReveal,
    dancerTravelX: Math.sin((t - 26_000) * 0.00045) * dancerReveal,
    dancerSwayDeg: Math.sin(t * 0.0021) * 4,
    dancerArmDeg: Math.sin(t * 0.0016) * 28,
    dancerSkirtFlare: 1 + 0.09 * Math.sin(t * 0.0032),
    dancerBob: 0.5 + 0.5 * Math.sin(t * 0.004),
    darkManReveal: easeOutCubic(progressBetween(t, 31_000, 36_000)),
    darkManBreath: 0.5 + 0.5 * Math.sin(t * 0.0009),
    darkManHeadTiltDeg: -6 + Math.sin(t * 0.0005) * 2,
    chandelierSwayDeg: Math.sin(t * 0.0006) * 1.6,
  };
}

/**
 * نشستن پلکانی هر هم‌تیمی روی صندلی خودش (شروع از ۱۱.۸ ثانیه + ۶۵۰ms به ازای هر صندلی).
 * فقط پلیرهای اتاق در سالن‌اند و بقیه صندلی‌ها خالی — TASKS-ALIREZA.md موج ۲ بند ۲.
 */
export function teammateSettleProgress(seatIndex: number, elapsedMs: number): number {
  const start = 11_800 + Math.max(0, seatIndex) * 650;
  return easeOutCubic(progressBetween(elapsedMs, start, start + 2_200));
}
