// src/server/auth/seat-token.ts — تولید توکن ۴۸ کاراکتری صندلی + هش SHA-256
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { normalizeSeatToken } from '../../contracts/seat-token-format';

// قالب توکن و نرمال‌سازی آن مشترک کلاینت/سرور است؛ از همان ماژول قرارداد بازنشر می‌شود
// تا هیچ مسیری توکن آلوده (نویسهٔ پنهان یا encode شده) را مستقیم به هش نرساند.
export {
  SEAT_TOKEN_LENGTH,
  isWellFormedSeatToken,
  normalizeSeatToken,
} from '../../contracts/seat-token-format';

/** توکن خام ۴۸ کاراکتری (فقط یک بار، هنگام رزرو، به میزبان داده می‌شود) */
export function generateSeatToken(): string {
  return randomBytes(36).toString('base64url'); // 36 bytes -> 48 chars
}

export function hashSeatToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** مقایسه ثابت‌زمان هش توکن دریافتی با هش ذخیره‌شده (توکن پیش از هش، نرمال می‌شود) */
export function seatTokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashSeatToken(normalizeSeatToken(token)), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
