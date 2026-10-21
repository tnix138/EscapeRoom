/**
 * audio-preferences.ts — مدل خالص صدا و زیرنویس (موج ۸)
 * ----------------------------------------------------------
 * همهٔ محاسبات حجم صدا، بی‌صدا کردن و کلیدهای میان‌بر اینجا زندگی می‌کنند تا هم
 * لایهٔ رابط و هم تست‌های node از یک منبع حقیقت بخوانند.
 */

export const VOLUME_STEP = 0.1;
export const MIN_VOLUME = 0;
export const MAX_VOLUME = 1;
export const DEFAULT_VOLUME = 0.7;

/** ذخیرهٔ ترجیحات در همین مرورگر؛ نسخه‌دار تا تغییر ساختار داده را نشکند. */
export const PREFERENCES_KEY = 'orfeo:av-prefs';
export const PREFERENCES_VERSION = 1;

export interface AudioPreferences {
  muted: boolean;
  volume: number;
  captions: boolean;
}

export const DEFAULT_PREFERENCES: AudioPreferences = {
  muted: false,
  volume: DEFAULT_VOLUME,
  captions: true,
};

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianNumber(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

/** هر ورودی نامعتبر به DEFAULT_VOLUME برمی‌گردد تا صدا ناگهان صفر نشود. */
export function clampVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(MAX_VOLUME, Math.max(MIN_VOLUME, Math.round(value * 100) / 100));
}

/** تغییر پله‌ای صدا؛ نتیجه همیشه در بازهٔ مجاز و با دو رقم اعشار است. */
export function stepVolume(current: unknown, delta: number): number {
  const base = clampVolume(current);
  const step = Number.isFinite(delta) ? delta : 0;
  return clampVolume(base + step);
}

/** «۷۰٪» برای نمایش؛ صفر صفر می‌ماند. */
export function volumePercentLabel(volume: unknown): string {
  return `${toPersianNumber(Math.round(clampVolume(volume) * 100))}٪`;
}

/** آیا با این کلید باید صدا بی‌صدا/باصدا شود؟ (M ثابت است) */
export function isMuteKey(key: string): boolean {
  return key === 'm' || key === 'M' || key === 'م';
}

/** آیا با این کلید زیرنویس روشن/خاموش می‌شود؟ (C) */
export function isCaptionKey(key: string): boolean {
  return key === 'c' || key === 'C' || key === 'ث';
}

/**
 * کلیدهایی که در فیلدهای متنی باید نادیده گرفته شوند.
 * ورودی‌ها به‌صورت دادهٔ ساده گرفته می‌شوند تا تابع در node هم تست شود.
 */
export function isTypingTarget(target: { tagName?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION';
}

export type AudioShortcutAction =
  | { type: 'toggle-mute' }
  | { type: 'toggle-captions' }
  | { type: 'volume'; volume: number };

/**
 * کلید فشرده‌شده را به اقدام صوتی تبدیل می‌کند.
 * فلش‌ها ۱۰٪ کم/زیاد می‌کنند و صدا را از حالت بی‌صدا خارج می‌کنند.
 */
export function resolveAudioShortcut(
  event: {
    key: string;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    target?: { tagName?: string; isContentEditable?: boolean } | null;
  },
  preferences: AudioPreferences,
): AudioShortcutAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (isTypingTarget(event.target)) return null;

  if (isMuteKey(event.key)) return { type: 'toggle-mute' };
  if (isCaptionKey(event.key)) return { type: 'toggle-captions' };

  if (event.key === 'ArrowUp') {
    const volume = Math.max(MIN_VOLUME, stepVolume(preferences.volume, VOLUME_STEP));
    return { type: 'volume', volume };
  }
  if (event.key === 'ArrowDown') {
    const volume = Math.min(MAX_VOLUME, stepVolume(preferences.volume, -VOLUME_STEP));
    return { type: 'volume', volume };
  }
  return null;
}

/** سوییچ بی‌صدا؛ حجم قبلی حفظ می‌شود تا باصدا کردن دقیقاً همان صدا را برگرداند. */
export function toggleMute(preferences: AudioPreferences): AudioPreferences {
  if (!preferences.muted) {
    return { ...preferences, muted: true };
  }
  return {
    ...preferences,
    muted: false,
    volume: preferences.volume > 0 ? preferences.volume : DEFAULT_VOLUME,
  };
}

/** آیا صدا در عمل شنیده می‌شود؟ (بی‌صدا یا حجم صفر = خاموش) */
export function isAudible(preferences: AudioPreferences): boolean {
  return !preferences.muted && clampVolume(preferences.volume) > 0;
}

export function describeAudioState(preferences: AudioPreferences): string {
  if (!isAudible(preferences)) {
    return preferences.volume <= 0 ? 'صدا خاموش است؛ با کلید M یا دکمهٔ صدا روشنش کنید.' : 'صدا بی‌صدا شده است.';
  }
  return `صدا روشن است؛ بلندی ${volumePercentLabel(preferences.volume)}.`;
}

/** متن اعلام زیرنویس برای ناحیهٔ زنده. */
export function describeCaptionState(captions: boolean): string {
  return captions ? 'زیرنویس روشن است.' : 'زیرنویس خاموش است.';
}

/* --------------------------------------------------------------------------
 * ذخیره‌سازی امن
 * -------------------------------------------------------------------------- */

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/** خواندن ترجیحات؛ خرابی/نسخهٔ ناشناس به مقدار پیش‌فرض برمی‌گردد. */
export function parsePreferences(raw: string | null | undefined): AudioPreferences {
  if (!raw) return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = JSON.parse(raw) as Partial<AudioPreferences> & { v?: number };
    if (parsed?.v !== PREFERENCES_VERSION) return { ...DEFAULT_PREFERENCES };
    return {
      muted: parsed.muted === true,
      volume: clampVolume(parsed.volume),
      captions: parsed.captions !== false,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function serializePreferences(preferences: AudioPreferences): string {
  return JSON.stringify({
    v: PREFERENCES_VERSION,
    muted: preferences.muted === true,
    volume: clampVolume(preferences.volume),
    captions: preferences.captions !== false,
  });
}

export function readPreferences(storage: StorageLike | null | undefined): AudioPreferences {
  if (!storage) return { ...DEFAULT_PREFERENCES };
  try {
    return parsePreferences(storage.getItem(PREFERENCES_KEY));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function writePreferences(
  storage: StorageLike | null | undefined,
  preferences: AudioPreferences,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PREFERENCES_KEY, serializePreferences(preferences));
    return true;
  } catch {
    return false;
  }
}
