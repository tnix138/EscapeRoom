// src/components/admin/format.ts — قالب‌بندی فارسی مشترک پنل ادمین (فاز ۱۰)
// همهٔ توابع خالص‌اند تا هم در سرور و هم در کلاینت یک خروجی بدهند (بدون اختلاف hydration).
import type { GamePhase } from '@/contracts/types';

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function faDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (digit) => FA_DIGITS[Number(digit)] as string);
}

/** ساعت به وقت تهران؛ ورودی میلی‌ثانیه، خروجی مثل «۱۴:۰۵». */
export function formatClock(timestamp: number): string {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
  return faDigits(formatted);
}

/** فاصلهٔ زمانی خوانا: «الان» / «۳ دقیقه پیش» / «۲ ساعت پیش». */
export function formatRelative(timestamp: number | null, now = Date.now()): string {
  if (timestamp === null) return '—';
  const diff = Math.max(0, now - timestamp);
  const seconds = Math.floor(diff / 1_000);
  if (seconds < 10) return 'الان';
  if (seconds < 60) return `${faDigits(seconds)} ثانیه پیش`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${faDigits(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${faDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  return `${faDigits(days)} روز پیش`;
}

export const PHASE_LABELS: Record<GamePhase, string> = {
  alley_puzzle: 'کوچه — معما',
  door_cutscene: 'کات‌سین در',
  theater_cutscene: 'کات‌سین تئاتر',
  in_theater: 'سالن تئاتر',
};

export function phaseLabel(phase: GamePhase): string {
  return PHASE_LABELS[phase] ?? phase;
}

/** درصد برای کارت نرخ خطا. */
export function formatPercent(ratio: number): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  return `${faDigits(Math.round(clamped * 100))}٪`;
}
