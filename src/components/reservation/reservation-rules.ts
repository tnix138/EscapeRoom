/**
 * قواعد رزرو و دعوت‌نامه — موج ۵
 *
 * منطق خالص (بدون DOM) تا هم در فرم، هم در Deck و هم در تست‌های node
 * قابل استفاده باشد. هیچ‌جای این ماژول به سرور یا توکن دسترسی ندارد.
 */

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
export const MAX_NAME_LENGTH = 32;

/** ارقام لاتین را به فارسی تبدیل می‌کند؛ مستقل از ICU. */
export function toPersianDigits(value: number | string): string {
  const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(value).replace(/\d/g, (digit) => digits[Number(digit)] ?? digit);
}

const ZERO_WIDTH = /[\u200B-\u200F\u2060\uFEFF]/g;

/**
 * نام مهمان را برای مقایسه و ارسال آماده می‌کند:
 * حذف نویسه‌های پنهان، یکسان‌سازی ی/ک عربی و جمع‌کردن فاصله‌های اضافی.
 */
export function normalizeGuestName(raw: string): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(ZERO_WIDTH, '')
    .replace(/\u064A/g, 'ی') // ي عربی → ی فارسی
    .replace(/\u0643/g, 'ک') // ك عربی → ک فارسی
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ReservationValidation {
  ok: boolean;
  /** پیام اول برای نمایش کلی (بالای فرم). */
  message: string | null;
  /** خطای تعداد نفرات، مستقل از خطای فیلدها. */
  countError: string | null;
  /** خطای هر مهمان بر اساس اندیس؛ null یعنی همان فیلد سالم است. */
  fieldErrors: Array<string | null>;
  /** اندیس اولین فیلد نامعتبر؛ null یعنی خطا مربوط به تعداد است. */
  firstInvalidField: number | null;
}

const COUNT_MESSAGE = `تعداد مهمان‌ها باید بین ${toPersianDigits(MIN_PLAYERS)} تا ${toPersianDigits(MAX_PLAYERS)} نفر باشد.`;

/** اعتبارسنجی کامل با خطای هر فیلد؛ برای فرم استفاده می‌شود. */
export function validateReservation(names: readonly string[]): ReservationValidation {
  const fieldErrors: Array<string | null> = names.map(() => null);
  const normalized = names.map((name) => normalizeGuestName(name));
  const lower = normalized.map((name) => name.toLocaleLowerCase('fa'));

  if (names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) {
    return {
      ok: false,
      message: COUNT_MESSAGE,
      countError: COUNT_MESSAGE,
      fieldErrors,
      firstInvalidField: null,
    };
  }

  const kinds: Array<'empty' | 'long' | 'duplicate' | null> = names.map(() => null);

  normalized.forEach((name, index) => {
    if (!name) {
      kinds[index] = 'empty';
      fieldErrors[index] = 'نام این مهمان را وارد کنید.';
    } else if (name.length > MAX_NAME_LENGTH) {
      kinds[index] = 'long';
      fieldErrors[index] = `نام هر مهمان حداکثر ${toPersianDigits(MAX_NAME_LENGTH)} نویسه می‌تواند باشد.`;
    }
  });

  const seen = new Map<string, number>();
  lower.forEach((name, index) => {
    if (!name || fieldErrors[index]) return;
    const first = seen.get(name);
    if (first !== undefined) {
      kinds[index] = 'duplicate';
      fieldErrors[index] = `این نام با ${seatLabelForIndex(first)} یکسان است؛ نام‌ها باید متفاوت باشند.`;
      return;
    }
    seen.set(name, index);
  });

  const firstInvalidField = fieldErrors.findIndex((error) => error !== null);
  if (firstInvalidField === -1) {
    return { ok: true, message: null, countError: null, fieldErrors, firstInvalidField: null };
  }

  // پیام کلی خلاصه است؛ جزئیات کنار هر صندلی نمایش داده می‌شود.
  const summary =
    kinds[firstInvalidField] === 'empty'
      ? 'نام همهٔ مهمان‌ها را کامل وارد کنید؛ ردیف مشخص‌شده خالی است.'
      : kinds[firstInvalidField] === 'long'
        ? `نام هر مهمان حداکثر ${toPersianDigits(MAX_NAME_LENGTH)} نویسه می‌تواند باشد.`
        : 'نام مهمان‌ها باید متفاوت باشند؛ دو صندلی هم‌نام شده‌اند.';

  return {
    ok: false,
    message: summary,
    countError: null,
    fieldErrors,
    firstInvalidField,
  };
}

/**
 * سازگاری با API قبلی: اولین پیام خطا یا null.
 * (تست‌های موجود و فراخوان‌های قدیمی به همین شکل کار می‌کنند.)
 */
export function validateGuestNames(names: readonly string[]): string | null {
  return validateReservation(names).message;
}

/** برچسب صندلی با ارقام فارسی: «صندلی ۰۱». */
export function seatLabelForIndex(index: number): string {
  const safe = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0;
  return `صندلی ${toPersianDigits(String(safe + 1).padStart(2, '0'))}`;
}

/** نام نمایشی مهمان؛ خالی نماند. */
export function guestDisplayName(raw: string, index: number): string {
  const name = normalizeGuestName(raw);
  return name || `مهمان ${toPersianDigits(index + 1)}`;
}

export interface InviteLink {
  playerName: string;
  invitePath: string;
}

/**
 * آدرس دعوت را می‌سازد. روی سرور `origin` نیست، پس همان مسیر نسبی برمی‌گردد
 * تا رندر سرور و کلاینت یکسان بماند (بدون hydration mismatch).
 * عمداً از `new URL` استفاده نمی‌کنیم تا دامنهٔ فارسی دست‌نخورده بماند.
 */
export function resolveInviteUrl(path: string, origin: string | null): string {
  if (!origin || !/^[a-z][a-z0-9+.-]*:\/\/[^\s]+$/i.test(origin)) return path;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return path;
  const base = origin.replace(/\/+$/, '');
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

/** متن یک خط از لیست دعوت‌ها. */
export function buildInviteLine(invite: InviteLink, origin: string | null): string {
  return `${guestDisplayName(invite.playerName, 0)}: ${resolveInviteUrl(invite.invitePath, origin)}`;
}

/** متن «کپی همه» با سرصفحهٔ کد اتاق. */
export function buildInviteShareText(
  roomCode: string,
  invites: readonly InviteLink[],
  origin: string | null,
): string {
  const header = `دعوت‌نامه‌های تماشاخانهٔ ارفه‌ئو — کد اتاق: ${roomCode}`;
  const lines = invites.map((invite, index) => {
    const name = guestDisplayName(invite.playerName, index);
    return `${toPersianDigits(index + 1)}. ${name}: ${resolveInviteUrl(invite.invitePath, origin)}`;
  });
  return [header, '', ...lines].join('\n');
}

/** پیام کوتاه برای نوار وضعیت کپی. */
export function describeCopyFailure(reason: 'unsupported' | 'blocked'): string {
  return reason === 'unsupported'
    ? 'این مرورگر کپی خودکار را پشتیبانی نمی‌کند؛ لینک را دستی انتخاب و کپی کنید.'
    : 'اجازهٔ دسترسی به کلیپ‌بورد داده نشد؛ لینک را دستی انتخاب و کپی کنید.';
}

/** شمارندهٔ نفرات با ارقام فارسی: «۵ مهمان». */
export function guestCountLabel(count: number): string {
  return `${toPersianDigits(count)} مهمان`;
}

/** آیا تعداد انتخاب‌شده در بازهٔ مجاز است؟ (برای فعال‌سازی پیام راهنما) */
export function isAllowedPlayerCount(count: number): boolean {
  return Number.isInteger(count) && count >= MIN_PLAYERS && count <= MAX_PLAYERS;
}
