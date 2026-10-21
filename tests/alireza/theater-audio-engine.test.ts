/**
 * تست‌های موج ۱ علیرضا — موتور صدای فضایی تئاتر (theater-audio-engine)
 * اجرای تست‌ها: npm run test:alireza
 * نکته: بخش‌های خالص موتور (نگاشت بیت‌ها و پن استریو) بدون AudioContext تست می‌شوند؛
 * خود کلاس هم باید در محیط Node/SSR کاملاً امن و بی‌خطا باشد.
 */

import { describe, expect, it } from 'vitest';
import { TOTAL_CUTSCENE_DURATION_MS } from '../../src/contracts/types';
import {
  AUDIO_HEAD_PAN_MAX,
  CUTSCENE_BEAT_WINDOWS,
  SLAM_SURFACE_PAN,
  TheaterAudioEngine,
  beatFromElapsedMs,
  yawToStereoPan,
} from '../../src/audio/theater-audio-engine';

describe('نگاشت زمان کات‌سین به بیت‌ها (beatFromElapsedMs) — قرارداد API-CONTRACT.md', () => {
  it('همه مرزهای رسمی ۱۰ بیت دقیقاً روی ثانیه‌های قرارداد می‌افتند', () => {
    expect(beatFromElapsedMs(0)).toBe('door_usher_collects_tickets');
    expect(beatFromElapsedMs(10_999)).toBe('door_usher_collects_tickets');
    expect(beatFromElapsedMs(11_000)).toBe('enter_20_seat_tiered_salon');
    expect(beatFromElapsedMs(21_000)).toBe('classical_music_curtain_dance');
    expect(beatFromElapsedMs(31_000)).toBe('tall_dark_man_left_shadow');
    expect(beatFromElapsedMs(40_000)).toBe('man_walks_claps_extends_hand');
    expect(beatFromElapsedMs(46_000)).toBe('woman_sings_rejects_hand');
    expect(beatFromElapsedMs(50_000)).toBe('red_filthy_inversion_terror');
    expect(beatFromElapsedMs(53_000)).toBe('man_glares_pushes_players');
    expect(beatFromElapsedMs(56_000)).toBe('choke_slams_shake_chandelier');
    expect(beatFromElapsedMs(67_000)).toBe('vanish_dark_music_remains');
    expect(beatFromElapsedMs(73_999)).toBe('vanish_dark_music_remains');
  });

  it('خارج از بازه و ورودی نامعتبر امن کلمپ می‌شوند (سناریوی Refresh وسط کات‌سین)', () => {
    expect(beatFromElapsedMs(-5_000)).toBe('door_usher_collects_tickets');
    expect(beatFromElapsedMs(TOTAL_CUTSCENE_DURATION_MS)).toBe('vanish_dark_music_remains');
    expect(beatFromElapsedMs(999_999)).toBe('vanish_dark_music_remains');
    expect(beatFromElapsedMs(Number.NaN)).toBe('door_usher_collects_tickets');
  });

  it('پنجره‌های بیت‌ها بدون هیچ شکافی کل ۷۴ ثانیه را پوشش می‌دهند', () => {
    expect(CUTSCENE_BEAT_WINDOWS).toHaveLength(10);
    expect(CUTSCENE_BEAT_WINDOWS[0].startMs).toBe(0);
    for (let i = 1; i < CUTSCENE_BEAT_WINDOWS.length; i++) {
      expect(CUTSCENE_BEAT_WINDOWS[i].startMs).toBe(CUTSCENE_BEAT_WINDOWS[i - 1].endMs);
    }
    expect(CUTSCENE_BEAT_WINDOWS[CUTSCENE_BEAT_WINDOWS.length - 1].endMs).toBe(
      TOTAL_CUTSCENE_DURATION_MS,
    );
    expect(TOTAL_CUTSCENE_DURATION_MS).toBe(74_000);
  });
});

describe('تبدیل چرخش سر به پن استریو (yawToStereoPan)', () => {
  it('سر در مرکز یعنی صدای سِن دقیقاً روبه‌رو و متعادل است', () => {
    expect(yawToStereoPan(0)).toBe(0);
  });

  it('چرخش کامل به راست، صدای سِن را به گوش چپ می‌برد و برعکس', () => {
    expect(yawToStereoPan(42)).toBeCloseTo(-AUDIO_HEAD_PAN_MAX);
    expect(yawToStereoPan(-42)).toBeCloseTo(AUDIO_HEAD_PAN_MAX);
    expect(yawToStereoPan(21)).toBeCloseTo(-AUDIO_HEAD_PAN_MAX / 2);
  });

  it('زاویه خارج از بازه کلمپ و NaN خنثی می‌شود', () => {
    expect(yawToStereoPan(180)).toBeCloseTo(-AUDIO_HEAD_PAN_MAX);
    expect(yawToStereoPan(Number.NaN)).toBe(0);
  });
});

describe('جهت فضایی کوبش‌ها (SLAM_SURFACE_PAN)', () => {
  it('دیوار چپ کاملاً چپ و دیوار راست کاملاً راست است؛ بقیه مرکزی‌اند', () => {
    expect(SLAM_SURFACE_PAN['left-wall']).toBeLessThan(-0.8);
    expect(SLAM_SURFACE_PAN['right-wall']).toBeGreaterThan(0.8);
    expect(SLAM_SURFACE_PAN.door).toBe(0);
    expect(SLAM_SURFACE_PAN.floor).toBe(0);
    expect(SLAM_SURFACE_PAN.ceiling).toBe(0);
  });
});

describe('ایمنی کلاس TheaterAudioEngine بدون مرورگر (SSR/Node)', () => {
  it('بدون init همه متدهای عمومی بی‌صدا و بی‌خطا اجرا می‌شوند', () => {
    const engine = new TheaterAudioEngine();
    expect(engine.isInitialized).toBe(false);
    expect(engine.musicState).toBe('silent');
    expect(engine.isMuted).toBe(false);

    expect(() => {
      engine.setHeadYaw(30);
      engine.setMuted(true);
      engine.startClassical();
      engine.startSoprano();
      engine.playSlowClaps();
      engine.playHandRejection();
      engine.playSeatShockwave();
      engine.playBodySlam('left-wall');
      engine.playSlamSequence();
      engine.playChandelierFall();
      engine.startRoomRumble();
      engine.stopRoomRumble();
      engine.startHorrorAmbience();
      engine.stopAll();
    }).not.toThrow();

    expect(engine.isMuted).toBe(true);
  });

  it('applyBeat و syncToElapsedMs بیت جاری را حتی قبل از init ثبت می‌کنند', () => {
    const engine = new TheaterAudioEngine();
    engine.applyBeat('classical_music_curtain_dance');
    expect(engine.beat).toBe('classical_music_curtain_dance');
    const beat = engine.syncToElapsedMs(60_000);
    expect(beat).toBe('choke_slams_shake_chandelier');
    expect(engine.beat).toBe('choke_slams_shake_chandelier');
  });

  it('init در محیط بدون window به‌جای خطا false برمی‌گرداند', async () => {
    const engine = new TheaterAudioEngine();
    await expect(engine.init()).resolves.toBe(false);
  });
});
