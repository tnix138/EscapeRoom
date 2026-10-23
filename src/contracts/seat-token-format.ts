// src/contracts/seat-token-format.ts — قالب و نرمال‌سازی توکن صندلی
//
// چرا یک ماژول مشترک؟ توکن هم سمت سرور (هدر `X-Seat-Token` و `?token=` استریم SSE)
// و هم سمت کلاینت (آدرس لینک دعوت و storage) دست‌به‌دست می‌شود. این فایل هیچ
// وابستگی به Node ندارد تا هر دو سمت دقیقاً یک قاعده را اجرا کنند.
//
// مشکل واقعی که حل می‌کند: لینک دعوت در چت فارسی کپی/بازنشر می‌شود و توکن با
// نویسه‌های پنهان (نیم‌فاصله، RLO/LRM، BOM) یا به‌صورت percent-encoded به سرور
// می‌رسد؛ در آن حالت هش SHA-256 با هش صندلی نمی‌خواند و بازیکن ۴۰۱ می‌گیرد.

/** طول توکن خام صندلی: ۳۶ بایت base64url = ۴۸ کاراکتر. */
export const SEAT_TOKEN_LENGTH = 48;

const SEAT_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * نویسه‌های پنهان و کنترلی که هیچ‌وقت بخشی از توکن نیستند:
 * کنترل‌های ASCII (فاصله/خط نو)، نیم‌فاصلهٔ فارسی، BOM، نویسه‌های صفرپهنا،
 * نشانگرهای جهت (RLO/LRM/…) و جداکننده‌های نامرئی.
 */
// eslint-disable-next-line no-control-regex
const INVISIBLE_CHARS =
  /[\u0000-\u0020\u007F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/**
 * توکن دریافتی را به همان قالبی برمی‌گرداند که هنگام رزرو تولید شده است:
 * ۱) حذف نویسه‌های پنهان/فاصله ۲) decode کردن در صورت encode بودن (تا دوبار).
 * توکن سالم دست‌نخورده برمی‌گردد؛ decode ناموفق هم توکن را نابود نمی‌کند.
 */
export function normalizeSeatToken(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) return '';
  let value = raw.replace(INVISIBLE_CHARS, '');
  // اگر آدرس decode نشده باشد (مثلاً روی Vercel یا بعد از بازنشر لینک)، یک‌بار decode
  // می‌کنیم؛ چون نتیجه می‌تواند دوباره نویسهٔ پنهان یا % داشته باشد، حداکثر دو دور.
  for (let pass = 0; pass < 2 && value.includes('%'); pass += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(value);
    } catch {
      break;
    }
    if (decoded === value) break;
    value = decoded.replace(INVISIBLE_CHARS, '');
  }
  return value;
}

/** آیا توکن دقیقاً هم‌قالب توکن صادرشده است؟ (۴۸ کاراکتر base64url) */
export function isWellFormedSeatToken(token: string): boolean {
  return typeof token === 'string' && token.length === SEAT_TOKEN_LENGTH && SEAT_TOKEN_PATTERN.test(token);
}
