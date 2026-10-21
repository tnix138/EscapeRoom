export interface CameraPoint {
  x: number;
  y: number;
  z: number;
}

export interface CameraKeyframe {
  id: string;
  startMs: number;
  endMs: number;
  from: { position: CameraPoint; target: CameraPoint; fov: number };
  to: { position: CameraPoint; target: CameraPoint; fov: number };
}

export interface CameraPose {
  shotId: string;
  progress: number;
  position: CameraPoint;
  target: CameraPoint;
  fov: number;
}

/** Eight server-clock-driven shots cover the complete 74-second cutscene. */
export const CINEMA_CAMERA_KEYFRAMES: readonly CameraKeyframe[] = [
  {
    id: 'usher-door-approach', startMs: 0, endMs: 11_000,
    from: { position: { x: 0, y: 1.62, z: 7 }, target: { x: 0, y: 1.75, z: -2 }, fov: 66 },
    to: { position: { x: 0, y: 1.62, z: -0.7 }, target: { x: 0, y: 1.85, z: -8 }, fov: 61 },
  },
  {
    id: 'enter-and-be-seated', startMs: 11_000, endMs: 21_000,
    from: { position: { x: 0, y: 1.62, z: -0.7 }, target: { x: 0, y: 1.7, z: -9 }, fov: 61 },
    to: { position: { x: 0, y: 1.22, z: -8.2 }, target: { x: 0, y: 1.9, z: -20 }, fov: 58 },
  },
  {
    id: 'opera-stage-wide', startMs: 21_000, endMs: 31_000,
    from: { position: { x: 0, y: 1.22, z: -8.2 }, target: { x: 0, y: 2.2, z: -20 }, fov: 58 },
    to: { position: { x: 0.2, y: 1.28, z: -8.5 }, target: { x: 0, y: 2.45, z: -20.5 }, fov: 54 },
  },
  {
    id: 'shadow-left-reveal', startMs: 31_000, endMs: 40_000,
    from: { position: { x: 0.2, y: 1.28, z: -8.5 }, target: { x: -2.4, y: 2.5, z: -20.5 }, fov: 54 },
    to: { position: { x: -0.8, y: 1.3, z: -8.5 }, target: { x: -4.2, y: 2.25, z: -20.5 }, fov: 49 },
  },
  {
    id: 'hand-and-rejection', startMs: 40_000, endMs: 50_000,
    from: { position: { x: -0.8, y: 1.3, z: -8.5 }, target: { x: -3.5, y: 2, z: -20.5 }, fov: 49 },
    to: { position: { x: 0, y: 1.35, z: -8.2 }, target: { x: 0.3, y: 2, z: -20.5 }, fov: 48 },
  },
  {
    id: 'red-inversion-and-push', startMs: 50_000, endMs: 56_000,
    from: { position: { x: 0, y: 1.35, z: -8.2 }, target: { x: 0.3, y: 2, z: -20.5 }, fov: 48 },
    to: { position: { x: 0, y: 1.1, z: -8.8 }, target: { x: 0, y: 2.2, z: -20 }, fov: 57 },
  },
  {
    id: 'choke-and-chandelier-fall', startMs: 56_000, endMs: 67_000,
    from: { position: { x: 0, y: 1.1, z: -8.8 }, target: { x: 0, y: 3.2, z: -20 }, fov: 57 },
    to: { position: { x: 0.15, y: 1.2, z: -9 }, target: { x: 0, y: 4.1, z: -12 }, fov: 60 },
  },
  {
    id: 'vanish-and-darkness', startMs: 67_000, endMs: 74_000,
    from: { position: { x: 0.15, y: 1.2, z: -9 }, target: { x: 0, y: 2.5, z: -20 }, fov: 60 },
    to: { position: { x: 0, y: 1.35, z: -7 }, target: { x: 0, y: 1.6, z: -18 }, fov: 64 },
  },
] as const;

export const CINEMATIC_CUTSCENE_DURATION_MS = 74_000;

export function getCameraKeyframe(elapsedMs: number): CameraPose {
  const time = Number.isFinite(elapsedMs)
    ? clamp(elapsedMs, 0, CINEMATIC_CUTSCENE_DURATION_MS)
    : 0;
  const keyframe = CINEMA_CAMERA_KEYFRAMES.find(
    (shot) => time >= shot.startMs && time < shot.endMs,
  ) ?? CINEMA_CAMERA_KEYFRAMES[CINEMA_CAMERA_KEYFRAMES.length - 1];
  const progress = easeInOutCubic(
    clamp((time - keyframe.startMs) / (keyframe.endMs - keyframe.startMs), 0, 1),
  );
  return {
    shotId: keyframe.id,
    progress,
    position: lerpPoint(keyframe.from.position, keyframe.to.position, progress),
    target: lerpPoint(keyframe.from.target, keyframe.to.target, progress),
    fov: lerp(keyframe.from.fov, keyframe.to.fov, progress),
  };
}

function lerpPoint(from: CameraPoint, to: CameraPoint, progress: number): CameraPoint {
  return {
    x: lerp(from.x, to.x, progress),
    y: lerp(from.y, to.y, progress),
    z: lerp(from.z, to.z, progress),
  };
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
