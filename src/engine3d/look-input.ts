'use client';

/**
 * look-input.ts — قرارداد «جهت نگاه» در صحنه‌های سه‌بعدی
 * ---------------------------------------------------------------------------
 * باگ گزارش‌شده: «چرخش سر به چپ و راست برعکس است؛ هم گوشی هم کامپیوتر».
 *
 * دلیل: در این پروژه `yawDeg` مثبت یعنی چرخش به **چپ** (دوربین با
 * `lookAt(x − sin(yaw)·cos(pitch), y + sin(pitch), z − cos(yaw)·cos(pitch))`
 * نگاه می‌کند، پس در yaw = +۹۰° به سمت −X می‌نگرد که از حالت روبه‌روی −Z یعنی
 * «چپ» است). اما ورودی، `movementX`/`dx` را با علامت مثبت به yaw اضافه می‌کرد؛
 * نتیجه این بود که حرکت ماوس یا انگشت به راست، سر را به چپ می‌چرخاند.
 *
 * این ماژول تنها مرجع تبدیل «جابه‌جایی اشاره‌گر → دلتای نگاه» و «وضعیت بازیکن →
 * نقطهٔ نگاه دوربین» است تا دو طرف معادله هیچ‌وقت از هم جدا نیفتند:
 *
 *   حرکت اشاره‌گر به راست  ⇒  نگاه به راست  ⇒  yaw کوچک‌تر
 *   حرکت اشاره‌گر به پایین ⇒  نگاه به پایین ⇒  pitch کوچک‌تر
 */

import type { PlayerTransform } from './types';

export interface LookDelta {
  deltaYawDeg: number;
  deltaPitchDeg: number;
}

/**
 * دلتای نگاه از جابه‌جایی افقی/عمودی اشاره‌گر (ماوس، لمس، قلم).
 *
 * @param dx جابه‌جایی افقی پیکسلی؛ مثبت = به راست
 * @param dy جابه‌جایی عمودی پیکسلی؛ مثبت = به پایین
 * @param sensitivity درجه به‌ازای هر پیکسل
 */
export function pointerLookDelta(dx: number, dy: number, sensitivity: number): LookDelta {
  return {
    // علامت منفی: yaw مثبت در این پروژه «چپ» است.
    deltaYawDeg: -dx * sensitivity,
    deltaPitchDeg: -dy * sensitivity,
  };
}

/** بردار نگاه افقی (بدون pitch) برای yaw داده‌شده — همان قرارداد حرکت بازیکن. */
export function forwardFromYaw(yawDeg: number): { x: number; z: number } {
  const yawRad = (yawDeg * Math.PI) / 180;
  return { x: -Math.sin(yawRad), z: -Math.cos(yawRad) };
}

/** نقطه‌ای که دوربین باید به آن نگاه کند (تنها منبع حقیقت برای lookAt). */
export function lookTarget(transform: PlayerTransform): { x: number; y: number; z: number } {
  const yawRad = (transform.yawDeg * Math.PI) / 180;
  const pitchRad = (transform.pitchDeg * Math.PI) / 180;
  return {
    x: transform.x - Math.sin(yawRad) * Math.cos(pitchRad),
    y: transform.y + Math.sin(pitchRad),
    z: transform.z - Math.cos(yawRad) * Math.cos(pitchRad),
  };
}
