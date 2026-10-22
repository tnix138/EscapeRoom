// src/engine3d/characters/human-presets.ts — هویت بصری و ریخت‌شناسی سرِ انسان‌های بازی
//
// چرا جدا از هندسه؟ تا هم تست‌های Node (بدون WebGL) بتوانند تنوع چهره‌ها را بسنجند،
// هم پنل ادمین و پیش‌نمایش بتوانند فقط با اعداد یک «چهره» را توصیف کنند.
// همهٔ مقادیر قطعی (deterministic) هستند: هر playerId همیشه همان چهره را می‌گیرد،
// پس دو فریم از یک بازیکن هرگز دو چهرهٔ متفاوت نشان نمی‌دهد.

export type HairStyle = 'slick' | 'wavy' | 'bun' | 'short' | 'curly' | 'long';
export type FacialHair = 'none' | 'stubble' | 'moustache' | 'beard';
export type FaceAccessory = 'none' | 'glasses' | 'earring' | 'pocket-watch';

export interface HeadMorphology {
  /** نیم‌عرض جمجمه (متر) */
  width: number;
  /** نیم‌ارتفاع جمجمه */
  height: number;
  /** نیم‌عمق (پشت سر تا نوک بینی) */
  depth: number;
  /** پهنای فک؛ ۰ = باریک/بیضی، ۱ = پهن و مربعی */
  jawWidth: number;
  /** بلندی چانه؛ ۰ = کوتاه، ۱ = بلند */
  chinLength: number;
  /** برجستگی استخوان گونه */
  cheekbone: number;
  /** برجستگی تیغهٔ ابرو */
  browRidge: number;
  /** بلندی و قوس بینی */
  noseLength: number;
  /** پهنای بال بینی */
  noseWidth: number;
  /** گوشتی بودن نوک بینی */
  noseTip: number;
  /** فاصلهٔ چشم‌ها از خط وسط */
  eyeSpacing: number;
  /** اندازهٔ کرهٔ چشم */
  eyeSize: number;
  /** پر بودن لب‌ها */
  lipFullness: number;
  /** اندازهٔ گوش */
  earSize: number;
  /** پیش‌آمدگی فک پایین (۰ = عقب، ۱ = جلو) */
  jawForward: number;
}

export interface HumanLook {
  id: string;
  displayName: string;
  /** ویژگی‌های زنانه: خط فک نرم‌تر، لب پرتر، ابروی قوس‌دار */
  feminine: boolean;
  /** ۰ = جوان، ۱ = سالخورده؛ چین‌ها، تیرگی زیر چشم و سفیدی مو را کنترل می‌کند */
  age: number;
  heightMeters: number;
  /** ۰٫۹ = لاغر، ۱٫۱ = تنومند */
  build: number;
  skinHex: number;
  hairHex: number;
  coatHex: number;
  trouserHex: number;
  shirtHex: number;
  cravatHex: number;
  shoeHex: number;
  eyeHex: number;
  head: HeadMorphology;
  hair: { style: HairStyle; volume: number; sidePart: number };
  facialHair: FacialHair;
  accessory: FaceAccessory;
  /** جزئیات تصادفی چهره: خال، کک‌ومک، عدم تقارن ابرو */
  marks: { mole: boolean; freckles: boolean; asymmetricBrow: number };
}

const COAT_HEX = [0x5b2a86, 0x1f5f7a, 0x7a1626, 0x2e6b34, 0x8a6a24, 0x37474f, 0x6d3b1f, 0x7a2e5f] as const;
const SKIN_TONES = [0xe7c4a5, 0xd9ad87, 0xf0d3b8, 0xc99a72, 0xe2b592, 0x8d5f42] as const;
const HAIR_TONES = [0x221710, 0x3b2516, 0x151218, 0x4d311d, 0x2c221b, 0x6b4a2b] as const;
const CRAVAT_TONES = [0x8b1e2f, 0xc9a86a, 0x284b63, 0x5c2751, 0x3d5a45] as const;
const EYE_TONES = [0x4a2c17, 0x2f4f63, 0x3f6b4a, 0x5a3b22, 0x33414f] as const;

const NAMES = [
  'سارا', 'مریم', 'نیما', 'کیان', 'لیلا', 'توحید', 'امیرعلی', 'علیرضا',
] as const;

const HAIR_STYLES: readonly HairStyle[] = ['slick', 'wavy', 'bun', 'short', 'curly', 'long'];
const FACIAL_HAIR: readonly FacialHair[] = ['none', 'stubble', 'none', 'moustache', 'beard', 'none'];

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

/** مولد شبه‌تصادفی قطعی و ارزان؛ خروجی در بازهٔ [0,1) */
function makeRandom(seed: number): () => number {
  let state = (seed || 0x9e3779b9) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length) % items.length] as T;
}

function baseHead(feminine: boolean, random: () => number): HeadMorphology {
  return {
    width: feminine ? between(random, 0.068, 0.074) : between(random, 0.074, 0.082),
    height: between(random, 0.108, 0.116),
    depth: between(random, 0.088, 0.095),
    jawWidth: feminine ? between(random, 0.12, 0.32) : between(random, 0.42, 0.72),
    chinLength: feminine ? between(random, 0.18, 0.4) : between(random, 0.36, 0.62),
    cheekbone: between(random, 0.25, 0.6),
    browRidge: feminine ? between(random, 0.08, 0.25) : between(random, 0.35, 0.7),
    noseLength: between(random, 0.3, 0.62),
    noseWidth: between(random, 0.25, 0.55),
    noseTip: between(random, 0.2, 0.5),
    eyeSpacing: between(random, 0.3, 0.4),
    eyeSize: between(random, 0.8, 0.96),
    lipFullness: feminine ? between(random, 0.55, 0.85) : between(random, 0.25, 0.55),
    earSize: between(random, 0.85, 1.12),
    jawForward: between(random, 0.2, 0.55),
  };
}

/**
 * چهرهٔ یک بازیکن را می‌سازد. اگر seatIndex بدهی، چهره به صندلی گره می‌خورد؛
 * وگرنه از خود playerId مشتق می‌شود. هر بار خروجی یکسان است.
 */
export function resolveHumanLook(
  playerId: string,
  seatIndex?: number,
  options: { name?: string; overrides?: Partial<HumanLook> } = {},
): HumanLook {
  const hasSeat = typeof seatIndex === 'number' && Number.isInteger(seatIndex) && seatIndex >= 0;
  const seedSource = hasSeat ? `seat:${seatIndex}` : `player:${playerId || 'guest'}`;
  const random = makeRandom(hashString(seedSource));
  const seat = hasSeat ? (seatIndex as number) : -1;
  const feminine = seat >= 0 ? seat === 0 || seat === 1 : random() < 0.4;

  const age = seat === 5 ? 0.72 : between(random, 0.06, 0.42);
  const head = baseHead(feminine, random);
  const style = seat >= 0 ? HAIR_STYLES[seat % HAIR_STYLES.length]! : pick(random, HAIR_STYLES);
  const facialHair: FacialHair = feminine
    ? 'none'
    : seat >= 0
      ? FACIAL_HAIR[seat % FACIAL_HAIR.length]!
      : pick(random, FACIAL_HAIR);

  const look: HumanLook = {
    id: seat >= 0 ? `seat-${seat + 1}` : playerId || 'guest',
    displayName: options.name ?? (seat >= 0 ? (NAMES[seat] ?? `هم‌تیمی ${seat + 1}`) : 'هم‌تیمی'),
    feminine,
    age,
    heightMeters: feminine ? between(random, 1.58, 1.71) : between(random, 1.7, 1.86),
    build: between(random, 0.92, 1.08),
    skinHex: SKIN_TONES[(seat >= 0 ? seat : Math.floor(random() * SKIN_TONES.length)) % SKIN_TONES.length]!,
    hairHex: HAIR_TONES[(seat >= 0 ? seat + 1 : Math.floor(random() * HAIR_TONES.length)) % HAIR_TONES.length]!,
    coatHex: COAT_HEX[(seat >= 0 ? seat : Math.floor(random() * COAT_HEX.length)) % COAT_HEX.length]!,
    trouserHex: 0x1b1922,
    shirtHex: 0xefe6d6,
    cravatHex: CRAVAT_TONES[(seat >= 0 ? seat + 2 : Math.floor(random() * CRAVAT_TONES.length)) % CRAVAT_TONES.length]!,
    shoeHex: 0x14100f,
    eyeHex: EYE_TONES[(seat >= 0 ? seat + 1 : Math.floor(random() * EYE_TONES.length)) % EYE_TONES.length]!,
    head,
    hair: {
      style,
      volume: between(random, 0.85, 1.25),
      sidePart: between(random, -0.35, 0.35),
    },
    facialHair,
    accessory:
      seat === 3 ? 'glasses' : seat === 6 ? 'earring' : seat === 7 ? 'pocket-watch' : 'none',
    marks: {
      mole: random() < 0.45,
      freckles: random() < 0.3,
      asymmetricBrow: between(random, -0.5, 0.5),
    },
  };

  return options.overrides ? { ...look, ...options.overrides } : look;
}

/** هشت چهرهٔ پیش‌فرض صندلی‌ها؛ برای نمایشگاه ادمین و صحنهٔ پیش‌نمایش */
export const DEFAULT_HUMAN_LOOKS: readonly HumanLook[] = Array.from(
  { length: 8 },
  (_, seatIndex) =>
    resolveHumanLook(`seat-${seatIndex + 1}`, seatIndex, {
      name: NAMES[seatIndex] ?? `هم‌تیمی ${seatIndex + 1}`,
    }),
);

export const HUMAN_LOOK_COUNT = DEFAULT_HUMAN_LOOKS.length;
