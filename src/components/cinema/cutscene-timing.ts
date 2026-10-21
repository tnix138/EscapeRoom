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
 * موج ۲ ثانیه‌های ۰ تا ۴۰ (دربان، ورود و نشستن، اجرای اپرا) و موج ۳ ثانیه‌های
 * ۴۰ تا ۷۴ (نیمه وحشت: نزدیک شدن مرد، پس زدن دست، واژگونی، عقب راندن پلیرها،
 * کوبش‌ها، سقوط لوستر و غیب شدن) را پوشش می‌دهد؛ لحظه‌های دقیق کوبش (SLAM_IMPACTS)
 * و سقوط لوستر از همین فایل خوانده می‌شوند تا صدا و تصویر میلی‌ثانیه‌ای قفل شوند.
 */

import { DOOR_CUTSCENE_DURATION_MS } from '../../contracts/types';
import type { SlamSurface } from '../../audio/theater-audio-engine';

/** پاک کردن غبار اعشاری (مثل -0 یا sin(π)≈1e-19) تا مقادیر «صفر واقعی» تمیز برگردند */
function zeroIfTiny(value: number): number {
  return Math.abs(value) < 1e-9 ? 0 : value;
}

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

  /* ---------------- فیلدهای نیمه وحشت موج ۳ (۴۰ تا ۷۴ ثانیه) ---------------- */

  /** انرژی اجرای شاد (۱ یعنی رقص و نور ملایم؛ با واژگونی در ۵۰ ثانیه به ۰ فرو می‌ریزد) */
  danceEnergy: number;
  /** نزدیک شدن مرد از سایه چپ به پایین سِن (۴۰ تا ۴۶ ثانیه) */
  manApproachProgress: number;
  /** پنجره فعال دست زدن مرد (حدود ۴۰.۳ تا ۴۴ ثانیه هم‌فاز با افکت صوتی) */
  manClapEnvelope: number;
  /** باز و بسته شدن دست‌های مرد هنگام دست زدن (۰ تا حدود ۳۰ درجه) */
  manClapPhaseDeg: number;
  /** دراز شدن دست مرد به سوی زن برای بردن او (۴۵.۵ تا ۴۸.۵ ثانیه) */
  manHandExtendProgress: number;
  /** پس زده شدن دست مرد توسط زن (از HAND_REJECTION_AT_MS) */
  handRejectionProgress: number;
  /** باز بودن دهان زن هنگام آواز اپرا در بازه [0,1] (۴۶ تا لحظه پس زدن دست) */
  womanMouthOpen: number;
  /** واژگونی نور و فضا: قرمز تیره و تاریک شدن (۵۰ تا ۵۱.۵ ثانیه، سریع) */
  inversionProgress: number;
  /** کثیف و پوسیده شدن تدریجی دکور صحنه و سالن (۵۰ تا ۵۴.۵ ثانیه) */
  stageGrimeProgress: number;
  /** ترسیدن زن پس از واژگونی (لرزش و چهره وحشت) */
  womanFearProgress: number;
  /** چرخش نگاه مرد به سمت پلیرها (از ۵۲.۸ ثانیه) */
  manGlareProgress: number;
  /** پالس عقب رانده شدن همه پلیرها روی صندلی (۵۳ تا ۵۶ ثانیه؛ اوج در میانه) */
  playerPushPulse: number;
  /** بلند شدن زن از گلو در هوا (۵۶ تا ۵۷.۲ ثانیه) */
  chokeLiftProgress: number;
  /** لرزش افقی دوربین سالن (پیکسل) — هنگام کوبش‌ها تقویت می‌شود */
  cameraShakeX: number;
  /** لرزش عمودی دوربین سالن (پیکسل) */
  cameraShakeY: number;
  /** کج شدن تابلوهای دیوارهای چپ و راست بر اثر کوبش‌ها (از ۵۷.۸ ثانیه) */
  paintingsTiltProgress: number;
  /** سقوط شتاب‌دار لوستر از سقف (از CHANDELIER_FALL_AT_MS) */
  chandelierFallProgress: number;
  /** خرد شدن لوستر روی زمین پس از برخورد */
  chandelierShatteredProgress: number;
  /** غیب شدن ناگهانی زن و مرد (۶۷ تا ۶۷.۷ ثانیه) */
  vanishProgress: number;
  /** خاموشی لحظه‌ای سالن هنگام غیب شدن (پالس ۶۶.۸ تا ۶۸.۶ ثانیه) */
  blackoutPulse: number;
  /** تاریکی و ویرانی ماندگار پایانی تا شروع مجدد بازی در سالن (از ۶۷ ثانیه) */
  finalDarknessProgress: number;
}

export function getAuditoriumTimeline(elapsedMs: number): AuditoriumTimelineState {
  const t = Math.max(DOOR_CUTSCENE_DURATION_MS, elapsedMs);
  const dancerReveal = easeOutCubic(progressBetween(t, 26_000, 29_500));
  const houseDimProgress = progressBetween(t, 15_000, 21_000);

  /* ---- نیمه وحشت موج ۳: همه مقادیر همچنان فقط تابع t هستند ---- */
  const inversionProgress = easeOutCubic(progressBetween(t, 50_000, 51_500));
  const danceEnergy = 1 - inversionProgress;
  const playerPushPulse = zeroIfTiny(
    Math.pow(Math.sin(progressBetween(t, 53_000, 56_000) * Math.PI), 1.2),
  );
  const shakeEnvelope =
    progressBetween(t, 56_000, 56_600) * (1 - progressBetween(t, 66_200, 67_200));
  const shakeAmplitude = playerPushPulse * 2.5 + shakeEnvelope * (5 + impactShakeBoost(t));
  const chandelierFallRaw = progressBetween(t, CHANDELIER_FALL_AT_MS, CHANDELIER_FALL_AT_MS + 700);
  const clapEnvelope =
    progressBetween(t, 40_000, 40_500) * (1 - progressBetween(t, 43_800, 44_500));
  const singEnvelope =
    progressBetween(t, 46_000, 46_800) *
    (1 - progressBetween(t, HAND_REJECTION_AT_MS - 200, HAND_REJECTION_AT_MS + 400));

  return {
    entryProgress: easeInOutCubic(progressBetween(t, 11_000, 17_000)),
    seatedProgress: easeInOutCubic(progressBetween(t, 16_000, 21_000)),
    houseDimProgress,
    chandelierGlow: 0.9 - 0.55 * houseDimProgress,
    spotlightsProgress: progressBetween(t, 21_000, 25_500),
    curtainOpenProgress: easeInOutCubic(progressBetween(t, 24_000, 31_000)),
    stageGlowProgress: progressBetween(t, 23_500, 31_000),
    dancerReveal,
    dancerTravelX: zeroIfTiny(Math.sin((t - 26_000) * 0.00045) * dancerReveal * danceEnergy),
    dancerSwayDeg: Math.sin(t * 0.0021) * 4 * danceEnergy,
    dancerArmDeg: Math.sin(t * 0.0016) * 28 * danceEnergy,
    dancerSkirtFlare: 1 + 0.09 * Math.sin(t * 0.0032) * danceEnergy,
    dancerBob: 0.5 + 0.5 * Math.sin(t * 0.004) * danceEnergy,
    darkManReveal: easeOutCubic(progressBetween(t, 31_000, 36_000)),
    darkManBreath: 0.5 + 0.5 * Math.sin(t * 0.0009),
    darkManHeadTiltDeg: -6 + Math.sin(t * 0.0005) * 2,
    chandelierSwayDeg: Math.sin(t * 0.0006) * 1.6,

    danceEnergy,
    manApproachProgress: easeInOutCubic(progressBetween(t, 40_000, 46_000)),
    manClapEnvelope: clapEnvelope,
    manClapPhaseDeg:
      clapEnvelope * (0.5 + 0.5 * Math.sin((t - 40_300) * ((2 * Math.PI) / 950))) * 30,
    manHandExtendProgress: easeInOutCubic(progressBetween(t, 45_500, 48_500)),
    handRejectionProgress: easeOutCubic(
      progressBetween(t, HAND_REJECTION_AT_MS, HAND_REJECTION_AT_MS + 500),
    ),
    womanMouthOpen: singEnvelope * (0.55 + 0.45 * Math.sin(t * 0.006)),
    inversionProgress,
    stageGrimeProgress: progressBetween(t, 50_000, 54_500),
    womanFearProgress: easeOutCubic(progressBetween(t, 50_200, 53_000)),
    manGlareProgress: easeOutCubic(progressBetween(t, 52_800, 53_500)),
    playerPushPulse,
    chokeLiftProgress: easeOutCubic(progressBetween(t, 56_000, 57_200)),
    cameraShakeX: zeroIfTiny(Math.sin(t * 0.105) * shakeAmplitude),
    cameraShakeY: zeroIfTiny(Math.cos(t * 0.132) * shakeAmplitude * 0.62),
    paintingsTiltProgress: easeOutCubic(progressBetween(t, 57_800, 65_000)),
    chandelierFallProgress: chandelierFallRaw * chandelierFallRaw,
    chandelierShatteredProgress: easeOutCubic(
      progressBetween(t, CHANDELIER_FALL_AT_MS + 700, CHANDELIER_FALL_AT_MS + 1_300),
    ),
    vanishProgress: easeOutCubic(progressBetween(t, 67_000, 67_700)),
    blackoutPulse: Math.sin(progressBetween(t, 66_800, 68_600) * Math.PI),
    finalDarknessProgress: progressBetween(t, 67_000, 69_500),
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

/* ====================================================================================
 * نیمه وحشت موج ۳ — لحظه‌های دقیق برخورد و مسیر پرواز زن در سالن (۵۶ تا ۶۷ ثانیه)
 * این ثابت‌ها مرجع واحد قفل شدن صدا (playBodySlam/playChandelierFall) و تصویرند.
 * ==================================================================================== */

/** فریم دقیق پس زدن دست مرد توسط زن (محرک صوتی playHandRejection) */
export const HAND_REJECTION_AT_MS = 49_600;

/** لحظه شروع سقوط لوستر (صدای شکستن ۶۲۰ms بعد در موتور صدا زمان‌بندی داخلی دارد) */
export const CHANDELIER_FALL_AT_MS = 65_500;

/** توالی کوبیده شدن زن به سطوح سالن به ترتیب سناریو: در ← دیوارها ← زمین ← سقف ← زمین */
export const SLAM_IMPACTS: ReadonlyArray<{ atMs: number; surface: SlamSurface }> = [
  { atMs: 57_800, surface: 'door' },
  { atMs: 59_200, surface: 'left-wall' },
  { atMs: 60_600, surface: 'right-wall' },
  { atMs: 62_000, surface: 'floor' },
  { atMs: 63_400, surface: 'ceiling' },
  { atMs: 64_800, surface: 'floor' },
];

/** ژست لحظه‌ای زن هنگام پرتاب در سالن (مختصات درصدی نسبت به کل پانورامای سالن) */
export interface VictimPose {
  /** موقعیت افقی مرکز بدن (درصد عرض پانوراما؛ ۵۰ یعنی مرکز سِن اصلی) */
  xPct: number;
  /** موقعیت عمودی مرکز بدن (درصد ارتفاع پانوراما؛ عدد کوچک‌تر یعنی بالاتر) */
  yPct: number;
  /** چرخش بدن (درجه) */
  rotateDeg: number;
  /** مقیاس بدن (نزدیکی به دوربین اول‌شخص) */
  scale: number;
}

const VICTIM_KEYFRAMES: ReadonlyArray<{ atMs: number } & VictimPose> = [
  { atMs: 56_000, xPct: 50, yPct: 56, rotateDeg: 0, scale: 1 },
  { atMs: 57_200, xPct: 50, yPct: 32, rotateDeg: -8, scale: 1 },
  { atMs: 57_800, xPct: 50, yPct: 44, rotateDeg: 7, scale: 0.8 },
  { atMs: 58_500, xPct: 50, yPct: 28, rotateDeg: -10, scale: 1 },
  { atMs: 59_200, xPct: 11, yPct: 38, rotateDeg: -68, scale: 1.06 },
  { atMs: 59_900, xPct: 50, yPct: 26, rotateDeg: 8, scale: 1 },
  { atMs: 60_600, xPct: 89, yPct: 38, rotateDeg: 68, scale: 1.06 },
  { atMs: 61_300, xPct: 50, yPct: 24, rotateDeg: -6, scale: 1 },
  { atMs: 62_000, xPct: 50, yPct: 74, rotateDeg: 82, scale: 1.12 },
  { atMs: 62_700, xPct: 50, yPct: 30, rotateDeg: 12, scale: 1 },
  { atMs: 63_400, xPct: 50, yPct: 9, rotateDeg: 168, scale: 0.98 },
  { atMs: 64_100, xPct: 50, yPct: 34, rotateDeg: -14, scale: 1 },
  { atMs: 64_800, xPct: 50, yPct: 76, rotateDeg: -80, scale: 1.12 },
  { atMs: 66_200, xPct: 50, yPct: 78, rotateDeg: -76, scale: 1.05 },
  { atMs: 67_000, xPct: 50, yPct: 78, rotateDeg: -76, scale: 1.05 },
];

/**
 * مسیر پرواز زن از روی کی‌فریم‌های کوبش — درونیابی نرم بین فریم‌های برخورد.
 * قبل از ۵۶ ثانیه ژست ایستاده وسط صحنه و بعد از ۶۷ ثانیه ژست افتاده نهایی برگردانده می‌شود.
 */
export function victimPoseAt(elapsedMs: number): VictimPose {
  const t = elapsedMs;
  const first = VICTIM_KEYFRAMES[0];
  const last = VICTIM_KEYFRAMES[VICTIM_KEYFRAMES.length - 1];
  if (t <= first.atMs) return { xPct: first.xPct, yPct: first.yPct, rotateDeg: first.rotateDeg, scale: first.scale };
  if (t >= last.atMs) return { xPct: last.xPct, yPct: last.yPct, rotateDeg: last.rotateDeg, scale: last.scale };
  for (let i = 1; i < VICTIM_KEYFRAMES.length; i++) {
    const b = VICTIM_KEYFRAMES[i];
    if (t <= b.atMs) {
      const a = VICTIM_KEYFRAMES[i - 1];
      const p = easeInOutCubic(progressBetween(t, a.atMs, b.atMs));
      return {
        xPct: a.xPct + (b.xPct - a.xPct) * p,
        yPct: a.yPct + (b.yPct - a.yPct) * p,
        rotateDeg: a.rotateDeg + (b.rotateDeg - a.rotateDeg) * p,
        scale: a.scale + (b.scale - a.scale) * p,
      };
    }
  }
  return { xPct: last.xPct, yPct: last.yPct, rotateDeg: last.rotateDeg, scale: last.scale };
}

/** تقویت لرزش دوربین دقیقاً روی لحظه‌های برخورد (پالس نمایی ۵۰۰ میلی‌ثانیه‌ای پس از هر کوبش) */
function impactShakeBoost(elapsedMs: number): number {
  let boost = 0;
  for (const impact of SLAM_IMPACTS) {
    const dt = elapsedMs - impact.atMs;
    if (dt >= 0 && dt <= 500) boost += (1 - dt / 500) * 5;
  }
  const chandelierDt = elapsedMs - (CHANDELIER_FALL_AT_MS + 620);
  if (chandelierDt >= 0 && chandelierDt <= 650) boost += (1 - chandelierDt / 650) * 6;
  return boost;
}
