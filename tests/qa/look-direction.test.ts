/**
 * look-direction.test.ts — قرارداد جهت چرخش سر (باگ: برعکس بودن چپ/راست)
 * ---------------------------------------------------------------------------
 * بازخورد بازیکن: «چرخش سر به چپ و راست برعکس کار می‌کند؛ هم گوشی هم کامپیوتر».
 * علت این بود که `movementX`/`dx` با علامت مثبت به yaw اضافه می‌شد، در حالی که
 * در این پروژه yaw مثبت یعنی چرخش به **چپ**.
 *
 * این تست‌ها جهت را از دو سو قفل می‌کنند: هم تبدیل ورودی (`pointerLookDelta`)،
 * هم نتیجهٔ دیدنی (`lookTarget` و بردار جلو رفتن بازیکن).
 */
import { describe, expect, it } from 'vitest';
import { forwardFromYaw, lookTarget, pointerLookDelta } from '@/engine3d/look-input';
import { PlayerController } from '@/engine3d/player-controller';
import { DEFAULT_ALLEY_BOUNDS } from '@/engine3d/types';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {
  PANORAMA_YAW_LIMIT_DEG,
  clampPanoramaYaw,
  panoramaView,
  panoramaYawFromDrag,
  panoramaYawFromKey,
} from '@/components/alley/panorama-look';
import { yawFromDrag } from '@/components/cinema/usePovHeadPan';

const SENSITIVITY = 0.15;

function controllerAtZero() {
  return new PlayerController(
    { x: 0, y: 1.65, z: 0, yawDeg: 0, pitchDeg: 0 },
    DEFAULT_ALLEY_BOUNDS,
  );
}

/** زاویهٔ افقی جهت نگاه نسبت به محور −Z (مثبت = سمت راست) */
function headingDegRight(target: { x: number; z: number }, yawAtStart = { x: 0, z: 0 }): number {
  const dx = target.x - yawAtStart.x;
  const dz = target.z - yawAtStart.z;
  // در yaw = 0 نگاه به −Z است. چرخش به راست ⇒ x مثبت می‌شود.
  return (Math.atan2(dx, -dz) * 180) / Math.PI;
}

describe('ورودی نگاه — حرکت به راست، نگاه به راست', () => {
  it('ماوس/انگشت به راست، yaw را کم می‌کند (نه زیاد)', () => {
    const look = pointerLookDelta(120, 0, SENSITIVITY);
    expect(look.deltaYawDeg).toBeLessThan(0);
    expect(look.deltaYawDeg).toBeCloseTo(-120 * SENSITIVITY, 6);
  });

  it('حرکت به چپ، yaw را زیاد می‌کند', () => {
    expect(pointerLookDelta(-120, 0, SENSITIVITY).deltaYawDeg).toBeGreaterThan(0);
  });

  it('حرکت به پایین، نگاه را به پایین می‌برد (pitch کوچک‌تر)', () => {
    expect(pointerLookDelta(0, 40, SENSITIVITY).deltaPitchDeg).toBeLessThan(0);
    expect(pointerLookDelta(0, -40, SENSITIVITY).deltaPitchDeg).toBeGreaterThan(0);
  });

  it('پس از کشیدن به راست، دوربین واقعاً به سمت راست می‌چرخد', () => {
    const controller = controllerAtZero();
    const look = pointerLookDelta(200, 0, SENSITIVITY);
    controller.addLookDelta(look.deltaYawDeg, look.deltaPitchDeg);
    const transform = controller.getTransform();
    expect(transform.yawDeg).toBeLessThan(0);

    const target = lookTarget(transform);
    // روبه‌رو در yaw=0 یعنی −Z؛ چرخش به راست باید x مثبت بدهد.
    expect(target.x).toBeGreaterThan(0);
    expect(target.z).toBeLessThan(0);
    expect(headingDegRight(target)).toBeGreaterThan(0);
  });

  it('پس از کشیدن به چپ، دوربین به سمت چپ می‌چرخد', () => {
    const controller = controllerAtZero();
    const look = pointerLookDelta(-200, 0, SENSITIVITY);
    controller.addLookDelta(look.deltaYawDeg, look.deltaPitchDeg);
    const target = lookTarget(controller.getTransform());
    expect(target.x).toBeLessThan(0);
    expect(headingDegRight(target)).toBeLessThan(0);
  });

  it('بردار «جلو رفتن» بازیکن با جهت نگاه یکی است (چرخش راست = حرکت به راست)', () => {
    const controller = controllerAtZero();
    const look = pointerLookDelta(300, 0, SENSITIVITY);
    controller.addLookDelta(look.deltaYawDeg, look.deltaPitchDeg);
    const yaw = controller.getTransform().yawDeg;

    const target = lookTarget({ x: 0, y: 1.65, z: 0, yawDeg: yaw, pitchDeg: 0 });
    const forward = forwardFromYaw(yaw);
    expect(Math.sign(forward.x)).toBe(Math.sign(target.x));
    expect(Math.sign(forward.z)).toBe(Math.sign(target.z));
  });

  it('pitch بیرون از بازه هم مثل قبل مهار می‌شود', () => {
    const controller = controllerAtZero();
    controller.addLookDelta(0, -10_000);
    expect(controller.getTransform().pitchDeg).toBeLessThanOrEqual(89);
    controller.addLookDelta(0, 20_000);
    expect(controller.getTransform().pitchDeg).toBeGreaterThanOrEqual(-89);
  });

  it('نگاه به بالا با pitch مثبت است (سازگار با سر ثابتِ کات‌سین)', () => {
    const up = lookTarget({ x: 0, y: 1.65, z: 0, yawDeg: 0, pitchDeg: 20 });
    expect(up.y).toBeGreaterThan(1.65);
  });
});

describe('اتصال ورودی‌ها به قرارداد واحد', () => {
  const controls = readFileSync(path.join(process.cwd(), 'src/engine3d/usePlayerControls.ts'), 'utf8');

  it('هر سه مسیر (pointer-lock، درگ ماوس، درگ لمسی) از pointerLookDelta استفاده می‌کنند', () => {
    const calls = controls.match(/pointerLookDelta\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });

  it('هیچ‌جا دلتای خام با علامت مثبت به yaw داده نمی‌شود', () => {
    expect(controls).not.toMatch(/addLookDelta\(\s*(e\.movementX|dx)\s*\*/);
    expect(controls).not.toMatch(/addLookDelta\([^)]*[^-\w]dy \* sensitivity/);
  });

  it('محاسبهٔ lookAt از look-input می‌آید، نه فرمول تکراری', () => {
    expect(controls).toContain('lookTarget(t)');
    expect(controls).not.toContain('t.x - Math.sin(yawRad)');
  });
});

describe('نمای کلاسیک کوچه — کشیدن، کلید و اسلایدر یک جهت دارند', () => {
  it('کشیدن به راست، نمای راست می‌دهد', () => {
    const yaw = panoramaYawFromDrag(0, 120);
    expect(yaw).toBeGreaterThan(12);
    expect(panoramaView(yaw)).toBe('right');
  });

  it('کشیدن به چپ، نمای چپ می‌دهد', () => {
    const yaw = panoramaYawFromDrag(0, -120);
    expect(yaw).toBeLessThan(-12);
    expect(panoramaView(yaw)).toBe('left');
  });

  it('کلید → و کشیدن به راست هم‌جهت‌اند (پیش‌تر برعکس بودند)', () => {
    expect(panoramaYawFromKey(0, 'ArrowRight')).toBeCloseTo(panoramaYawFromDrag(0, 9 / 0.22), 6);
    expect(panoramaYawFromKey(0, 'ArrowLeft')).toBeLessThan(0);
  });

  it('بازهٔ چرخش مثل قبل ±۴۲ درجه است', () => {
    expect(PANORAMA_YAW_LIMIT_DEG).toBe(42);
    expect(clampPanoramaYaw(500)).toBe(42);
    expect(clampPanoramaYaw(-500)).toBe(-42);
  });

  it('صحنهٔ کلاسیک دیگر فرمول قدیمی را درون‌خطی ندارد', () => {
    const scene = readFileSync(path.join(process.cwd(), 'src/components/alley/AlleyFirstPersonScene.tsx'), 'utf8');
    expect(scene).toContain('panoramaYawFromDrag(value, delta)');
    expect(scene).not.toMatch(/clamp\(value - delta \* 0\.22/);
  });
});

describe('کات‌سین — کشیدن انگشت هم‌جهت با حرکت ماوس', () => {
  it('کشیدن به راست سر را به راست می‌چرخاند (yaw مثبت)', () => {
    expect(yawFromDrag(0, 100, 0.12)).toBeGreaterThan(0);
  });

  it('کشیدن به چپ سر را به چپ می‌چرخاند و در بازهٔ ±۴۲ می‌ماند', () => {
    expect(yawFromDrag(0, -100, 0.12)).toBeLessThan(0);
    expect(yawFromDrag(0, 5000, 0.12)).toBeLessThanOrEqual(42);
    expect(yawFromDrag(0, -5000, 0.12)).toBeGreaterThanOrEqual(-42);
  });

  it('هوک دیگر علامت منفی درگ را ندارد', () => {
    const hook = readFileSync(path.join(process.cwd(), 'src/components/cinema/usePovHeadPan.ts'), 'utf8');
    expect(hook).toContain('yawFromDrag(');
    expect(hook).not.toContain('targetYawRef.current - dx *');
  });
});

describe('اثبات با دوربین واقعی Three.js', () => {
  function project(yawDeg: number, point: { x: number; y: number; z: number }) {
    const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 200);
    camera.position.set(0, 1.65, 0);
    const target = lookTarget({ x: 0, y: 1.65, z: 0, yawDeg, pitchDeg: 0 });
    camera.lookAt(target.x, target.y, target.z);
    camera.updateMatrixWorld();
    return new THREE.Vector3(point.x, point.y, point.z).project(camera);
  }

  it('کشیدن به راست، شیء سمت راست صحنه را به مرکز می‌آورد (چرخش به راست)', () => {
    const rightPoint = { x: 6, y: 1.65, z: -8 };
    const before = project(0, rightPoint);
    const after = project(pointerLookDelta(200, 0, SENSITIVITY).deltaYawDeg, rightPoint);
    expect(before.x).toBeGreaterThan(0.3);
    // نزدیک‌تر به مرکز صفحه = دوربین به سمت آن چرخیده است
    expect(after.x).toBeLessThan(before.x);
  });

  it('رفتار قبلی (علامت مثبت) واقعاً برعکس بود', () => {
    const rightPoint = { x: 6, y: 1.65, z: -8 };
    const wrong = project(+30, rightPoint);
    // با چرخش به چپ، شیء سمت راست از کادر بیرون می‌رود — همان چیزی که بازیکن دید
    expect(wrong.x).toBeGreaterThan(1);
  });
});
