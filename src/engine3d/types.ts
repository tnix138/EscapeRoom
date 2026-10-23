'use client';

/**
 * types.ts — تایپ‌های مشترک هسته سه‌بعدی (علیرضا — موج ۴)
 * هیچ وابستگی به Three.js در تایپ‌های خالص نیست تا تست واحد Node امن بماند.
 */

import { ALLEY_L_BOUNDS } from './alley-layout';

export interface WorldBounds {
  /** محدوده X (عرض کوچه) */
  minX: number;
  maxX: number;
  /** محدوده Z (عمق کوچه) */
  minZ: number;
  maxZ: number;
  /** ارتفاع زمین */
  groundY: number;
}

export interface PlayerSpawn {
  position: { x: number; y: number; z: number };
  yawDeg: number;
}

export interface AlleyAnchors {
  playbill: { x: number; y: number; z: number };
  rowChart: { x: number; y: number; z: number };
  theaterDoor: { x: number; y: number; z: number };
}

export interface PlayerInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

export interface PlayerTransform {
  x: number;
  y: number;
  z: number;
  yawDeg: number;
  pitchDeg: number;
}

export interface MovementConfig {
  walkSpeed: number; // m/s
  sprintMultiplier: number;
  mouseSensitivity: number;
  minPitchDeg: number;
  maxPitchDeg: number;
  /** ارتفاع مردمک چشم کاراکتر از کف پا (متر)؛ پیش‌فرض ۱٫۶۵ */
  eyeHeight?: number;
  /** تابع اختیاری ارتفاع سطح زیر پا در مختصات (x, z)؛ اگر نباشد y ثابت می‌ماند */
  groundHeightAt?: (x: number, z: number) => number;
}

export const DEFAULT_MOVEMENT_CONFIG: MovementConfig = {
  walkSpeed: 2.8,
  sprintMultiplier: 1.7,
  mouseSensitivity: 0.12,
  minPitchDeg: -58,
  maxPitchDeg: 68,
};

/**
 * مرزهای کوچهٔ L‌شکل: مستطیلِ محیطیِ کلِ L (شاخهٔ اصلیِ دوبرابر + فرعیِ غربی).
 * گوشه‌های بیرونِ L با موانعِ `ALLEY_STATIC_OBSTACLES` بسته شده‌اند، پس بازیکن
 * عملاً فقط داخلِ خودِ L راه می‌رود. منبعِ اعداد: `alley-layout.ts`
 */
export const DEFAULT_ALLEY_BOUNDS: WorldBounds = ALLEY_L_BOUNDS;

export const DEFAULT_ALLEY_SPAWN: PlayerSpawn = {
  position: { x: 0, y: 1.65, z: 6 },
  yawDeg: 0,
};

export const DEFAULT_ALLEY_ANCHORS: AlleyAnchors = {
  playbill: { x: -7.5, y: 2.2, z: -2 },
  rowChart: { x: 7.5, y: 2.2, z: -1.5 },
  theaterDoor: { x: 0, y: 1.8, z: -14 },
};
