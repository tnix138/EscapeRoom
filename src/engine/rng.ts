// src/engine/rng.ts — تولید تصادفی تکرارپذیر Mulberry32 بر پایه seed اتاق
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** عدد صحیح یکنواخت در بازه [min, max] (شامل هر دو سر) */
export function rngInt(next: () => number, min: number, max: number): number {
  return min + Math.floor(next() * (max - min + 1));
}

/** انتخاب یکنواخت یک عضو از آرایه ناتهی */
export function rngPick<T>(next: () => number, items: readonly T[]): T {
  return items[Math.floor(next() * items.length)] as T;
}
