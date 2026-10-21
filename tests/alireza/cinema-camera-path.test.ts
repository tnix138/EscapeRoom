import { describe, expect, it } from 'vitest';
import {
  CINEMA_CAMERA_KEYFRAMES,
  CINEMATIC_CUTSCENE_DURATION_MS,
  getCameraKeyframe,
} from '../../src/engine3d/cinema/camera-path';

describe('فاز ۰۸ — مسیر دوربین سینمایی', () => {
  it('حداقل هفت شات پیوسته، کل ۷۴ ثانیه را پوشش می‌دهند', () => {
    expect(CINEMA_CAMERA_KEYFRAMES.length).toBeGreaterThanOrEqual(7);
    expect(CINEMA_CAMERA_KEYFRAMES[0].startMs).toBe(0);
    expect(CINEMA_CAMERA_KEYFRAMES.at(-1)?.endMs).toBe(CINEMATIC_CUTSCENE_DURATION_MS);
    for (let i = 1; i < CINEMA_CAMERA_KEYFRAMES.length; i++) {
      expect(CINEMA_CAMERA_KEYFRAMES[i].startMs).toBe(CINEMA_CAMERA_KEYFRAMES[i - 1].endMs);
    }
    expect(CINEMATIC_CUTSCENE_DURATION_MS).toBe(74_000);
  });

  it('تایم‌لاین کلیدی روی صحنه‌های صحیح برش می‌خورد', () => {
    expect(getCameraKeyframe(0).shotId).toBe('usher-door-approach');
    expect(getCameraKeyframe(11_000).shotId).toBe('enter-and-be-seated');
    expect(getCameraKeyframe(21_000).shotId).toBe('opera-stage-wide');
    expect(getCameraKeyframe(31_000).shotId).toBe('shadow-left-reveal');
    expect(getCameraKeyframe(40_000).shotId).toBe('hand-and-rejection');
    expect(getCameraKeyframe(50_000).shotId).toBe('red-inversion-and-push');
    expect(getCameraKeyframe(56_000).shotId).toBe('choke-and-chandelier-fall');
    expect(getCameraKeyframe(67_000).shotId).toBe('vanish-and-darkness');
  });

  it('keyframe camera position, target and FOV interpolate safely within each shot', () => {
    const start = getCameraKeyframe(21_000);
    const middle = getCameraKeyframe(26_000);
    const end = getCameraKeyframe(30_999);
    expect(middle.shotId).toBe('opera-stage-wide');
    expect(middle.position.x).toBeGreaterThan(start.position.x);
    expect(middle.fov).toBeLessThan(start.fov);
    expect(middle.fov).toBeGreaterThan(end.fov);
    for (const value of [middle.position.x, middle.position.y, middle.position.z, middle.target.z, middle.fov]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('زمان خارج از تایملاین به ابتدا/پایان محدود و NaN به شروع برمی‌گردد', () => {
    expect(getCameraKeyframe(-3_000).shotId).toBe(CINEMA_CAMERA_KEYFRAMES[0].id);
    expect(getCameraKeyframe(Number.NaN).shotId).toBe(CINEMA_CAMERA_KEYFRAMES[0].id);
    const final = getCameraKeyframe(999_000);
    expect(final.shotId).toBe('vanish-and-darkness');
    expect(final.progress).toBe(1);
  });
});
