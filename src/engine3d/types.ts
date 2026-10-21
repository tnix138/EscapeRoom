'use client';

/**
 * types.ts — تایپ‌های مشترک هسته سه‌بعدی (علیرضا — موج ۴)
 * هیچ وابستگی به Three.js در تایپ‌های خالص نیست تا تست واحد Node امن بماند.
 */

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
}

export const DEFAULT_MOVEMENT_CONFIG: MovementConfig = {
  walkSpeed: 2.8,
  sprintMultiplier: 1.7,
  mouseSensitivity: 0.12,
  minPitchDeg: -18,
  maxPitchDeg: 28,
};

export const DEFAULT_ALLEY_BOUNDS: WorldBounds = {
  minX: -9,
  maxX: 9,
  minZ: -18,
  maxZ: 8,
  groundY: 0,
};

export const DEFAULT_ALLEY_SPAWN: PlayerSpawn = {
  position: { x: 0, y: 1.65, z: 6 },
  yawDeg: 0,
};

export const DEFAULT_ALLEY_ANCHORS: AlleyAnchors = {
  playbill: { x: -7.5, y: 2.2, z: -2 },
  rowChart: { x: 7.5, y: 2.2, z: -1.5 },
  theaterDoor: { x: 0, y: 1.8, z: -14 },
};
