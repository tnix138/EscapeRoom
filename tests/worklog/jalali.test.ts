import { describe, expect, it } from 'vitest';

import {
  jalaliDisplay,
  jalaliMonthName,
  jalaliStamp,
  jalaliTehranToIso,
  tehranParts,
  toIsoUtc,
  toJalali,
  toPersianDigits,
} from '../../scripts/worklog/lib/jalali.mjs';

describe('تاریخ شمسی — تبدیل و اعتبارسنجی', () => {
  it('تاریخ‌های شاخص میلادی را درست به شمسی تبدیل می‌کند', () => {
    expect(toJalali(2026, 3, 21)).toEqual({ jy: 1405, jm: 1, jd: 1 });
    expect(toJalali(2025, 3, 21)).toEqual({ jy: 1404, jm: 1, jd: 1 });
    expect(toJalali(2024, 3, 20)).toEqual({ jy: 1403, jm: 1, jd: 1 });
    expect(toJalali(2026, 10, 21)).toEqual({ jy: 1405, jm: 7, jd: 29 });
    expect(toJalali(2027, 3, 21)).toEqual({ jy: 1406, jm: 1, jd: 1 });
  });

  it('ساعت ایران را با آفست ثابت +۰۳:۳۰ محاسبه می‌کند', () => {
    const parts = tehranParts(new Date('2026-10-21T12:40:45.000Z'));
    expect(parts.jalali).toBe('1405-07-29');
    expect(parts.time).toBe('16:10:45');
    expect(parts.jy).toBe(1405);
    expect(parts.jm).toBe(7);
    expect(parts.jd).toBe(29);
  });

  it('نیمه‌شب UTC روز بعد در ایران، تاریخ شمسی بعدی است', () => {
    expect(tehranParts(new Date('2026-10-21T20:30:00.000Z')).jalali).toBe('1405-07-30');
    expect(tehranParts(new Date('2026-10-21T20:29:59.000Z')).jalali).toBe('1405-07-29');
  });

  it('تبدیل شمسی → UTC دقیقاً همان لحظه را برمی‌گرداند (رفت و برگشت)', () => {
    const iso = '2026-10-21T13:05:38.000Z';
    const { jalali, time } = jalaliStamp(iso);
    expect(jalaliTehranToIso(jalali, time)).toBe(iso);
  });

  it('برای همه ساعت‌های یک روز، رفت و برگشت پایدار است', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const iso = toIsoUtc(new Date(Date.UTC(2026, 9, 21, hour, 17, 9)));
      const { jalali, time } = jalaliStamp(iso);
      expect(jalaliTehranToIso(jalali, time)).toBe(iso);
    }
  });

  it('زمان ناهم‌خوان شمسی/UTC را رد می‌کند', () => {
    expect(() => jalaliTehranToIso('1405-07-29', '99:00:00')).toThrow();
    expect(() => jalaliTehranToIso('1405-07-29', '25:00:00')).toThrow();
    expect(() => jalaliTehranToIso('bad', '10:00:00')).toThrow();
  });

  it('ارقام فارسی و نمایش تاریخ را درست تولید می‌کند', () => {
    expect(jalaliDisplay('1405-07-29')).toBe('۱۴۰۵/۰۷/۲۹');
    expect(toPersianDigits('PR #13')).toBe('PR #۱۳');
    expect(jalaliMonthName(7)).toBe('مهر');
    expect(jalaliMonthName(12)).toBe('اسفند');
  });

  it('ISO خروجی همیشه با میلی‌ثانیه و Z است', () => {
    expect(toIsoUtc(new Date('2026-10-21T13:05:38Z'))).toBe('2026-10-21T13:05:38.000Z');
    expect(() => toIsoUtc('not-a-date' as unknown as Date)).toThrow();
  });
});
