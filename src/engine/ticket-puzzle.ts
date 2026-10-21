// src/engine/ticket-puzzle.ts — الگوریتم گراف حلقوی بلیط‌ها برای N = 3..8 بازیکن
// اصل طراحی: بازیکن i کوپنِ رمزگشای بلیط بازیکن (i+1) mod N را در دست دارد؛
// پس هیچ‌کس به‌تنهایی معما را حل نمی‌کند و هیچ‌کس بیکار نمی‌ماند.
import type { PlayActNumber, RowRomanCode, TheaterEmblemId } from '../contracts/types';
import { mulberry32, rngInt, rngPick } from './rng';

export const PLAY_TITLE = 'پردهٔ سرخ — تماشاخانهٔ اُرفه‌ئو';

export const THEATER_EMBLEMS: readonly TheaterEmblemId[] = [
  'mask',
  'violin',
  'dancer',
  'candelabra',
  'rose',
  'swan',
  'hourglass',
  'bell',
] as const;

/** پوستر دیوار چپ کوچه: عنوان هر پرده (شماره پرده از روی عنوان پیدا می‌شود) */
export const LEFT_WALL_PLAYBILL: ReadonlyArray<{
  actNumber: PlayActNumber;
  sceneTitle: string;
  description: string;
}> = [
  {
    actNumber: 1,
    sceneTitle: 'ورود نقاب‌داران به تالار آینه‌ها',
    description: 'مهمانان با نقاب‌های طلایی وارد می‌شوند و نخستین آواز در تالار می‌پیچد.',
  },
  {
    actNumber: 2,
    sceneTitle: 'والس ویولنِ ترک‌خورده',
    description: 'نوازنده‌ای تنها زیر نور شمعدان‌ها والس فراموش‌شدهٔ اُرفه‌ئو را می‌نوازد.',
  },
  {
    actNumber: 3,
    sceneTitle: 'رقص قو بر دریاچهٔ مه',
    description: 'رقصنده‌ای با جامهٔ سفید بر مهِ صحنه می‌چرخد و رز سرخی بر زمین می‌افتد.',
  },
  {
    actNumber: 4,
    sceneTitle: 'زنگ خاموشی و پردهٔ سرخ',
    description: 'زنگ پرده برای آخرین بار می‌خورد و ساعت شنیِ تالار وارونه می‌شود.',
  },
];

/** جدول دیوار راست کوچه: تبدیل عنوان ردیف به کد رومی برنجی */
export const RIGHT_WALL_ROW_CHART: ReadonlyArray<{
  rowTitle: string;
  romanCode: RowRomanCode;
}> = [
  { rowTitle: 'ردیف طلاییِ پیشین', romanCode: 'I' },
  { rowTitle: 'ردیف مخملِ میانی', romanCode: 'II' },
  { rowTitle: 'ردیف نقره‌ایِ بالکن', romanCode: 'III' },
  { rowTitle: 'ردیف سایهٔ پسین', romanCode: 'IV' },
];

export interface TicketTarget {
  seatIndex: number;
  targetEmblem: TheaterEmblemId;
  targetAct: PlayActNumber;
  targetRowCode: RowRomanCode;
  /** عنوان ردیفی که روی جدول دیوار راست باید پیدا شود */
  alleyRowHintName: string;
  goldenDigit: number;
}

export function actSceneTitle(act: PlayActNumber): string {
  return LEFT_WALL_PLAYBILL.find((p) => p.actNumber === act)?.sceneTitle ?? '';
}

export function rowTitleForCode(code: RowRomanCode): string {
  return RIGHT_WALL_ROW_CHART.find((r) => r.romanCode === code)?.rowTitle ?? '';
}

/**
 * تولید قطعی (deterministic) اهداف بلیط برای N بازیکن از روی seed اتاق.
 * به ازای هر seed یک جواب یکتا وجود دارد.
 */
export function generateTicketTargets(seed: number, playerCount: number): TicketTarget[] {
  const next = mulberry32(seed);
  const targets: TicketTarget[] = [];
  for (let i = 0; i < playerCount; i++) {
    const targetRowCode = rngPick(next, ['I', 'II', 'III', 'IV'] as const);
    targets.push({
      seatIndex: i,
      targetEmblem: rngPick(next, THEATER_EMBLEMS),
      targetAct: rngInt(next, 1, 4) as PlayActNumber,
      targetRowCode,
      alleyRowHintName: rowTitleForCode(targetRowCode),
      goldenDigit: rngInt(next, 1, 9),
    });
  }
  return targets;
}

/** نرمال‌سازی کد قفل در: ارقام فارسی/عربی به انگلیسی، حذف فاصله و جداکننده‌ها */
export function normalizeDoorCode(raw: string): string {
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const AR = '٠١٢٣٤٥٦٧٨٩';
  return raw
    .split('')
    .map((ch) => {
      const fa = FA.indexOf(ch);
      if (fa >= 0) return String(fa);
      const ar = AR.indexOf(ch);
      if (ar >= 0) return String(ar);
      return ch;
    })
    .join('')
    .replace(/[\s-]/g, '');
}

/** تنها ترکیب درست برای بلیط یک بازیکن؛ هر ترکیب دیگری اشتباه است (جواب یکتا) */
export function isCorrectPunch(
  target: TicketTarget,
  punch: { emblem: TheaterEmblemId; actNumber: PlayActNumber; rowCode: RowRomanCode },
): boolean {
  return (
    punch.emblem === target.targetEmblem &&
    punch.actNumber === target.targetAct &&
    punch.rowCode === target.targetRowCode
  );
}

/** کد N رقمی قفل در، به ترتیب شماره صندلی ۱ تا N (فقط پس از پانچ همه آشکار می‌شود) */
export function doorCodeFromTargets(targets: readonly TicketTarget[]): string {
  return [...targets]
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((t) => String(t.goldenDigit))
    .join('');
}
