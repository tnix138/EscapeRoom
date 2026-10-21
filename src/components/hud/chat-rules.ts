/**
 * قواعد نمایش نجوای گروهی — موج ۶
 * بدون DOM؛ فقط متن و شمارش، برای تست در محیط node.
 */

export const WHISPER_MAX_LENGTH = 240;

export interface WhisperDraft {
  trimmed: string;
  length: number;
  remaining: number;
  canSend: boolean;
  /** متن بلندتر از سقف؛ در UI پیام کوتاه می‌شود. */
  tooLong: boolean;
}

export function whisperDraft(raw: string, max = WHISPER_MAX_LENGTH): WhisperDraft {
  const trimmed = raw.trim();
  return {
    trimmed,
    length: trimmed.length,
    remaining: Math.max(0, max - trimmed.length),
    canSend: trimmed.length > 0 && trimmed.length <= max,
    tooLong: trimmed.length > max,
  };
}

/** تعداد پیام‌های تازه نسبت به آخرین باری که کاربر پنل را باز کرده است. */
export function unseenMessageCount(total: number, seen: number): number {
  const safeTotal = Math.max(0, Math.trunc(total));
  const safeSeen = Math.max(0, Math.trunc(seen));
  return Math.max(0, safeTotal - safeSeen);
}

export type WhisperType = 'whisper' | 'ticket_share' | 'system';

export function whisperTypeLabel(type: WhisperType): string {
  if (type === 'ticket_share') return 'کوپن';
  if (type === 'system') return 'سیستم';
  return 'نجوا';
}

/** برچسب وضعیت ارسال، برای ناحیهٔ aria-live. */
export function describeSendState(state: 'idle' | 'sending' | 'sent' | 'error'): string {
  if (state === 'sending') return 'در حال فرستادن…';
  if (state === 'sent') return 'پیام به گروه رسید.';
  if (state === 'error') return 'پیام فرستاده نشد؛ دوباره تلاش کنید.';
  return '';
}
