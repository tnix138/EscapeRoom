// src/server/auth/seat-token.ts — تولید توکن ۴۸ کاراکتری صندلی + هش SHA-256
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** توکن خام ۴۸ کاراکتری (فقط یک بار، هنگام رزرو، به میزبان داده می‌شود) */
export function generateSeatToken(): string {
  return randomBytes(36).toString('base64url'); // 36 bytes -> 48 chars
}

export function hashSeatToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** مقایسه ثابت‌زمان هش توکن دریافتی با هش ذخیره‌شده */
export function seatTokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashSeatToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
