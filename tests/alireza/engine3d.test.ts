import { describe, it, expect } from 'vitest';
import { clampToBounds, checkAABBCollision, ALLEY_STATIC_OBSTACLES, resolveMovement } from '@/engine3d/collision';
import { DEFAULT_ALLEY_BOUNDS } from '@/engine3d/types';
import { PlayerController, inputFromKeyboard } from '@/engine3d/player-controller';
import { clampYaw, dampYaw, yawToNormalized } from '@/components/cinema/usePovHeadPan';

describe('موج ۴ — هسته سه‌بعدی و برخورد', () => {
  it('clampToBounds مرزها را درست محدود می‌کند', () => {
    const b = DEFAULT_ALLEY_BOUNDS;
    const inside = clampToBounds(0, 0, b);
    expect(inside.hitWall).toBe(false);
    const outside = clampToBounds(100, -100, b);
    expect(outside.hitWall).toBe(true);
    expect(outside.x).toBe(b.maxX);
    expect(outside.z).toBe(b.minZ);
  });

  it('برخورد با موانع ثابت تئاتر تشخیص داده می‌شود', () => {
    // وسط در تئاتر باید برخورد داشته باشد
    const hit = checkAABBCollision(0, -14, 0.5, ALLEY_STATIC_OBSTACLES);
    expect(hit).toBe(true);
    const free = checkAABBCollision(0, 0, 0.5, ALLEY_STATIC_OBSTACLES);
    expect(free).toBe(false);
  });

  it('resolveMovement اسلاید کنار دیوار را انجام می‌دهد', () => {
    const prev = { x: 0, y: 1.65, z: 0, yawDeg: 0, pitchDeg: 0 };
    // تلاش برای رفتن داخل دیوار تئاتر
    const res = resolveMovement(prev, 0, -14, DEFAULT_ALLEY_BOUNDS, 0.35);
    expect(res.collided).toBe(true);
    // نباید داخل مانع برود
    expect(checkAABBCollision(res.clampedX, res.clampedZ, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);
  });

  it('PlayerController حرکت جلو با delta-time', () => {
    const ctrl = new PlayerController(
      { x: 0, y: 1.65, z: 0, yawDeg: 0, pitchDeg: 0 },
      DEFAULT_ALLEY_BOUNDS,
    );
    const before = ctrl.getTransform();
    ctrl.tick({ forward: true, backward: false, left: false, right: false, sprint: false }, 1);
    const after = ctrl.getTransform();
    expect(after.z).toBeLessThan(before.z); // نگاه به -Z
    expect(Math.abs(after.x - before.x)).toBeLessThan(0.01);
  });

  it('PlayerController strafe راست', () => {
    const ctrl = new PlayerController(
      { x: 0, y: 1.65, z: 0, yawDeg: 0, pitchDeg: 0 },
      DEFAULT_ALLEY_BOUNDS,
    );
    ctrl.tick({ forward: false, backward: false, left: false, right: true, sprint: false }, 1);
    const t = ctrl.getTransform();
    expect(t.x).toBeGreaterThan(0);
  });

  it('inputFromKeyboard کلیدها را درست می‌خواند', () => {
    const keys = new Set(['KeyW', 'KeyD', 'ShiftLeft']);
    const input = inputFromKeyboard(keys);
    expect(input.forward).toBe(true);
    expect(input.right).toBe(true);
    expect(input.sprint).toBe(true);
    expect(input.backward).toBe(false);
  });

  it('چرخش سر با yaw محدود می‌ماند', () => {
    expect(clampYaw(100)).toBe(42);
    expect(clampYaw(-100)).toBe(-42);
    expect(yawToNormalized(21)).toBeCloseTo(0.5);
  });

  it('dampYaw مستقل از FPS همگرا می‌شود', () => {
    let current = 0;
    const target = 30;
    for (let i = 0; i < 60; i++) {
      current = dampYaw(current, target, 1 / 60, 7);
    }
    expect(current).toBeGreaterThan(29);
    expect(current).toBeLessThanOrEqual(30);
  });
});
