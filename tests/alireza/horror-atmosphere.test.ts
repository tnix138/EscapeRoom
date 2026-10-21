import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { heartbeatIntervalMs, HorrorAudio } from '../../src/audio/horror/horror-audio';
import { JumpScare, findActiveCue, type JumpScareCue } from '../../src/engine3d/horror/jump-scare';
import {
  HORROR_POST_FRAGMENT_SHADER,
  HorrorPostProcessor,
  Vignette,
} from '../../src/engine3d/horror/vignette';

const cues: JumpScareCue[] = [
  { id: 'shadow', atMs: 2_000, durationMs: 500, intensity: 0.8, position: { x: 1, y: 2, z: -3 } },
  { id: 'slam', atMs: 4_000, durationMs: 1_000 },
];

describe('فاز ۰۷ — جامپ‌اسکر زمان‌بندی‌شده', () => {
  it('جامپ‌اسکر را دقیقاً در پنجرهٔ authored فعال می‌کند', () => {
    expect(findActiveCue(cues, 1_999)).toBeNull();
    expect(findActiveCue(cues, 2_000)?.id).toBe('shadow');
    expect(findActiveCue(cues, 2_500)).toBeNull();
  });

  it('callback را یک بار در هر پخش صدا می‌زند و شدت را در طول cue نرم می‌کند', () => {
    const onTrigger = vi.fn();
    const director = new JumpScare(cues, onTrigger);
    expect(director.update(1_999)).toBeNull();
    expect(director.update(2_000)?.intensity).toBeCloseTo(0);
    expect(director.update(2_250)?.intensity).toBeCloseTo(0.8);
    director.update(2_400);
    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(onTrigger).toHaveBeenCalledWith(expect.objectContaining({ id: 'shadow' }));
    director.update(1_000); // seek/restart playback
    director.update(2_100);
    expect(onTrigger).toHaveBeenCalledTimes(2);
  });

  it('پنجره‌های هم‌پوشان آخرین cue را ترجیح می‌دهند و زمان‌بندی نامعتبر رد می‌شود', () => {
    expect(findActiveCue([
      { id: 'one', atMs: 0, durationMs: 100 },
      { id: 'two', atMs: 50, durationMs: 100 },
    ], 75)?.id).toBe('two');
    expect(() => new JumpScare([{ id: 'bad', atMs: 1, durationMs: 0 }])).toThrow(RangeError);
    expect(() => new JumpScare([
      { id: 'same', atMs: 0, durationMs: 1 },
      { id: 'same', atMs: 2, durationMs: 1 },
    ])).toThrow();
  });
});

describe('فاز ۰۷ — post-processing ترس', () => {
  it('Vignette سازندهٔ اثر vignette، grain و chromatic aberration دارد', () => {
    const vignette = new Vignette({ vignette: 0.7, grain: 0.03, chromaticAberration: 1.5 });
    expect(vignette.material).toBeInstanceOf(THREE.ShaderMaterial);
    expect(vignette.material.uniforms.vignetteStrength.value).toBe(0.7);
    expect(vignette.material.uniforms.grainStrength.value).toBe(0.03);
    expect(HORROR_POST_FRAGMENT_SHADER).toContain('colorspace_fragment');
    vignette.setTime(2.5);
    vignette.setEffects({ vignette: 0.4 });
    expect(vignette.material.uniforms.time.value).toBe(2.5);
    expect(vignette.material.uniforms.vignetteStrength.value).toBe(0.4);
    vignette.dispose();
  });

  it('full-screen pass را بدون ساخت WebGL context می‌توان اندازه‌دهی و dispose کرد', () => {
    const renderer = {} as THREE.WebGLRenderer;
    const pass = new HorrorPostProcessor(renderer, 0, 0);
    pass.resize(640, 360);
    expect(pass.vignette.material.uniforms.resolution.value.toArray()).toEqual([640, 360]);
    pass.dispose();
    pass.dispose();
  });
});

describe('فاز ۰۷ — صدای محیطی و ضربان قلب رویه‌ای', () => {
  it('با افزایش ترس فاصلهٔ ضربان‌ها کم می‌شود', () => {
    expect(heartbeatIntervalMs(0)).toBeCloseTo(60_000 / 58);
    expect(heartbeatIntervalMs(1)).toBeCloseTo(60_000 / 140);
    expect(heartbeatIntervalMs(2)).toBe(heartbeatIntervalMs(1));
  });

  it('HorrorAudio در SSR/Node بی‌خطر است و بدون init متدها no-op هستند', async () => {
    const audio = new HorrorAudio();
    expect(audio.isInitialized).toBe(false);
    await expect(audio.init()).resolves.toBe(false);
    expect(() => {
      audio.startAmbience();
      audio.startHeartbeat();
      audio.triggerHeartbeat();
      audio.setFearLevel(0.9);
      audio.setMuted(true);
      audio.stopHeartbeat();
      audio.stopAmbience();
    }).not.toThrow();
    expect(audio.fear).toBe(0.9);
    expect(audio.isMuted).toBe(true);
    await audio.dispose();
  });
});
