// src/components/admin/character-presets.ts — داده‌های ثابت کاراکترهای پلیر و کالبدشکافی مدل انسان
// ماژول خالص مشترک بین سرور و کلاینت (بدون وابستگی به Three.js) تا هم در Server Component (/admin)
// و هم در Client Component (/admin/characters) بدون خطای RSC Proxy اجرا شود.
import { faDigits } from './format';

export interface PlayerCharacterPreset {
  seatIndex: number;
  seatLabel: string;
  row: number;
  col: number;
  archetypeName: string;
  coatLabel: string;
  coatHex: string;
  skinHex: string;
  hairHex: string;
  cravatHex: string;
  hairStyleLabel: string;
}

const SEAT_COAT_HEX = [
  '#5b2a86',
  '#1f5f7a',
  '#7a1626',
  '#2e6b34',
  '#8a6a24',
  '#37474f',
  '#6d3b1f',
  '#7a2e5f',
] as const;

const SKIN_HEX = ['#e4be9c', '#d9ad87', '#ecd0b6', '#cf9f78', '#e0b592'] as const;
const HAIR_HEX = ['#221710', '#3b2516', '#151218', '#4d311d', '#2c221b'] as const;
const CRAVAT_HEX = ['#8b1e2f', '#c9a86a', '#284b63', '#5c2751', '#3d5a45'] as const;

const COAT_NAMES = [
  'بنفش سلطنتی',
  'آبی نفتی تالار',
  'زرشکی مخملی',
  'سبز زمردی',
  'طلایی عتیقه',
  'سربی تیره',
  'قهوه‌ای ماهون',
  'ارغوانی شبانه',
] as const;

const ARCHETYPE_NAMES = [
  'سارا (صندلی ۱)',
  'مریم (صندلی ۲)',
  'نیما (صندلی ۳)',
  'کیان (صندلی ۴)',
  'لیلا (صندلی ۵)',
  'توحید (صندلی ۶)',
  'امیرعلی (صندلی ۷)',
  'علیرضا (صندلی ۸)',
] as const;

const HAIR_STYLE_LABELS = [
  'کلاسیک فرق‌دار',
  'موج‌دار بلند',
  'جمع‌شده بالای سر',
] as const;

function hashString(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

export const PLAYER_CHARACTER_PRESETS: readonly PlayerCharacterPreset[] = Array.from(
  { length: 8 },
  (_, seatIndex) => {
    const hash = hashString(`seat-${seatIndex + 1}`);
    const row = Math.floor(seatIndex / 5) + 1;
    const col = (seatIndex % 5) + 1;
    return {
      seatIndex,
      seatLabel: `ردیف ${faDigits(row)} · صندلی ${faDigits(col)}`,
      row,
      col,
      archetypeName: ARCHETYPE_NAMES[seatIndex] ?? `هم‌تیمی ${seatIndex + 1}`,
      coatLabel: COAT_NAMES[seatIndex % COAT_NAMES.length] ?? 'کت کلاسیک',
      coatHex: SEAT_COAT_HEX[seatIndex % SEAT_COAT_HEX.length] ?? '#5b2a86',
      skinHex: SKIN_HEX[seatIndex % SKIN_HEX.length] ?? '#e4be9c',
      hairHex: HAIR_HEX[(seatIndex + (hash % 3)) % HAIR_HEX.length] ?? '#221710',
      cravatHex: CRAVAT_HEX[seatIndex % CRAVAT_HEX.length] ?? '#8b1e2f',
      hairStyleLabel: HAIR_STYLE_LABELS[seatIndex % HAIR_STYLE_LABELS.length] ?? 'کلاسیک',
    };
  },
);

export const HUMAN_ANATOMY_PARTS: ReadonlyArray<{
  partId: string;
  title: string;
  details: string;
}> = [
  {
    partId: 'avatar-head',
    title: 'سر، گردن و اجزای چهره',
    details: 'جمجمه بیضی با خط فک، گردن، دو گوش، بینی، دو چشم (صلبیه و مردمک)، ابروها و لب‌ها',
  },
  {
    partId: 'avatar-hair',
    title: 'موی سه‌بخشی سر',
    details: 'کلاهک بالای سر، حجم پشت گردن و چتری پیشانی با ۵ طیف رنگ طبیعی مو',
  },
  {
    partId: 'avatar-body',
    title: 'تنه، کت تئاتر و یقه',
    details: 'قفسه سینه با تناسب طبیعی شانه، دامن کت، یقه برگردان، پیراهن، دستمال گردن و سنجاق طلایی بلیط',
  },
  {
    partId: 'avatar-arm-left / right',
    title: 'دو دست مفصل‌دار',
    details: 'شانه، بازو، ساعد، سرآستین سفید پیراهن و کف دست با انیمیشن تاب خوردن هنگام راه رفتن',
  },
  {
    partId: 'avatar-leg-left / right',
    title: 'دو پای مفصل‌دار و کفش',
    details: 'ران، ساق شلوار و کفش چرمی روی سطح زمین (y = 0) با سیکل گام‌برداری و حالت نشسته',
  },
  {
    partId: 'avatar-name',
    title: 'پلاک نام شناور (Sprite)',
    details: 'بوم فارسی راست‌به‌چپ با قاب طلایی بالای سر کاراکتر در ارتفاع ۲٫۰۸ متر',
  },
];
