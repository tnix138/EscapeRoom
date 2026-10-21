// تست قرارداد ترس (فاز ۰۷) — آنبلاک علیرضا (#90) و امیرعلی (#91)
import { describe, expect, it } from 'vitest';
import {
  HORROR_THRESHOLDS,
  createHorrorSignal,
  horrorLevelFromDistance,
  horrorLevelFromThreat,
  isHorrorIntensity,
  maxHorrorIntensity,
  normalizeHorrorIntensity,
  parseHorrorSignal,
} from '../../src/contracts/horror';

describe('قرارداد ترس — نگهبان‌ها', () => {
  it('سه سطح مجاز را می‌شناسد و بقیه را رد می‌کند', () => {
    expect(isHorrorIntensity('calm')).toBe(true);
    expect(isHorrorIntensity('tense')).toBe(true);
    expect(isHorrorIntensity('panic')).toBe(true);
    expect(isHorrorIntensity('TERROR')).toBe(false);
    expect(isHorrorIntensity(2)).toBe(false);
    expect(isHorrorIntensity(null)).toBe(false);
    expect(isHorrorIntensity(undefined)).toBe(false);
  });

  it('سطح ناشناخته به calm برمی‌گردد تا HUD نشکند', () => {
    expect(normalizeHorrorIntensity('explode')).toBe('calm');
    expect(normalizeHorrorIntensity('panic')).toBe('panic');
  });
});

describe('قرارداد ترس — تبدیل تهدید به سطح', () => {
  it('آستانه‌ها را دقیق رعایت می‌کند', () => {
    expect(horrorLevelFromThreat(0)).toBe('calm');
    expect(horrorLevelFromThreat(HORROR_THRESHOLDS.tense - 0.01)).toBe('calm');
    expect(horrorLevelFromThreat(HORROR_THRESHOLDS.tense)).toBe('tense');
    expect(horrorLevelFromThreat(HORROR_THRESHOLDS.panic - 0.01)).toBe('tense');
    expect(horrorLevelFromThreat(HORROR_THRESHOLDS.panic)).toBe('panic');
    expect(horrorLevelFromThreat(1)).toBe('panic');
  });

  it('مقادیر بیرون بازه و NaN را به امن‌ترین حالت می‌برد', () => {
    expect(horrorLevelFromThreat(-5)).toBe('calm');
    expect(horrorLevelFromThreat(9)).toBe('panic');
    expect(horrorLevelFromThreat(Number.NaN)).toBe('calm');
    expect(horrorLevelFromThreat(Number.POSITIVE_INFINITY)).toBe('calm');
  });

  it('فاصله تا خطر را به سطح ترس تبدیل می‌کند', () => {
    expect(horrorLevelFromDistance(2)).toBe('panic');
    expect(horrorLevelFromDistance(10)).toBe('tense');
    expect(horrorLevelFromDistance(14)).toBe('calm');
    expect(horrorLevelFromDistance(40)).toBe('calm');
    expect(horrorLevelFromDistance(3.5, { nearM: 4, farM: 4.5 })).toBe('panic');
    expect(horrorLevelFromDistance(Number.NaN)).toBe('calm');
    // بازهٔ معکوس نباید باعث تقسیم بر صفر شود
    expect(horrorLevelFromDistance(2, { nearM: 10, farM: 5 })).toBe('panic');
    expect(horrorLevelFromDistance(12, { nearM: 10, farM: 5 })).toBe('calm');
  });

  it('ترکیب چند منبع ترس، شدیدترین را انتخاب می‌کند', () => {
    expect(maxHorrorIntensity('calm', 'tense')).toBe('tense');
    expect(maxHorrorIntensity('panic', 'tense')).toBe('panic');
    expect(maxHorrorIntensity('calm', 'calm')).toBe('calm');
  });
});

describe('قرارداد ترس — سیگنال و اعتبارسنجی', () => {
  it('سیگنال معتبر را می‌سازد و تجزیه می‌کند', () => {
    const signal = createHorrorSignal('tense', 1_700_000_000_000);
    expect(signal).toEqual({ level: 'tense', at: 1_700_000_000_000 });
    expect(parseHorrorSignal(signal)).toEqual(signal);
  });

  it('ورودی نامعتبر (سطح ناشناخته یا زمان منفی) را رد می‌کند', () => {
    expect(parseHorrorSignal({ level: 'boom', at: 1 })).toBeNull();
    expect(parseHorrorSignal({ level: 'calm', at: -1 })).toBeNull();
    expect(parseHorrorSignal({ level: 'calm', at: 1.5 })).toBeNull();
    expect(parseHorrorSignal(null)).toBeNull();
    expect(parseHorrorSignal('panic')).toBeNull();
  });

  it('سطح نامعتبر هنگام ساخت سیگنال به calm تبدیل می‌شود', () => {
    // @ts-expect-error ورودی نامعتبر عمدی است تا رفتار لایهٔ مرزی بررسی شود
    expect(createHorrorSignal('unknown', 5).level).toBe('calm');
  });
});
