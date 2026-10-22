'use client';

/**
 * player-controller.ts — کنترلر اول‌شخص قابل پیمایش (علیرضا — موج ۴/۵ + رفع گیرکردن حرکت)
 * منطق خالص + اتصال به Three.js Camera.
 * - حرکت واقعی: forward/back/strafe left/right (نه فقط چرخش سر)
 * - delta-time مستقل از FPS
 * - برخورد و اسلاید نرم روی دیوارها و موانع بدون گیر کردن در گوشه‌ها
 * - محافظ‌های ورودی برای جلوگیری از راه رفتن خودکار ناگهانی
 */

import type { MovementConfig, PlayerInputState, PlayerTransform, WorldBounds } from './types';
import { DEFAULT_ALLEY_BOUNDS, DEFAULT_MOVEMENT_CONFIG } from './types';
import {
  ALLEY_STATIC_OBSTACLES,
  resolveMovement,
  sanitizePosition,
  type AABB,
} from './collision';
import { forwardFromYaw } from './look-input';

const DEFAULT_PLAYER_RADIUS = 0.35;

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/**
 * تشخیص فیلدهای ورود متن (چت نجوا، ورودی کد قفل در، textarea و ...)
 * تا تایپ حروف فارسی/انگلیسی (مثل ص/ش/س/ی روی کیبورد WASD) باعث راه رفتن خودکار نشود،
 * ولی کلیک روی دکمه یا رادیوباتن بلیط جلوی راه رفتن با WASD را نگیرد.
 */
export function isTextEntryElement(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as {
    tagName?: unknown;
    type?: unknown;
    isContentEditable?: unknown;
  };
  if (el.isContentEditable === true) return true;
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const inputType = typeof el.type === 'string' ? el.type.toLowerCase() : 'text';
    return !NON_TEXT_INPUT_TYPES.has(inputType);
  }
  return false;
}

export function isArrowInteractiveElement(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: unknown; type?: unknown };
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag !== 'INPUT') return false;
  const inputType = typeof el.type === 'string' ? el.type.toLowerCase() : '';
  return inputType === 'radio' || inputType === 'range';
}

export function isModifierChord(event: {
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): boolean {
  return Boolean(event.ctrlKey || event.metaKey || event.altKey);
}

/**
 * فیلتر پرش‌های ناگهانی Pointer Lock در مرورگرها هنگام قفل/آزاد شدن نشانگر
 * تا زاویهٔ دید و جهت حرکت ناگهان به سمت دیگری پرتاب نشود.
 */
export function sanitizePointerLockDelta(
  movementX: number,
  movementY: number,
  maxAbsPx = 300,
): { dx: number; dy: number } {
  if (!Number.isFinite(movementX) || !Number.isFinite(movementY)) {
    return { dx: 0, dy: 0 };
  }
  if (Math.abs(movementX) > maxAbsPx || Math.abs(movementY) > maxAbsPx) {
    return { dx: 0, dy: 0 };
  }
  return { dx: movementX, dy: movementY };
}

export class PlayerController {
  private transform: PlayerTransform;
  private readonly bounds: WorldBounds;
  private readonly config: MovementConfig;
  private readonly obstacles: readonly AABB[];

  constructor(
    initial: PlayerTransform,
    bounds: WorldBounds = DEFAULT_ALLEY_BOUNDS,
    config: Partial<MovementConfig> = {},
    obstacles: readonly AABB[] = ALLEY_STATIC_OBSTACLES,
  ) {
    this.bounds = bounds;
    this.config = { ...DEFAULT_MOVEMENT_CONFIG, ...config };
    this.obstacles = obstacles;

    const safe = sanitizePosition(
      initial.x,
      initial.z,
      this.bounds,
      DEFAULT_PLAYER_RADIUS,
      this.obstacles,
    );
    this.transform = {
      ...initial,
      x: safe.x,
      y: Number.isFinite(initial.y) ? initial.y : 1.65,
      z: safe.z,
      yawDeg: Number.isFinite(initial.yawDeg) ? initial.yawDeg : 0,
      pitchDeg: Number.isFinite(initial.pitchDeg)
        ? Math.min(this.config.maxPitchDeg, Math.max(this.config.minPitchDeg, initial.pitchDeg))
        : 0,
    };
  }

  getTransform(): PlayerTransform {
    return { ...this.transform };
  }

  setYawPitch(yawDeg: number, pitchDeg: number): void {
    if (!Number.isFinite(yawDeg) || !Number.isFinite(pitchDeg)) return;
    this.transform.yawDeg = yawDeg;
    this.transform.pitchDeg = Math.min(
      this.config.maxPitchDeg,
      Math.max(this.config.minPitchDeg, pitchDeg),
    );
  }

  addLookDelta(deltaYawDeg: number, deltaPitchDeg: number): void {
    if (!Number.isFinite(deltaYawDeg) || !Number.isFinite(deltaPitchDeg)) return;
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
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return this.getTransform();
    }
    const dt = Math.min(0.1, Math.max(0, deltaSeconds)); // clamp برای جلوگیری از پرش بزرگ
    if (dt === 0) return this.getTransform();

    const speed = this.config.walkSpeed * (input.sprint ? this.config.sprintMultiplier : 1);
    const fwd = forwardFromYaw(this.transform.yawDeg);

    // بردارهای محلی دوربین هماهنگ با look-input
    const forwardX = fwd.x;
    const forwardZ = fwd.z;
    const rightX = -fwd.z;
    const rightZ = fwd.x;

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
      const resolved = resolveMovement(
        this.transform,
        desiredX,
        desiredZ,
        this.bounds,
        DEFAULT_PLAYER_RADIUS,
        this.obstacles,
      );
      this.transform.x = resolved.clampedX;
      this.transform.z = resolved.clampedZ;
    }

    return this.getTransform();
  }

  teleport(x: number, y: number, z: number, yawDeg?: number): void {
    const safe = sanitizePosition(
      x,
      z,
      this.bounds,
      DEFAULT_PLAYER_RADIUS,
      this.obstacles,
    );
    this.transform.x = safe.x;
    if (Number.isFinite(y)) this.transform.y = y;
    this.transform.z = safe.z;
    if (typeof yawDeg === 'number' && Number.isFinite(yawDeg)) {
      this.transform.yawDeg = yawDeg;
    }
  }
}

/**
 * تبدیل وضعیت کلیدهای کیبورد به PlayerInputState
 */
export function inputFromKeyboard(keys: ReadonlySet<string>): PlayerInputState {
  return {
    forward: keys.has('KeyW') || keys.has('ArrowUp'),
    backward: keys.has('KeyS') || keys.has('ArrowDown'),
    left: keys.has('KeyA') || keys.has('ArrowLeft'),
    right: keys.has('KeyD') || keys.has('ArrowRight'),
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
}
