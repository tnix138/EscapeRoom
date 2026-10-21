/**
 * تست‌های موج ۱ علیرضا — دوربین اول‌شخص محدود چپ/راست (usePovHeadPan)
 * اجرای تست‌ها: npm run test:alireza
 * (تست چندمرورگری Playwright در موج ۳ به همین پوشه اضافه می‌شود: multiplayer-theater.spec.ts)
 */

import { describe, expect, it } from 'vitest';
import {
  POV_YAW_MAX_DEG,
  POV_YAW_MIN_DEG,
  clampYaw,
  dampYaw,
  getPovCameraStyle,
  yawToNormalized,
} from '../../src/components/cinema/usePovHeadPan';

describe('محدودیت سخت‌گیرانه چرخش سر [-42°, +42°] (ARCHITECTURE.md §۳.۳)', () => {
  it('ثابت‌های بازه دقیقاً ۴۲- و ۴۲+ هستند', () => {
    expect(POV_YAW_MIN_DEG).toBe(-42);
    expect(POV_YAW_MAX_DEG).toBe(42);
  });

  it('زاویه داخل بازه بدون تغییر می‌ماند و خارج بازه کلمپ می‌شود', () => {
    expect(clampYaw(0)).toBe(0);
    expect(clampYaw(20.5)).toBe(20.5);
    expect(clampYaw(42)).toBe(42);
    expect(clampYaw(90)).toBe(42);
    expect(clampYaw(-90)).toBe(-42);
    expect(clampYaw(10_000)).toBe(42);
  });

  it('مقادیر نامعتبر (NaN/Infinity) به مرکز برمی‌گردند تا دوربین هرگز قفل نکند', () => {
    expect(clampYaw(Number.NaN)).toBe(0);
    expect(clampYaw(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampYaw(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('نرمال‌سازی به بازه [-1, +1] درست است', () => {
    expect(yawToNormalized(0)).toBe(0);
    expect(yawToNormalized(42)).toBe(1);
    expect(yawToNormalized(-42)).toBe(-1);
    expect(yawToNormalized(21)).toBe(0.5);
    expect(yawToNormalized(84)).toBe(1); // خارج بازه هم کلمپ می‌شود
  });
});

describe('میرایی نمایی حرکت سر (dampYaw)', () => {
  it('در هر گام به سمت هدف حرکت می‌کند ولی از آن رد نمی‌شود', () => {
    const next = dampYaw(0, 42, 1 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(42);
  });

  it('پس از گام‌های زیاد عملاً به هدف می‌رسد', () => {
    let yaw = -42;
    for (let i = 0; i < 240; i++) yaw = dampYaw(yaw, 30, 1 / 60);
    expect(yaw).toBeCloseTo(30, 1);
  });

  it('مستقل از نرخ فریم است: دو نیم‌گام ≈ یک گام کامل', () => {
    const oneStep = dampYaw(0, 42, 0.1);
    const twoHalfSteps = dampYaw(dampYaw(0, 42, 0.05), 42, 0.05);
    expect(twoHalfSteps).toBeCloseTo(oneStep, 6);
  });

  it('هدف خارج از بازه را قبل از حرکت کلمپ می‌کند و با dt نامثبت ثابت می‌ماند', () => {
    expect(dampYaw(0, 500, 1)).toBeLessThanOrEqual(42);
    expect(dampYaw(15, -30, 0)).toBe(15);
    expect(dampYaw(15, -30, -1)).toBe(15);
  });
});

describe('استایل دوربین صحنه (getPovCameraStyle) — آماده موج ۲', () => {
  it('در مرکز هیچ چرخش/جابه‌جایی ندارد', () => {
    const style = getPovCameraStyle(0);
    expect(style.transform).toContain('translateX(0.000%)');
    expect(style.transform).toContain('rotateY(0.00deg)');
    expect(style.perspectiveOrigin).toBe('50.00% 50%');
  });

  it('چرخش سر به راست، صحنه را خلاف جهت می‌چرخاند تا سمت راست آشکار شود', () => {
    const style = getPovCameraStyle(42);
    expect(style.transform).toContain('rotateY(-42.00deg)');
    expect(style.transform).toContain('translateX(-14.000%)');
  });

  it('چرخش سر به چپ قرینه حالت راست است و ورودی خارج بازه کلمپ می‌شود', () => {
    expect(getPovCameraStyle(-42).transform).toContain('rotateY(42.00deg)');
    expect(getPovCameraStyle(999).transform).toContain('rotateY(-42.00deg)');
  });
});
