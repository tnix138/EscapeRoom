/**
 * دادهٔ خالص «حالت خواندن سرنخ» — موج ۴ (محتوای کوچه).
 *
 * پوستر و جدول ردیف در صحنه، در فاصلهٔ بازی دیده می‌شوند؛ خواندن واقعی در
 * پنل inspect انجام می‌شود. این ماژول بدون JSX است تا در تست‌های node هم
 * قابل استفاده باشد.
 */

export type ClueKind = 'playbill' | 'rowChart';

export interface PlaybillClue {
  actNumber: number;
  sceneTitle: string;
  description: string;
}

export interface RowChartClue {
  rowTitle: string;
  romanCode: string;
}

export interface ClueReadingInput {
  playbill: readonly PlaybillClue[];
  rowChart: readonly RowChartClue[];
  punchedCount: number;
  playerCount: number;
}

export interface ClueMeta {
  title: string;
  kicker: string;
  icon: string;
  lede: string;
  foot: string;
  closeLabel: string;
  emptyText: string;
}

export const CLUE_META: Record<ClueKind, ClueMeta> = {
  playbill: {
    title: 'تابلوی اعلانات محله',
    kicker: 'STAGIONE 1924 · TEATRO ORFEO',
    icon: '🎭',
    lede: 'پرده‌های امشب؛ نام و نشان هر پرده را برای هم‌تیمی‌هایت بخوان.',
    foot: 'یک اجرا · یک شب · یک راز',
    closeLabel: 'بستن پوستر اعلانات',
    emptyText: 'برنامهٔ امشب هنوز روی تابلو نصب نشده است.',
  },
  rowChart: {
    title: 'گیشهٔ مکانیکی برنجی',
    kicker: 'TABELLA DELLE FILE',
    icon: '⌘',
    lede: 'هر ردیف صندلی یک کد ورود دارد؛ کد ردیف خودت را از روی بلیط پیدا کن.',
    foot: 'ردیف خود را از روی بلیط پیدا کنید',
    closeLabel: 'بستن جدول ردیف‌ها',
    emptyText: 'جدول ردیف‌ها هنوز از گیشه بیرون نیامده است.',
  },
};

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** تبدیل عدد به رقم فارسی بدون وابستگی به ICU. */
export function toPersianNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  return String(Math.trunc(value)).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

/** برچسب پرده؛ برای اعداد ۱ تا ۹ رقم فارسی و بعد از آن عدد + رقم. */
export function actLabel(actNumber: number): string {
  return `پردهٔ ${toPersianNumber(actNumber)}`;
}

export function clueTitle(kind: ClueKind): string {
  return CLUE_META[kind].title;
}

/** متن اعلان برای screen reader هنگام باز/بسته شدن پنل. */
export function clueAnnouncement(kind: ClueKind, open: boolean): string {
  const meta = CLUE_META[kind];
  return open ? `${meta.title} باز شد. برای بستن، کلید Esc را بزنید.` : `${meta.title} بسته شد.`;
}

/** خلاصهٔ کوتاه محتوا؛ برای aria-describedby و تست. */
export function clueSummary(kind: ClueKind, data: ClueReadingInput): string {
  if (kind === 'playbill') {
    if (data.playbill.length === 0) return CLUE_META.playbill.emptyText;
    return `${toPersianNumber(data.playbill.length)} پرده روی این تابلو اعلام شده است.`;
  }
  if (data.rowChart.length === 0) return CLUE_META.rowChart.emptyText;
  return `${toPersianNumber(data.rowChart.length)} ردیف در جدول ثبت شده است.`;
}

/** آیا سرنخ برای این نوع پنل محتوایی دارد؟ */
export function hasClueContent(kind: ClueKind, data: ClueReadingInput): boolean {
  return kind === 'playbill' ? data.playbill.length > 0 : data.rowChart.length > 0;
}

/** متن راهنمای خواندن که کنار پوستر/گیشه نشان داده می‌شود. */
export function inspectHint(kind: ClueKind): string {
  return kind === 'playbill' ? 'خواندن اعلان نمایش' : 'خواندن جدول ردیف‌ها';
}

/** شمارندهٔ بلیط‌های آماده؛ هرگز کد در یا رقم پنهان را افشا نمی‌کند. */
export function readyTicketsText(data: ClueReadingInput): string {
  return `${toPersianNumber(data.punchedCount)} از ${toPersianNumber(data.playerCount)} بلیط آماده`;
}

/**
 * کلیدهایی که هنگام باز بودن پنل خواندن نباید به کنترلر بازی برسند؛
 * جلوی راه‌رفتن بازیکن با W/A/S/D وقتی مشغول خواندن است را می‌گیرد.
 */
export const CLUE_BLOCKED_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyE',
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
]);

export function shouldBlockGameKey(code: string): boolean {
  return CLUE_BLOCKED_KEYS.has(code);
}
