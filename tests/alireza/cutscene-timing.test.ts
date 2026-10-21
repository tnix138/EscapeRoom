/**
 * تست‌های موج ۲ علیرضا — زمان‌بندی خالص کات‌سین دربان و سالن (cutscene-timing)
 * اجرای تست‌ها: npm run test:alireza
 * این تست‌ها جزئیات کارگردانی TASKS-ALIREZA.md موج ۲ را ثانیه‌به‌ثانیه قفل می‌کنند.
 */

import { describe, expect, it } from 'vitest';
import {
  clamp01,
  easeInOutCubic,
  easeOutCubic,
  getAuditoriumTimeline,
  getDoorTimeline,
  progressBetween,
  teammateSettleProgress,
} from '../../src/components/cinema/cutscene-timing';

describe('ابزارهای پایه زمان‌بندی', () => {
  it('progressBetween قبل از شروع 0، وسط 0.5 و بعد از پایان 1 است', () => {
    expect(progressBetween(900, 1_000, 2_000)).toBe(0);
    expect(progressBetween(1_500, 1_000, 2_000)).toBe(0.5);
    expect(progressBetween(2_500, 1_000, 2_000)).toBe(1);
    expect(progressBetween(Number.NaN, 1_000, 2_000)).toBe(0);
  });

  it('ایزینگ‌ها در دو سر بازه روی 0 و 1 می‌نشینند و یکنواخت صعودی‌اند', () => {
    for (const ease of [easeInOutCubic, easeOutCubic]) {
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
      let prev = -Infinity;
      for (let i = 0; i <= 20; i++) {
        const v = ease(i / 20);
        expect(v).toBeGreaterThanOrEqual(prev);
        expect(clamp01(v)).toBe(v);
        prev = v;
      }
    }
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6);
  });
});

describe('کات‌سین دربان — 0 تا 11 ثانیه (موج ۲ بند ۱)', () => {
  it('در لحظه صفر همه‌چیز بسته و تاریک است', () => {
    const tl = getDoorTimeline(0);
    expect(tl.peepholeOpen).toBe(0);
    expect(tl.lockReleased).toBe(0);
    expect(tl.doorCrack).toBe(0);
    expect(tl.usherReveal).toBe(0);
    expect(tl.handExtend).toBe(0);
    expect(tl.doorsFullOpen).toBe(0);
  });

  it('ترتیب سکانس رعایت می‌شود: دریچه ← قفل ← شکاف در ← دربان', () => {
    expect(getDoorTimeline(2_000).peepholeOpen).toBe(1);
    expect(getDoorTimeline(2_600).lockReleased).toBe(1);
    const at3s = getDoorTimeline(3_000);
    expect(at3s.doorCrack).toBeGreaterThan(0);
    expect(at3s.usherReveal).toBeLessThan(0.5);
    expect(getDoorTimeline(4_800).usherReveal).toBe(1);
    expect(getDoorTimeline(4_800).interiorLightSpill).toBeGreaterThan(0.9);
  });

  it('دست بازیکن بعد از ظاهر شدن دربان جلو می‌رود و بلیط در ۹ ثانیه کامل تحویل داده شده است', () => {
    expect(getDoorTimeline(5_800).handExtend).toBe(0);
    expect(getDoorTimeline(8_000).handExtend).toBe(1);
    expect(getDoorTimeline(8_500).ticketHandover).toBeCloseTo(0.5, 1);
    expect(getDoorTimeline(9_000).ticketHandover).toBe(1);
  });

  it('دربان فقط پس از تحویل بلیط کنار می‌رود و در در پایان کاملاً باز است', () => {
    expect(getDoorTimeline(8_800).usherStepAside).toBe(0);
    expect(getDoorTimeline(10_200).usherStepAside).toBe(1);
    const end = getDoorTimeline(11_000);
    expect(end.doorsFullOpen).toBe(1);
    expect(end.cameraPush).toBe(1);
  });

  it('سر تکان دادن دربان در دو لحظه سلام (۴.۸s) و تشکر (۸.۶s) رخ می‌دهد و بین آن‌ها صفر است', () => {
    expect(getDoorTimeline(5_400).usherNodDeg).toBeGreaterThan(4);
    expect(getDoorTimeline(7_000).usherNodDeg).toBe(0);
    expect(getDoorTimeline(9_200).usherNodDeg).toBeGreaterThan(6);
  });

  it('فانوس همیشه در بازه امن سوسو می‌زند و پیشرفت در در کل سکانس یکنواخت است', () => {
    let prevOpen = -Infinity;
    for (let t = 0; t <= 11_000; t += 250) {
      const tl = getDoorTimeline(t);
      expect(tl.lanternFlicker).toBeGreaterThanOrEqual(0);
      expect(tl.lanternFlicker).toBeLessThanOrEqual(1);
      expect(tl.doorsFullOpen).toBeGreaterThanOrEqual(prevOpen);
      prevOpen = tl.doorsFullOpen;
    }
  });
});

describe('ورود و نشستن در سالن ۲۰ نفره — 11 تا 21 ثانیه (موج ۲ بند ۲)', () => {
  it('دوربین اول وارد می‌شود و تا ۲۱ ثانیه کاملاً نشسته است و سالن تاریک شده', () => {
    expect(getAuditoriumTimeline(11_000).entryProgress).toBe(0);
    expect(getAuditoriumTimeline(17_000).entryProgress).toBe(1);
    const at21 = getAuditoriumTimeline(21_000);
    expect(at21.seatedProgress).toBe(1);
    expect(at21.houseDimProgress).toBe(1);
    expect(at21.curtainOpenProgress).toBe(0);
    expect(at21.chandelierGlow).toBeCloseTo(0.35, 2); // لوستر کم‌سو ولی خاموش نه
  });

  it('هم‌تیمی‌ها پلکانی می‌نشینند: صندلی‌های بعدی دیرتر از قبلی‌ها کامل می‌شوند', () => {
    const t = 13_000;
    expect(teammateSettleProgress(0, t)).toBeGreaterThan(teammateSettleProgress(4, t));
    expect(teammateSettleProgress(7, t)).toBeLessThan(teammateSettleProgress(0, t));
    // تا ۲۱ ثانیه نشستن هر ۸ نفر کامل شده است
    for (let seat = 0; seat < 8; seat++) {
      expect(teammateSettleProgress(seat, 21_000)).toBe(1);
    }
    // قبل از ورود به سالن کسی ننشسته است
    expect(teammateSettleProgress(0, 11_000)).toBe(0);
  });
});

describe('اجرای اپرا و مرد سیاه‌پوش — 21 تا 40 ثانیه (موج ۲ بند ۳)', () => {
  it('نورهای ضعیف قبل از باز شدن پرده کامل‌اند و پرده تا ۳۱ ثانیه کاملاً باز است', () => {
    expect(getAuditoriumTimeline(25_500).spotlightsProgress).toBe(1);
    expect(getAuditoriumTimeline(24_000).curtainOpenProgress).toBe(0);
    const mid = getAuditoriumTimeline(27_500).curtainOpenProgress;
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
    expect(getAuditoriumTimeline(31_000).curtainOpenProgress).toBe(1);
    expect(getAuditoriumTimeline(31_000).stageGlowProgress).toBe(1);
  });

  it('بانوی رقصنده فقط بعد از شروع باز شدن پرده ظاهر می‌شود و تا ۲۹.۵ ثانیه کامل پیداست', () => {
    expect(getAuditoriumTimeline(25_000).dancerReveal).toBe(0);
    expect(getAuditoriumTimeline(26_000).dancerReveal).toBe(0);
    expect(getAuditoriumTimeline(29_500).dancerReveal).toBe(1);
  });

  it('حرکت رقصنده پیوسته، کراندار و تابعی از زمان است (بدون پرش در Refresh)', () => {
    const samples = [30_000, 33_000, 36_000, 39_000].map(
      (t) => getAuditoriumTimeline(t).dancerTravelX,
    );
    samples.forEach((x) => {
      expect(x).toBeGreaterThanOrEqual(-1);
      expect(x).toBeLessThanOrEqual(1);
    });
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.3); // واقعاً رفت‌وآمد می‌کند
    expect(getAuditoriumTimeline(33_000).dancerSkirtFlare).toBeGreaterThan(0.9);
    expect(getAuditoriumTimeline(33_000).dancerSkirtFlare).toBeLessThan(1.1);
  });

  it('مرد سیاه‌پوش دقیقاً در بازه ۳۱ تا ۳۶ ثانیه در سایه چپ پیدا می‌شود و بعد ثابت می‌ماند', () => {
    expect(getAuditoriumTimeline(31_000).darkManReveal).toBe(0);
    const mid = getAuditoriumTimeline(33_500).darkManReveal;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(getAuditoriumTimeline(36_000).darkManReveal).toBe(1);
    // نگه‌داشتن وضعیت اجرای زنده بعد از پایان محدوده موج ۲ (تا تکمیل موج ۳)
    const later = getAuditoriumTimeline(49_000);
    expect(later.darkManReveal).toBe(1);
    expect(later.curtainOpenProgress).toBe(1);
    expect(later.dancerReveal).toBe(1);
  });

  it('تاب لوستر و نفس مرد سیاه‌پوش همیشه در بازه‌های امن می‌مانند', () => {
    for (let t = 11_000; t <= 60_000; t += 1_000) {
      const tl = getAuditoriumTimeline(t);
      expect(Math.abs(tl.chandelierSwayDeg)).toBeLessThanOrEqual(1.6);
      expect(tl.darkManBreath).toBeGreaterThanOrEqual(0);
      expect(tl.darkManBreath).toBeLessThanOrEqual(1);
    }
  });
});
