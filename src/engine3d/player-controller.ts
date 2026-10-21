'use client';

/**
 * player-controller.ts — کنترلر اول‌شخص قابل پیمایش (علیرضا — موج ۴/۵)
 * منطق خالص + اتصال به Three.js Camera.
 * - حرکت واقعی: forward/back/strafe left/right (نه فقط چرخش سر)
 * - delta-time مستقل از FPS
 * - برخورد و مرز
 * - pointer-lock با fallback لمسی
 */

import type { MovementConfig, PlayerInputState, PlayerTransform, WorldBounds } from './types';
import { DEFAULT_MOVEMENT_CONFIG } from './types';
import { resolveMovement } from './collision';

export class PlayerController {
  private transform: PlayerTransform;
  private readonly bounds: WorldBounds;
  private readonly config: MovementConfig;

  constructor(initial: PlayerTransform, bounds: WorldBounds, config: Partial<MovementConfig> = {}) {
    this.transform = { ...initial };
    this.bounds = bounds;
    this.config = { ...DEFAULT_MOVEMENT_CONFIG, ...config };
  }

  getTransform(): PlayerTransform {
    return { ...this.transform };
  }

  setYawPitch(yawDeg: number, pitchDeg: number): void {
    this.transform.yawDeg = yawDeg;
    this.transform.pitchDeg = Math.min(
      this.config.maxPitchDeg,
      Math.max(this.config.minPitchDeg, pitchDeg),
    );
  }

  addLookDelta(deltaYawDeg: number, deltaPitchDeg: number): void {
    this.setYawPitch(
      this.transform.yawDeg + deltaYawDeg,
      this.transform.pitchDeg + deltaPitchDeg,
    );
  }

  /**
   * به‌روزرسانی حرکت بر اساس ورودی و زمان سپری‌شده.
   * @param input وضعیت کلیدها
   * @param deltaSeconds زمان از فریم قبل (ثانیه)
   */
  tick(input: PlayerInputState, deltaSeconds: number): PlayerTransform {
    const dt = Math.min(0.1, Math.max(0, deltaSeconds)); // clamp برای جلوگیری از پرش بزرگ
    if (dt === 0) return this.getTransform();

    const speed = this.config.walkSpeed * (input.sprint ? this.config.sprintMultiplier : 1);
    const yawRad = (this.transform.yawDeg * Math.PI) / 180;

    // بردارهای محلی دوربین
    const forwardX = -Math.sin(yawRad);
    const forwardZ = -Math.cos(yawRad);
    const rightX = Math.cos(yawRad);
    const rightZ = -Math.sin(yawRad);

    let moveX = 0;
    let moveZ = 0;
    if (input.forward) {
      moveX += forwardX;
      moveZ += forwardZ;
    }
    if (input.backward) {
      moveX -= forwardX;
      moveZ -= forwardZ;
    }
    if (input.left) {
      moveX -= rightX;
      moveZ -= rightZ;
    }
    if (input.right) {
      moveX += rightX;
      moveZ += rightZ;
    }

    const len = Math.hypot(moveX, moveZ);
    if (len > 0) {
      moveX = (moveX / len) * speed * dt;
      moveZ = (moveZ / len) * speed * dt;
      const desiredX = this.transform.x + moveX;
      const desiredZ = this.transform.z + moveZ;
      const resolved = resolveMovement(this.transform, desiredX, desiredZ, this.bounds);
      this.transform.x = resolved.clampedX;
      this.transform.z = resolved.clampedZ;
    }

    return this.getTransform();
  }

  teleport(x: number, y: number, z: number, yawDeg?: number): void {
    this.transform.x = x;
    this.transform.y = y;
    this.transform.z = z;
    if (typeof yawDeg === 'number') this.transform.yawDeg = yawDeg;
  }
}

/**
 * تبدیل وضعیت کلیدهای کیبورد به PlayerInputState
 */
export function inputFromKeyboard(keys: Set<string>): PlayerInputState {
  return {
    forward: keys.has('KeyW') || keys.has('ArrowUp'),
    backward: keys.has('KeyS') || keys.has('ArrowDown'),
    left: keys.has('KeyA'),
    right: keys.has('KeyD'),
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
}
