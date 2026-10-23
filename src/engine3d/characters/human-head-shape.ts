// src/engine3d/characters/human-head-shape.ts — ریخت‌شناسی تحلیلی جمجمهٔ انسان
//
// چرا یک ماژول مشترک؟ چون اگر چشم روی بافت صورت «رنگ» شود ولی کاسهٔ چشم در هندسه
// جای دیگری باشد، نتیجه دقیقاً همان چیزی می‌شود که «ربات» به نظر می‌رسد.
// اینجا یک جهت روی کرهٔ یکه تعریف می‌کنیم، هم هندسه و هم بافت از همان جهت استفاده
// می‌کنند تا ابرو، کاسهٔ چشم، لب، بینی و چانه همیشه روی هم بنشینند.
//
// همهٔ مختصات در «فضای جهت» هستند: x به راستِ خودِ کاراکتر (+X)، y بالا، و
// صورت رو به -Z است. خروجی توابع متری، حول مرکز جمجمه، با y=0 در مرکز سر.

import * as THREE from 'three';
import type { HeadMorphology, HumanLook } from './human-presets';

export const HEAD_WIDTH_SEGMENTS = 72;
export const HEAD_HEIGHT_SEGMENTS = 56;

/**
 * تراکم مش سر. چهرهٔ انسان کوچک است (~۱۶ سانتی‌متر) و اگر روی ۷۲×۵۶ کره بمانَد،
 * مثلث‌های ~۲ سانتی روی گونه «چهرهٔ چندضلعی» می‌سازند. ۱۲۰×۸۸ هزینه‌اش ~۱۰٬۵۰۰ رأس
 * است، یعنی یک‌دهمِ بودجهٔ یک کاراکتر مدرن، و تفاوتش در نمای نزدیک شب و روز است.
 */
export const HEAD_FACE_SEGMENTS = { width: 120, height: 88 } as const;

export interface HeadAnchors {
  eyeL: THREE.Vector3;
  eyeR: THREE.Vector3;
  browL: THREE.Vector3;
  browR: THREE.Vector3;
  mouth: THREE.Vector3;
  mouthCornerL: THREE.Vector3;
  mouthCornerR: THREE.Vector3;
  noseTip: THREE.Vector3;
  noseBridge: THREE.Vector3;
  noseWingL: THREE.Vector3;
  noseWingR: THREE.Vector3;
  nostrilL: THREE.Vector3;
  nostrilR: THREE.Vector3;
  chin: THREE.Vector3;
  chinCrease: THREE.Vector3;
  cheekL: THREE.Vector3;
  cheekR: THREE.Vector3;
  jawL: THREE.Vector3;
  jawR: THREE.Vector3;
  templeL: THREE.Vector3;
  templeR: THREE.Vector3;
  earL: THREE.Vector3;
  earR: THREE.Vector3;
  forehead: THREE.Vector3;
  philtrum: THREE.Vector3;
  underEyeL: THREE.Vector3;
  underEyeR: THREE.Vector3;
  nasolabialL: THREE.Vector3;
  nasolabialR: THREE.Vector3;
}

function dirFromFace(x: number, y: number): THREE.Vector3 {
  const z = -Math.sqrt(Math.max(0.02, 1 - x * x - y * y));
  return new THREE.Vector3(x, y, z).normalize();
}

function dirFromSide(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z).normalize();
}

/** لنگرهای چهره بر اساس ریخت‌شناسی؛ همه یکه (unit) هستند. */
export function resolveHeadAnchors(head: HeadMorphology): HeadAnchors {
  const eyeX = 0.26 + head.eyeSpacing * 0.4;
  const eyeY = 0;
  const browX = eyeX * 1.02;
  const browY = 0.2 + head.browRidge * 0.03;
  const mouthY = -0.6 + (head.chinLength - 0.4) * 0.03;
  const mouthHalfWidth = 0.26 + head.lipFullness * 0.05;

  return {
    eyeL: dirFromFace(-eyeX, eyeY),
    eyeR: dirFromFace(eyeX, eyeY),
    browL: dirFromFace(-browX, browY),
    browR: dirFromFace(browX, browY),
    mouth: dirFromFace(0, mouthY),
    mouthCornerL: dirFromFace(-mouthHalfWidth, mouthY - 0.03),
    mouthCornerR: dirFromFace(mouthHalfWidth, mouthY - 0.03),
    noseTip: dirFromFace(0, -0.33),
    noseBridge: dirFromFace(0, 0.06),
    noseWingL: dirFromFace(-(0.085 + head.noseWidth * 0.05), -0.42),
    noseWingR: dirFromFace(0.085 + head.noseWidth * 0.05, -0.42),
    nostrilL: dirFromFace(-(0.055 + head.noseWidth * 0.04), -0.48),
    nostrilR: dirFromFace(0.055 + head.noseWidth * 0.04, -0.48),
    chin: dirFromFace(0, -0.86),
    chinCrease: dirFromFace(0, -0.76),
    cheekL: dirFromFace(-(0.52 + head.cheekbone * 0.1), -0.12),
    cheekR: dirFromFace(0.52 + head.cheekbone * 0.1, -0.12),
    jawL: dirFromSide(-(0.5 + head.jawWidth * 0.12), -0.62, -0.42),
    jawR: dirFromSide(0.5 + head.jawWidth * 0.12, -0.62, -0.42),
    templeL: dirFromSide(-0.84, 0.22, -0.28),
    templeR: dirFromSide(0.84, 0.22, -0.28),
    earL: dirFromSide(-0.99, -0.03, 0.1),
    earR: dirFromSide(0.99, -0.03, 0.1),
    forehead: dirFromFace(0, 0.36),
    philtrum: dirFromFace(0, -0.5),
    underEyeL: dirFromFace(-eyeX, eyeY - 0.11),
    underEyeR: dirFromFace(eyeX, eyeY - 0.11),
    nasolabialL: dirFromFace(-0.22, -0.42),
    nasolabialR: dirFromFace(0.22, -0.42),
  };
}

/**
 * تبدیل جهت یکه به UV کرهٔ تودرتو (همان قرارداد THREE.SphereGeometry).
 * صورت در u = 0.75 و v ≈ 0.5 پخش می‌شود؛ این تابع مشترک تضمین می‌کند بافت
 * و هندسه یک نقشهٔ واحد دارند.
 */
export function headDirectionToUv(direction: THREE.Vector3, target = new THREE.Vector2()): THREE.Vector2 {
  const y = THREE.MathUtils.clamp(direction.y, -1, 1);
  const u = ((Math.atan2(direction.z, -direction.x) / (Math.PI * 2)) % 1 + 1) % 1;
  const v = Math.acos(y) / Math.PI;
  return target.set(u, v);
}

/** نقطهٔ سطح بیضی‌وار خامِ سر برای یک جهت (قبل از مجسمه‌سازی). */
export function headSurfacePoint(
  direction: THREE.Vector3,
  head: HeadMorphology,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  return target.set(
    direction.x * head.width,
    direction.y * head.height,
    direction.z * head.depth,
  );
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
}

function bump(x: number, y: number, cx: number, cy: number, sx: number, sy: number): number {
  const dx = (x - cx) / sx;
  const dy = (y - cy) / sy;
  return Math.exp(-(dx * dx + dy * dy) * 1.6);
}

/** کمان ابرو: از نزدیک بینی تا شقیقه، با قوسِ میانی؛ مشترک بین بافت و تارهای سه‌بعدی */
export function resolveBrowArc(head: HeadMorphology): {
  inner: THREE.Vector3;
  outer: THREE.Vector3;
  arch: number;
} {
  const eyeX = 0.26 + head.eyeSpacing * 0.4;
  const innerX = eyeX * 0.62;
  const outerX = Math.min(0.66, eyeX + 0.2);
  const innerY = 0.175 + head.browRidge * 0.025;
  const outerY = 0.15 + head.browRidge * 0.02;
  return {
    inner: dirFromFace(innerX, innerY),
    outer: dirFromFace(outerX, outerY),
    arch: 0.038,
  };
}

export interface SculptOptions {
  /** شدت کلی تغییرات؛ ۰ = بیضی خام (برای دیباگ) */
  intensity?: number;
}

/** درون‌یابی خطی روی جدول پروفایل (y صعودی) */
function profileAt(table: readonly (readonly [number, number])[], y: number): number {
  if (y <= table[0]![0]) return table[0]![1];
  for (let i = 1; i < table.length; i++) {
    const [y1, z1] = table[i]!;
    if (y <= y1) {
      const [y0, z0] = table[i - 1]!;
      const t = (y - y0) / (y1 - y0 || 1e-6);
      return z0 + (z1 - z0) * t;
    }
  }
  return table[table.length - 1]![1];
}

/**
 * پروفایل نیمرخِ یک سرِ انسان بالغ روی صفحهٔ میانی (x = 0).
 *
 * چرا جدول؟ آدم‌ها صورت را با «خطِ نیمرخ» می‌شناسند: پیشانی، پل بینی، نوک بینی،
 * فراز لب، شیار زیر لب و چانه. اگر این خط درست باشد، جزئیاتِ دیگر بخشوده می‌شوند؛
 * اگر غلط باشد (مثل بیضی صاف) هیچ بافتی نجاتش نمی‌دهد. مقادیر بر حسب متر برای سرِ
 * استاندارد ۲۳۲ میلی‌متری، با y=0 روی خط چشم و z منفی به سمت صورت.
 */
const FACIAL_PROFILE: readonly (readonly [number, number])[] = [
  [-0.132, -0.012],
  [-0.121, -0.070],
  [-0.115, -0.099],
  [-0.105, -0.090],
  [-0.097, -0.096],
  [-0.086, -0.096],
  [-0.079, -0.091],
  [-0.072, -0.096],
  [-0.062, -0.097],
  [-0.055, -0.108],
  [-0.046, -0.126],
  [-0.039, -0.121],
  [-0.033, -0.105],
  [-0.024, -0.100],
  [-0.012, -0.094],
  [0.006, -0.093],
  [0.022, -0.096],
  [0.040, -0.097],
  [0.062, -0.094],
  [0.085, -0.088],
  [0.105, -0.062],
  [0.119, -0.012],
];

/**
 * جمجمه را از کرهٔ یکه به سر انسان تبدیل می‌کند؛ UV دست‌نخورده می‌ماند
 * (فقط موقعیت رأس‌ها جابه‌جا می‌شود) تا بافتِ صورت روی همان سطح بنشیند.
 */
export function sculptHead(
  direction: THREE.Vector3,
  head: HeadMorphology,
  target = new THREE.Vector3(),
  options: SculptOptions = {},
): THREE.Vector3 {
  const k = options.intensity ?? 1;
  const fx = direction.x;
  const fy = direction.y;
  const fz = direction.z;
  const front = smoothstep(0.0, 0.72, -fz);
  const down = -fy;
  const side = Math.abs(fx);
  const halfHeight = head.height;
  const halfDepth = head.depth * 1.02;

  target.set(fx * head.width, fy * halfHeight, fz * halfDepth);

  const push = (dx: number, dy: number, dz: number) => {
    target.x += dx * k;
    target.y += dy * k;
    target.z += dz * k;
  };

  // ── ۱. نیمرخ: به‌جای «تخت کردن» صورت، اختلاف خطِ میانی به سطح بیضی اضافه می‌شود
  // تا انحنای گونه و گردیِ صورت حفظ شود و فقط بینی/لب/چانه بیرون بزنند.
  const yMeters = fy * halfHeight;
  const ellipseFront = -halfDepth * Math.sqrt(Math.max(0, 1 - fy * fy));
  const profileZ = profileAt(FACIAL_PROFILE, yMeters) * (halfHeight / 0.118);
  const profileDelta = profileZ - ellipseFront;
  const frontWeight = front * (1 - smoothstep(0.1, 0.78, side));
  target.z += profileDelta * frontWeight * 0.38;

  // ── ۲. عرض در هر ارتفاع: شقیقه پهن، فک باریک، پشت سر صاف‌تر
  const templeWidth = 0.05 * bump(side, fy, 0.6, 0.2, 0.3, 0.28);
  const jawTaper = smoothstep(-0.1, 0.95, down);
  const narrow = (0.16 + head.jawWidth * 0.3) * jawTaper * (0.5 + 0.5 * front);
  target.x *= (1 + templeWidth) * (1 + 0.018 * bump(side, fy, 0.5, -0.2, 0.26, 0.2) * front) * (1 - narrow);
  // گوشهٔ فک و استخوان گونه
  push(
    Math.sign(fx || 1) * (0.006 * bump(side, fy, 0.5, -0.55, 0.22, 0.16) * front +
      0.0045 * bump(side, fy, 0.55, -0.06, 0.22, 0.18) * front * head.cheekbone),
    0,
    -0.004 * bump(side, fy, 0.55, -0.06, 0.2, 0.16) * front,
  );

  // ── ۳. بینی: تیغه و نوک، فقط در نواری باریک تا صورت «منقار» نشود
  const noseHalf = 0.05 + head.noseWidth * 0.07;
  const ridge = bump(fx, fy, 0, 0.06, noseHalf * 0.8, 0.14) * front;
  const tip = bump(fx, fy, 0, -0.32, noseHalf, 0.075) * front;
  const noseStrength = (0.008 + head.noseLength * 0.016) * (0.75 + head.noseTip * 0.5);
  push(0, 0, -noseStrength * ridge * 0.16);
  push(0, 0, -noseStrength * tip * 0.3);
  // بال‌های بینی
  const alae = bump(side, fy, noseHalf * 1.15, -0.4, noseHalf * 0.75, 0.07) * front;
  push(Math.sign(fx || 1) * 0.005 * alae, 0, -0.005 * alae);
  // سوراخ بینی
  const nostril = bump(side, fy, noseHalf * 1.0, -0.45, noseHalf * 0.5, 0.045) * front;
  push(0, 0.0025 * nostril, 0.004 * nostril);

  // ── ۴. کاسهٔ چشم (مهم‌ترین سیگنالِ «انسان»)
  const eyeX = 0.26 + head.eyeSpacing * 0.4;
  const socket =
    (bump(fx, fy, -eyeX, 0.005, 0.12, 0.085) + bump(fx, fy, eyeX, 0.005, 0.12, 0.085)) * front;
  push(0, 0, 0.008 * socket);
  // پیشانیِ بالای کاسه و پلک گوشتیِ پایین
  push(0, 0, -0.003 * bump(side, fy, 0.3, 0.13, 0.2, 0.06) * front);
  push(0, 0, -0.0025 * bump(side, fy, 0.3, -0.07, 0.18, 0.05) * front);

  // ── ۵. لب‌ها و شیار میان لب و چانه
  const lipWidth = 0.16 + head.lipFullness * 0.06;
  const lipVolume = 0.004 + head.lipFullness * 0.007;
  push(0, 0, -lipVolume * 0.45 * bump(fx, fy, 0, -0.64, lipWidth, 0.1) * front);
  push(0, 0, 0.0035 * bump(fx, fy, 0, -0.64, lipWidth * 0.95, 0.016) * front);
  // گوشهٔ لب و شیار بینی-لبی
  push(0, 0, -0.002 * (bump(fx, fy, -0.24, -0.42, 0.07, 0.1) + bump(fx, fy, 0.24, -0.42, 0.07, 0.1)) * front);
  // شیار زیر لب
  push(0, 0, 0.003 * bump(fx, fy, 0, -0.76, 0.13, 0.03) * front);

  // ── ۶. پشت سر: صافیِ پس‌سری و برجستگیِ پس‌سری
  if (fz > 0) {
    target.z *= 1 - 0.1 * smoothstep(0.3, 1, fz);
  }
  push(0, 0, 0.007 * bump(fx, fy, 0, 0.05, 0.5, 0.4) * smoothstep(0.25, 0.85, fz));

  // ── ۷. شقیقه‌ها و بالای جمجمه
  target.x *= 1 + 0.035 * smoothstep(0.35, 0.9, fy);

  return target;
}

/**
 * ضریب چین‌وچروک پوست برای بافت (نه هندسه)؛ با سن بالا می‌رود.
 */
export function ageWrinkleStrength(look: HumanLook): number {
  return THREE.MathUtils.clamp(0.15 + look.age * 0.9, 0, 1);
}

/** ارتفاع استاندارد چشم کاراکتر ایستادهٔ پلیر از کف پا (متر) — هماهنگ با دوربین اول‌شخص و شبکهٔ حضور */
export const DEFAULT_PLAYER_EYE_HEIGHT = 1.65;

/** مرکز مفصل جمجمه در فضای پایهٔ بدون مقیاس HumanAvatar */
export const HUMAN_HEAD_CENTER_Y = 1.592;

/** جابه‌جایی عمودی مرکز مردمک نسبت به نقطهٔ سطح کاسهٔ چشم در HumanAvatar */
export const HUMAN_EYE_VERTICAL_OFFSET = -0.0005;

/** ارتفاع تاج سر بدون مقیاس در HumanAvatar (مرجع محاسبهٔ ضریب مقیاس قد) */
export function getHumanStandingTop(head: HeadMorphology): number {
  return HUMAN_HEAD_CENTER_Y + head.height * 1.06 + 0.012;
}

/** ارتفاع مرکز مردمک چشم‌ها بدون مقیاس از کف پا در HumanAvatar */
export function getHumanUnscaledEyeY(head: HeadMorphology): number {
  const anchors = resolveHeadAnchors(head);
  const eyeSurface = sculptHead(anchors.eyeL.clone().normalize(), head);
  return HUMAN_HEAD_CENTER_Y + eyeSurface.y + HUMAN_EYE_VERTICAL_OFFSET;
}

/** ارتفاع دقیق جهان‌فضای مردمک چشم کاراکتر ایستاده از کف پا (y = 0) برای هر HumanLook */
export function getHumanEyeHeight(look: Pick<HumanLook, 'heightMeters' | 'head'>): number {
  const standingTop = getHumanStandingTop(look.head);
  const scale = look.heightMeters / standingTop;
  return getHumanUnscaledEyeY(look.head) * scale;
}

/** محاسبهٔ قد ایستاده (متر) به‌گونه‌ای که مردمک چشم دقیقاً روی targetEyeHeight بنشیند */
export function calibrateHumanHeightForEyeLevel(
  head: HeadMorphology,
  targetEyeHeight = DEFAULT_PLAYER_EYE_HEIGHT,
): number {
  const standingTop = getHumanStandingTop(head);
  const unscaledEyeY = getHumanUnscaledEyeY(head);
  return targetEyeHeight * (standingTop / unscaledEyeY);
}

