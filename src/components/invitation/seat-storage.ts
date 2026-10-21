/**
 * قرارداد ذخیرهٔ توکن صندلی — موج ۵
 *
 * مسیر اتاق (`src/app/room/[code]/page.tsx`) و SDK توحید این کلیدها را می‌خوانند:
 *   ۱) `seat:<roomCode>`                     ← کلید رسمی SDK
 *   ۲) `orfeo:<roomCode>:<seatToken>`        ← کلید تحویل گیت دعوت‌نامه
 *
 * تغییر این کلیدها قرارداد ورود به بازی را می‌شکند؛ فقط از همین ماژول بنویس/بخوان.
 */

export const SEAT_KEY_PREFIX = 'seat:';
export const GATE_KEY_PREFIX = 'orfeo:';

export function seatKey(roomCode: string): string {
  return `${SEAT_KEY_PREFIX}${roomCode}`;
}

export function gateKey(roomCode: string, seatToken: string): string {
  return `${GATE_KEY_PREFIX}${roomCode}:${seatToken}`;
}

export interface WritableStorage {
  setItem: (key: string, value: string) => void;
}

export interface ReadableStorage {
  length: number;
  key: (index: number) => string | null;
  getItem: (key: string) => string | null;
}

/** هر دو جهت خواندن/نوشتن؛ برای تست و کد کلاینت. */
export interface StorageLike extends ReadableStorage, WritableStorage {}

/**
 * توکن را در همهٔ storageهای در دسترس می‌نویسد.
 * خطای دسترسی (حالت خصوصی/مسدود) نباید ورود را متوقف کند.
 */
export function rememberSeatToken(
  roomCode: string,
  seatToken: string,
  storages: ReadonlyArray<WritableStorage | null | undefined>,
): number {
  let written = 0;
  for (const storage of storages) {
    if (!storage) continue;
    for (const key of [seatKey(roomCode), gateKey(roomCode, seatToken)]) {
      try {
        storage.setItem(key, seatToken);
        written += 1;
      } catch {
        // storage اختیاری است
      }
    }
  }
  return written;
}

/**
 * بازیابی توکن به همان ترتیبی که مسیر اتاق انجام می‌دهد:
 *   ۱) توکن صریح آدرس (`?token=`)
 *   ۲) `seat:<code>`
 *   ۳) اولین کلید `orfeo:<code>:*`
 * مقدارِ برابر با کد اتاق (placeholder آدرس) معتبر نیست.
 */
export function findStoredSeatToken(
  roomCode: string,
  explicitToken: string | null | undefined,
  storages: ReadonlyArray<ReadableStorage | null | undefined>,
): string | null {
  if (explicitToken && explicitToken !== roomCode) return explicitToken;

  for (const storage of storages) {
    if (!storage) continue;
    try {
      const direct = storage.getItem(seatKey(roomCode));
      if (direct) return direct;
      const prefix = gateKey(roomCode, '');
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && key.startsWith(prefix)) {
          return storage.getItem(key) ?? key.slice(prefix.length);
        }
      }
    } catch {
      // storage مسدود؛ سراغ بعدی می‌رویم.
    }
  }
  return null;
}
