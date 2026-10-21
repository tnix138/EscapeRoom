/**
 * تست‌های موج ۲ علیرضا — زمان‌بندی خالص کات‌سین دربان و سالن (cutscene-timing)
 * اجرای تست‌ها: npm run test:alireza
 * این تست‌ها جزئیات کارگردانی TASKS-ALIREZA.md موج ۲ را ثانیه‌به‌ثانیه قفل می‌کنند.
 */

import { describe, expect, it } from 'vitest';
import {
  CHANDELIER_FALL_AT_MS,
  HAND_REJECTION_AT_MS,
  SLAM_IMPACTS,
  clamp01,
  easeInOutCubic,
  easeOutCubic,
  getAuditoriumTimeline,
  getDoorTimeline,
  progressBetween,
  teammateSettleProgress,
  victimPoseAt,
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

describe('نزدیک شدن مرد، دست زدن و پس زدن دست — 40 تا 50 ثانیه (موج ۳ بند ۱)', () => {
  it('مرد بین ۴۰ تا ۴۶ ثانیه از سایه به پایین سِن می‌رسد و فقط در همان پنجره دست می‌زند', () => {
    expect(getAuditoriumTimeline(40_000).manApproachProgress).toBe(0);
    expect(getAuditoriumTimeline(46_000).manApproachProgress).toBe(1);
    expect(getAuditoriumTimeline(42_000).manClapEnvelope).toBeGreaterThan(0.9);
    expect(getAuditoriumTimeline(46_000).manClapEnvelope).toBe(0);
    expect(Math.abs(getAuditoriumTimeline(42_500).manClapPhaseDeg)).toBeLessThanOrEqual(30);
  });

  it('دست مرد تا ۴۸.۵ ثانیه کامل دراز است و زن تا لحظه پس زدن آواز می‌خواند', () => {
    expect(getAuditoriumTimeline(45_500).manHandExtendProgress).toBe(0);
    expect(getAuditoriumTimeline(48_500).manHandExtendProgress).toBe(1);
    expect(getAuditoriumTimeline(48_000).womanMouthOpen).toBeGreaterThan(0);
    expect(getAuditoriumTimeline(50_000).womanMouthOpen).toBe(0);
  });

  it('پس زدن دست دقیقاً روی فریم قراردادی HAND_REJECTION_AT_MS شروع می‌شود', () => {
    expect(HAND_REJECTION_AT_MS).toBeGreaterThan(49_000);
    expect(HAND_REJECTION_AT_MS).toBeLessThan(50_000);
    expect(getAuditoriumTimeline(HAND_REJECTION_AT_MS).handRejectionProgress).toBe(0);
    expect(getAuditoriumTimeline(HAND_REJECTION_AT_MS + 500).handRejectionProgress).toBe(1);
  });
});

describe('واژگونی و عقب راندن پلیرها — 50 تا 56 ثانیه (موج ۳ بند ۲)', () => {
  it('واژگونی در ۵۰ ثانیه شروع و تا ۵۱.۵ کامل می‌شود و انرژی رقص را صفر می‌کند', () => {
    expect(getAuditoriumTimeline(50_000).inversionProgress).toBe(0);
    const after = getAuditoriumTimeline(51_500);
    expect(after.inversionProgress).toBe(1);
    expect(after.danceEnergy).toBe(0);
    expect(getAuditoriumTimeline(52_000).dancerTravelX).toBe(0);
    expect(getAuditoriumTimeline(54_500).stageGrimeProgress).toBe(1);
    expect(getAuditoriumTimeline(53_000).womanFearProgress).toBe(1);
  });

  it('پالس عقب راندن پلیرها در میانه بازه ۵۳ تا ۵۶ ثانیه به اوج می‌رسد و دو سرش صفر است', () => {
    expect(getAuditoriumTimeline(53_000).playerPushPulse).toBe(0);
    expect(getAuditoriumTimeline(54_500).playerPushPulse).toBeCloseTo(1, 5);
    expect(getAuditoriumTimeline(56_000).playerPushPulse).toBe(0);
    expect(getAuditoriumTimeline(53_500).manGlareProgress).toBe(1);
  });
});

describe('خفگی، کوبش‌ها، لرزش و سقوط لوستر — 56 تا 67 ثانیه (موج ۳ بند ۲)', () => {
  it('ترتیب سطوح کوبش دقیقاً سناریو است: در، دیوار چپ، دیوار راست، زمین، سقف، زمین', () => {
    expect(SLAM_IMPACTS.map((i) => i.surface)).toEqual([
      'door',
      'left-wall',
      'right-wall',
      'floor',
      'ceiling',
      'floor',
    ]);
    for (let i = 1; i < SLAM_IMPACTS.length; i++) {
      expect(SLAM_IMPACTS[i].atMs).toBeGreaterThan(SLAM_IMPACTS[i - 1].atMs);
    }
    expect(SLAM_IMPACTS[0].atMs).toBeGreaterThan(56_000);
    expect(CHANDELIER_FALL_AT_MS).toBeGreaterThan(SLAM_IMPACTS[SLAM_IMPACTS.length - 1].atMs);
    expect(CHANDELIER_FALL_AT_MS).toBeLessThan(67_000);
  });

  it('مسیر پرتاب زن روی لحظه‌های کوبش دقیقاً به همان سطح می‌رسد و پیوسته است', () => {
    expect(victimPoseAt(56_000).xPct).toBeCloseTo(50);
    expect(victimPoseAt(59_200).xPct).toBeLessThan(15); // دیوار چپ
    expect(victimPoseAt(60_600).xPct).toBeGreaterThan(85); // دیوار راست
    expect(victimPoseAt(62_000).yPct).toBeGreaterThan(70); // زمین
    expect(victimPoseAt(63_400).yPct).toBeLessThan(12); // سقف
    expect(Math.abs(victimPoseAt(63_400).rotateDeg)).toBeGreaterThan(150); // وارونه زیر سقف
    expect(victimPoseAt(50_000)).toEqual(victimPoseAt(56_000)); // قبل از خفگی ژست آغازین
    let prev = victimPoseAt(56_000);
    for (let t = 56_100; t <= 67_000; t += 100) {
      const pose = victimPoseAt(t);
      expect(Math.abs(pose.xPct - prev.xPct)).toBeLessThan(20); // بدون پرش مکانی
      prev = pose;
    }
  });

  it('لرزش سالن فقط در بازه وحشت فعال است و روی کوبش‌ها تقویت می‌شود', () => {
    expect(getAuditoriumTimeline(45_000).cameraShakeX).toBe(0);
    let maxShake = 0;
    for (let t = 57_800; t <= 65_000; t += 50) {
      maxShake = Math.max(maxShake, Math.abs(getAuditoriumTimeline(t).cameraShakeX));
    }
    expect(maxShake).toBeGreaterThan(3);
    expect(getAuditoriumTimeline(70_000).cameraShakeX).toBe(0);
    expect(getAuditoriumTimeline(70_000).cameraShakeY).toBe(0);
  });

  it('تابلوها از اولین کوبش کج می‌شوند و لوستر شتاب‌دار سقوط و بعد خرد می‌شود', () => {
    expect(getAuditoriumTimeline(57_800).paintingsTiltProgress).toBe(0);
    expect(getAuditoriumTimeline(65_000).paintingsTiltProgress).toBe(1);
    expect(getAuditoriumTimeline(CHANDELIER_FALL_AT_MS).chandelierFallProgress).toBe(0);
    expect(getAuditoriumTimeline(CHANDELIER_FALL_AT_MS + 350).chandelierFallProgress).toBeCloseTo(0.25, 2);
    expect(getAuditoriumTimeline(CHANDELIER_FALL_AT_MS + 700).chandelierFallProgress).toBe(1);
    expect(getAuditoriumTimeline(CHANDELIER_FALL_AT_MS + 1_300).chandelierShatteredProgress).toBe(1);
  });
});

describe('غیب شدن و تاریکی ماندگار — 67 تا 74 ثانیه (موج ۳ بند ۳)', () => {
  it('هر دو کاراکتر بین ۶۷ تا ۶۷.۷ ثانیه غیب می‌شوند و خاموشی در میانه آن اوج می‌گیرد', () => {
    expect(getAuditoriumTimeline(67_000).vanishProgress).toBe(0);
    expect(getAuditoriumTimeline(67_700).vanishProgress).toBe(1);
    expect(getAuditoriumTimeline(66_800).blackoutPulse).toBeCloseTo(0, 5);
    expect(getAuditoriumTimeline(67_700).blackoutPulse).toBeGreaterThan(0.99);
    expect(getAuditoriumTimeline(68_600).blackoutPulse).toBeCloseTo(0, 5);
  });

  it('پس از غیب شدن، سالن تا پایان کات‌سین تاریک و واژگون می‌ماند', () => {
    const end = getAuditoriumTimeline(74_000);
    expect(end.finalDarknessProgress).toBe(1);
    expect(end.inversionProgress).toBe(1);
    expect(end.stageGrimeProgress).toBe(1);
    expect(end.chandelierFallProgress).toBe(1);
    expect(end.chandelierShatteredProgress).toBe(1);
    expect(end.paintingsTiltProgress).toBe(1);
  });
});
