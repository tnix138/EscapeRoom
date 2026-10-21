/**
 * narration-track.ts — خط روایتِ زمان‌بندی‌شدهٔ تماشاخانه (موج ۸)
 * --------------------------------------------------------------------------
 * متن فارسی هر لحظه از کات‌سین، به‌صورت دادهٔ خالص و قابل‌تست.
 *
 * قواعد این فایل:
 *  - هر کات به بازهٔ [startMs, endMs) تعلق دارد و بازه‌ها بدون شکاف و بدون هم‌پوشانی‌اند.
 *  - هیچ پاسخ معمایی (رقم در، نماد بلیط، کد ردیف) در متن‌ها نیست.
 *  - زمان‌ها با ثابت‌های `cutscene-timing` (علیرضا) هم‌ترازند؛ تست موج ۸ این
 *    هم‌ترازی را تضمین می‌کند تا صدا و زیرنویس از هم جدا نشوند.
 */

export type NarrationTrackId = 'cutscene' | 'invitation';

export interface NarrationCue {
  /** شناسهٔ پایدار؛ با تغییر متن عوض نمی‌شود. */
  id: string;
  /** شروع بازه (شامل) بر حسب میلی‌ثانیه. */
  startMs: number;
  /** پایان بازه (شامل نیست). */
  endMs: number;
  /** فصل روایت؛ برای گروه‌بندی و برچسب. */
  chapter: 'door' | 'hall' | 'invitation';
  /** گوینده (همیشه راوی/صحنه است؛ هرگز «تو»). */
  speaker: string;
  /** متن فارسی روی صفحه و برای صفحه‌خوان. */
  text: string;
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianNumber(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

/** زمان میلی‌ثانیه به «m:ss» فارسی؛ ورودی نامعتبر ۰:۰۰ می‌شود. */
export function formatClock(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0;
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  return `${toPersianNumber(minutes)}:${toPersianNumber(String(seconds).padStart(2, '0'))}`;
}

/* --------------------------------------------------------------------------
 * پیش‌درآمد دعوت‌نامه — ۱۶ ثانیه (مالکیت امیرعلی)
 * -------------------------------------------------------------------------- */

export const INVITATION_DURATION_MS = 16_000;

export const INVITATION_CUES: readonly NarrationCue[] = [
  {
    id: 'invitation-seal',
    startMs: 0,
    endMs: 4_000,
    chapter: 'invitation',
    speaker: 'راوی',
    text: 'پاکتی از جنس مخمل به دستتان می‌رسد؛ مُهر موم سرخ است.',
  },
  {
    id: 'invitation-card',
    startMs: 4_000,
    endMs: 11_000,
    chapter: 'invitation',
    speaker: 'راوی',
    text: 'دعوت‌نامهٔ امشب؛ اجرایی که تنها یک‌بار روی صحنه می‌رود.',
  },
  {
    id: 'invitation-tickets',
    startMs: 11_000,
    endMs: INVITATION_DURATION_MS,
    chapter: 'invitation',
    speaker: 'راوی',
    text: 'بلیط‌های شما آماده‌اند و صندلی‌تان رزرو شده است.',
  },
];

/* --------------------------------------------------------------------------
 * کات‌سین ۷۴ ثانیه‌ای — در ۰ تا ۱۱ ثانیه، سالن ۱۱ تا ۷۴ ثانیه
 * -------------------------------------------------------------------------- */

export const CUTSCENE_DURATION_MS = 74_000;
export const DOOR_PHASE_END_MS = 11_000;

export const CUTSCENE_CUES: readonly NarrationCue[] = [
  {
    id: 'door-arrival',
    startMs: 0,
    endMs: 3_000,
    chapter: 'door',
    speaker: 'راوی',
    text: 'شب است و درِ سنگینِ تماشاخانه پیش روی شماست؛ بلیط‌ها در دست.',
  },
  {
    id: 'door-peephole',
    startMs: 3_000,
    endMs: 6_000,
    chapter: 'door',
    speaker: 'راوی',
    text: 'دریچهٔ چشمی گشوده می‌شود؛ دربان با فانوس به شما نگاه می‌کند.',
  },
  {
    id: 'door-handover',
    startMs: 6_000,
    endMs: 9_000,
    chapter: 'door',
    speaker: 'راوی',
    text: 'بلیط‌ها را به دربان می‌دهید؛ مُهر برنجی روی آن‌ها می‌نشیند.',
  },
  {
    id: 'door-open',
    startMs: 9_000,
    endMs: DOOR_PHASE_END_MS,
    chapter: 'door',
    speaker: 'راوی',
    text: 'چفت می‌چرخد و نور گرمی از شکاف در به کوچه می‌ریزد.',
  },
  {
    id: 'hall-entry',
    startMs: 11_000,
    endMs: 17_000,
    chapter: 'hall',
    speaker: 'راوی',
    text: 'از آستانه می‌گذرید؛ راهروی صندلی‌های مخملی تا سن ادامه دارد.',
  },
  {
    id: 'hall-seated',
    startMs: 17_000,
    endMs: 21_000,
    chapter: 'hall',
    speaker: 'راوی',
    text: 'روی صندلی خودتان می‌نشینید؛ سالن تقریباً خالی است.',
  },
  {
    id: 'hall-dimming',
    startMs: 21_000,
    endMs: 26_000,
    chapter: 'hall',
    speaker: 'راوی',
    text: 'چراغ‌ها کم‌سو می‌شوند و نوری ملایم روی چین‌های پردهٔ سرخ می‌لغزد.',
  },
  {
    id: 'hall-curtain',
    startMs: 26_000,
    endMs: 31_000,
    chapter: 'hall',
    speaker: 'راوی',
    text: 'پرده کنار می‌رود؛ بانویی با لباس کلاسیک ایتالیایی روی صحنه است.',
  },
  {
    id: 'hall-shadow',
    startMs: 31_000,
    endMs: 36_000,
    chapter: 'hall',
    speaker: 'راوی',
    text: 'در سایهٔ سمت چپ صحنه چیزی تکان می‌خورد؛ نگاهتان را آرام به چپ ببرید.',
  },
  {
    id: 'hall-stranger',
    startMs: 36_000,
    endMs: 40_000,
    chapter: 'hall',
    speaker: 'راوی',
    text: 'مردی بلندقد و سیاه‌پوش در سایه ایستاده و محو رقص اوست.',
  },
  {
    id: 'hall-applause',
    startMs: 40_000,
    endMs: 46_000,
    chapter: 'hall',
    speaker: 'راوی',
    text: 'مرد از سایه بیرون می‌آید، پایین سن می‌ایستد و با لذتی مرموز دست می‌زند…',
  },
  {
    id: 'hall-hand',
    startMs: 46_000,
    endMs: 49_600,
    chapter: 'hall',
    speaker: 'راوی',
    text: 'دستش را به سوی بانو دراز می‌کند؛ اما او بی‌اعتنا می‌رقصد و آواز می‌خواند…',
  },
  {
    id: 'hall-inversion',
    startMs: 49_600,
    endMs: 53_000,
    chapter: 'hall',
    speaker: 'راوی',
    text: 'دست مرد پس زده می‌شود — و ناگهان همه‌چیز واژگون می‌شود!',
  },
  {
    id: 'hall-glare',
    startMs: 53_000,
    endMs: 56_000,
    chapter: 'hall',
    speaker: 'راوی',
    text: 'مرد برمی‌گردد و مستقیم به شما خیره می‌شود… موجی سهمگین شما را عقب می‌راند!',
  },
  {
    id: 'hall-slams',
    startMs: 56_000,
    endMs: 65_500,
    chapter: 'hall',
    speaker: 'راوی',
    text: 'گلوی زن از راه دور در هوا گرفته می‌شود و پیکرش به در و دیوار و زمین کوبیده می‌شود!',
  },
  {
    id: 'hall-chandelier',
    startMs: 65_500,
    endMs: 67_000,
    chapter: 'hall',
    speaker: 'راوی',
    text: 'سالن می‌لرزد، تابلوها کج می‌شوند و لوستر کریستالی از سقف کنده می‌شود…',
  },
  {
    id: 'hall-vanish',
    startMs: 67_000,
    endMs: 70_000,
    chapter: 'hall',
    speaker: 'راوی',
    text: 'هر دو غیب شده‌اند؛ سالن تاریک و ویران است و درها قفل مانده‌اند.',
  },
  {
    id: 'hall-handover-to-exploration',
    startMs: 70_000,
    endMs: CUTSCENE_DURATION_MS,
    chapter: 'hall',
    speaker: 'راوی',
    text: 'آهنگ ترسناک ادامه دارد… پردهٔ دوم آغاز می‌شود؛ از اینجا می‌توانید بگردید.',
  },
];

export const NARRATION_TRACKS: Record<NarrationTrackId, readonly NarrationCue[]> = {
  cutscene: CUTSCENE_CUES,
  invitation: INVITATION_CUES,
};

/**
 * کات فعال در لحظهٔ مشخص. بیرون از بازهٔ کل (منفی یا پس از پایان) null برمی‌گردد
 * تا لایهٔ زیرنویس بتواند بی‌متن بماند.
 */
export function cueAt(cues: readonly NarrationCue[], elapsedMs: number): NarrationCue | null {
  if (!Number.isFinite(elapsedMs)) return null;
  const t = elapsedMs;
  if (t < 0) return null;
  const last = cues[cues.length - 1];
  if (!last || t >= last.endMs) return null;
  for (const cue of cues) {
    if (t >= cue.startMs && t < cue.endMs) return cue;
  }
  return null;
}

export interface TrackSpan {
  startMs: number;
  endMs: number;
  firstId?: string;
  secondId?: string;
}

export interface TrackIssues {
  empty: boolean;
  unsorted: boolean;
  startsLate: boolean;
  gaps: TrackSpan[];
  overlaps: TrackSpan[];
  /** بازه‌ای که کلیدواژهٔ ممنوعه داشت (برای گارد محتوا). */
  forbidden: string[];
}

/** بازرسی خط روایت: ترتیب، شکاف، هم‌پوشانی و کلیدواژه‌های لو‌دهنده. */
export function inspectTrack(
  cues: readonly NarrationCue[],
  forbiddenPatterns: readonly RegExp[] = [],
): TrackIssues {
  const issues: TrackIssues = {
    empty: cues.length === 0,
    unsorted: false,
    startsLate: false,
    gaps: [],
    overlaps: [],
    forbidden: [],
  };
  if (cues.length === 0) return issues;

  if (cues[0].startMs !== 0) issues.startsLate = true;

  for (let index = 1; index < cues.length; index += 1) {
    const previous = cues[index - 1];
    const current = cues[index];
    if (current.startMs < previous.startMs) issues.unsorted = true;
    if (current.startMs > previous.endMs) {
      issues.gaps.push({ startMs: previous.endMs, endMs: current.startMs, firstId: previous.id, secondId: current.id });
    } else if (current.startMs < previous.endMs) {
      issues.overlaps.push({ startMs: current.startMs, endMs: previous.endMs, firstId: previous.id, secondId: current.id });
    }
  }

  for (const cue of cues) {
    if (cue.endMs <= cue.startMs) {
      issues.gaps.push({ startMs: cue.startMs, endMs: cue.endMs, firstId: cue.id });
    }
    if (forbiddenPatterns.some((pattern) => pattern.test(cue.text))) issues.forbidden.push(cue.id);
  }

  return issues;
}

/** متن کامل یک کات برای صفحه‌خوان (گوینده + متن). */
export function describeCue(cue: NarrationCue): string {
  return `${cue.speaker}: ${cue.text}`;
}

/** برچسب فصل برای نمایش فشرده. */
export function chapterLabel(chapter: NarrationCue['chapter']): string {
  if (chapter === 'door') return 'فصل اول · آستانهٔ در';
  if (chapter === 'hall') return 'فصل دوم · سالن تاریک';
  return 'پیش‌درآمد · دعوت‌نامه';
}

/**
 * فهرست کوتاه کات‌های فعال در بازه‌ای که با هر بار تغییر متن به صفحه‌خوان اعلام
 * می‌شود. فقط کات‌های یکتا برمی‌گردند تا از تکرار جلوگیری شود.
 */
export function cuesBetween(
  cues: readonly NarrationCue[],
  fromMs: number,
  toMs: number,
): NarrationCue[] {
  const start = Math.min(fromMs, toMs);
  const end = Math.max(fromMs, toMs);
  return cues.filter((cue) => cue.endMs > start && cue.startMs < end);
}

/* --------------------------------------------------------------------------
 * اعلان شروع و پایان کات‌سین
 * -------------------------------------------------------------------------- */

export interface PhaseNoticeView {
  id: string;
  text: string;
  detail: string;
  tone: 'start' | 'end';
}

export const PHASE_NOTICE_WINDOW_MS = 6_000;

/**
 * در شش ثانیهٔ اول «شروع» و در شش ثانیهٔ آخر «پایان» کات‌سین اعلام می‌شود؛
 * بین این دو، اعلانی وجود ندارد تا ناحیهٔ زنده شلوغ نشود.
 */
export function phaseNotice(
  elapsedMs: number,
  durationMs: number,
  options: {
    startText?: string;
    endText?: string;
    windowMs?: number;
  } = {},
): PhaseNoticeView | null {
  const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  const window = Number.isFinite(options.windowMs) ? Math.max(0, options.windowMs ?? PHASE_NOTICE_WINDOW_MS) : PHASE_NOTICE_WINDOW_MS;
  if (!Number.isFinite(elapsedMs) || duration === 0) return null;
  const t = Math.min(Math.max(0, elapsedMs), duration);
  if (window > 0 && t < window) {
    return {
      id: 'phase-start',
      text: options.startText ?? 'کات‌سین آغاز شد',
      detail: 'در تمام این صحنه حرکت و زوم در دسترس نیست؛ زیرنویس همراه شماست.',
      tone: 'start',
    };
  }
  if (window > 0 && t >= duration - window) {
    return {
      id: 'phase-end',
      text: options.endText ?? 'کات‌سین به پایان رسید',
      detail: 'به‌زودی کنترل حرکت باز می‌شود؛ آمادهٔ گشتن در سالن باشید.',
      tone: 'end',
    };
  }
  return null;
}
