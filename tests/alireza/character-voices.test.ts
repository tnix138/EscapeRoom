import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ORFEO_STORY_SCRIPT, type StorySpeaker } from '../../src/components/cinema/story-script';
import {
  CHARACTER_VOICE_PROFILES,
  CharacterVoiceDirector,
  getDialogueAudioUrl,
  trimAudioBufferSilence,
} from '../../src/audio/character-voices';
import { TheaterAudioEngine } from '../../src/audio/theater-audio-engine';

const MPEG_V1_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MPEG_LOW_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44_100, 48_000, 32_000, 0],
  2: [22_050, 24_000, 16_000, 0],
  0: [11_025, 12_000, 8_000, 0],
};

function measureMp3DurationMs(bytes: Buffer): number {
  let pos = 0;
  if (bytes.subarray(0, 3).toString('ascii') === 'ID3') {
    const id3Size =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);
    pos = 10 + id3Size;
  }
  let durationSec = 0;
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] === 0xff && (bytes[pos + 1] & 0xe0) === 0xe0) {
      const version = (bytes[pos + 1] >> 3) & 3;
      const layer = (bytes[pos + 1] >> 1) & 3;
      const bitrateIdx = (bytes[pos + 2] >> 4) & 0xf;
      const srIdx = (bytes[pos + 2] >> 2) & 3;
      const padding = (bytes[pos + 2] >> 1) & 1;
      const bitrateTable = version === 3 ? MPEG_V1_BITRATES : MPEG_LOW_BITRATES;
      const bitrate = (bitrateTable[bitrateIdx] ?? 0) * 1000;
      const sampleRate = SAMPLE_RATES[version]?.[srIdx] ?? 0;
      if (bitrate > 0 && sampleRate > 0 && layer === 1) {
        const samplesPerFrame = version === 3 ? 1152 : 576;
        const frameLength = Math.floor(((samplesPerFrame / 8) * bitrate) / sampleRate + padding);
        durationSec += samplesPerFrame / sampleRate;
        pos += Math.max(1, frameLength);
        continue;
      }
    }
    pos += 1;
  }
  return durationSec * 1000;
}

function makeFakeAudioBuffer(channels: Float32Array[], sampleRate = 1000): AudioBuffer {
  const length = channels[0]?.length ?? 0;
  return {
    sampleRate,
    length,
    duration: sampleRate > 0 ? length / sampleRate : 0,
    numberOfChannels: channels.length,
    getChannelData: (ch: number) => channels[ch]!,
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

function makeFakeAudioContext() {
  const startedSources: Array<{
    when: number;
    offset: number;
    playbackRate: number;
    triggerEnded: () => void;
    stopped: boolean;
  }> = [];

  const ctx = {
    currentTime: 10,
    createBuffer: (numChannels: number, length: number, sampleRate: number) => {
      const chans = Array.from({ length: numChannels }, () => new Float32Array(length));
      return makeFakeAudioBuffer(chans, sampleRate);
    },
    createGain: () => ({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      },
      connect: vi.fn(),
    }),
    createBiquadFilter: () => ({
      type: 'peaking',
      frequency: { value: 1000 },
      Q: { value: 1 },
      gain: { value: 0 },
      connect: vi.fn(),
    }),
    createStereoPanner: () => ({
      pan: { value: 0 },
      connect: vi.fn(),
    }),
    createDelay: () => ({
      delayTime: { value: 0 },
      connect: vi.fn(),
    }),
    createBufferSource: () => {
      const record = {
        when: 0,
        offset: 0,
        playbackRate: 1,
        triggerEnded: () => {},
        stopped: false,
      };
      const node = {
        buffer: null as AudioBuffer | null,
        playbackRate: {
          get value() {
            return record.playbackRate;
          },
          set value(v: number) {
            record.playbackRate = v;
          },
        },
        onended: null as (() => void) | null,
        connect: vi.fn(),
        start: (when = 0, offset = 0) => {
          record.when = when;
          record.offset = offset;
          record.triggerEnded = () => node.onended?.();
          startedSources.push(record);
        },
        stop: () => {
          record.stopped = true;
        },
      };
      return node;
    },
  };

  return { ctx: ctx as unknown as AudioContext, startedSources };
}

describe('صدای هوش مصنوعی کاراکترها — فایل‌های صوتی، پروفایل‌ها و کارگردان پخش', () => {
  it('هر ۱۰ دیالوگ کات‌سین فایل MP3 معتبر روی دیسک دارند و با دیالوگ بعدی هم‌پوشانی ندارند', () => {
    expect(ORFEO_STORY_SCRIPT).toHaveLength(10);

    for (let i = 0; i < ORFEO_STORY_SCRIPT.length; i++) {
      const cue = ORFEO_STORY_SCRIPT[i]!;
      const url = getDialogueAudioUrl(cue.id);
      const diskPath = path.join(process.cwd(), 'public', url);

      expect(existsSync(diskPath), `فایل صوتی ${url} یافت نشد`).toBe(true);
      const raw = readFileSync(diskPath);
      expect(raw.byteLength).toBeGreaterThan(2_000);

      const profile = CHARACTER_VOICE_PROFILES[cue.speaker];
      const effectiveDurationMs = measureMp3DurationMs(raw) / profile.playbackRate;
      expect(effectiveDurationMs).toBeGreaterThan(500);

      const nextCue = ORFEO_STORY_SCRIPT[i + 1];
      const ceilingMs = nextCue ? nextCue.startMs : 74_000;
      expect(
        cue.startMs + effectiveDurationMs,
        `دیالوگ ${cue.id} وارد بازه دیالوگ بعدی می‌شود`,
      ).toBeLessThanOrEqual(ceilingMs);
    }
  });

  it('پروفایل صوتی هر ۵ شخصیت در بازه ایمن آکوستیکی تعریف شده است', () => {
    const speakers: StorySpeaker[] = [
      'دربان',
      'راوی',
      'بانوی صحنه',
      'مرد سیاه‌پوش',
      'همهمهٔ تالار',
    ];
    const roleIds = new Set<string>();
    for (const speaker of speakers) {
      const profile = CHARACTER_VOICE_PROFILES[speaker];
      roleIds.add(profile.roleId);
      expect(profile.basePan).toBeGreaterThanOrEqual(-1);
      expect(profile.basePan).toBeLessThanOrEqual(1);
      expect(profile.playbackRate).toBeGreaterThan(0.8);
      expect(profile.playbackRate).toBeLessThan(1.25);
      expect(profile.duckLevel).toBeGreaterThan(0.2);
      expect(profile.duckLevel).toBeLessThanOrEqual(1);
    }
    expect(roleIds.size).toBe(5);
  });

  it('trimAudioBufferSilence سکوت ابتدا و انتها را می‌برد و بافر ساکت را خراب نمی‌کند', () => {
    const { ctx } = makeFakeAudioContext();
    const samples = new Float32Array(1_000);
    for (let i = 300; i <= 600; i++) samples[i] = 0.4;
    const trimmed = trimAudioBufferSilence(ctx, makeFakeAudioBuffer([samples], 1_000));
    expect(trimmed.length).toBeLessThan(400);
    expect(trimmed.length).toBeGreaterThan(300);

    const silent = makeFakeAudioBuffer([new Float32Array(200)], 1_000);
    expect(trimAudioBufferSilence(ctx, silent).length).toBe(200);
  });

  it('CharacterVoiceDirector پخش ترتیبی، هم‌سرایی همهمه، پرش زمانی و Auto-Ducking را مدیریت می‌کند', async () => {
    const { ctx, startedSources } = makeFakeAudioContext();
    const outputBus = ctx.createGain();
    const duckHistory: number[] = [];

    const director = new CharacterVoiceDirector({
      loader: async () => makeFakeAudioBuffer([new Float32Array(4_000).fill(0.2)], 1_000),
      onDuckChange: (level) => duckHistory.push(level),
    });
    director.attach(ctx, outputBus);
    await director.preloadAll();
    expect(director.loadedCount).toBe(10);

    // پخش عادی از ثانیه صفر به دیالوگ اول دربان
    director.syncToElapsedMs(0);
    director.syncToElapsedMs(2_650);
    expect(director.activeCueId).toBe('usher-invitation');
    expect(startedSources).toHaveLength(1);
    expect(startedSources[0]!.offset).toBe(0);
    expect(duckHistory.at(-1)).toBeCloseTo(CHARACTER_VOICE_PROFILES['دربان'].duckLevel);

    // تیک بعدی داخل همان جمله نباید دوباره پخش را شروع کند
    director.syncToElapsedMs(2_700);
    expect(startedSources).toHaveLength(1);

    // پرش زمانی به همهمهٔ تالار (۳۳٬۵۰۰ms = ۱٫۵ ثانیه داخل shadow-warning) -> ۱ منبع اصلی + ۲ لایه شبح‌وار
    director.syncToElapsedMs(33_500);
    expect(director.activeCueId).toBe('shadow-warning');
    expect(startedSources[0]!.stopped).toBe(true);
    expect(startedSources).toHaveLength(4);
    expect(startedSources[1]!.offset).toBeGreaterThan(1.4);

    // پایان دیالوگ سطح Ducking را به ۱ برمی‌گرداند
    startedSources[1]!.triggerEnded();
    expect(director.activeCueId).toBeNull();
    expect(duckHistory.at(-1)).toBe(1);

    director.dispose();
  });

  it('متدهای جدید TheaterAudioEngine در محیط بدون مرورگر امن و بدون خطا هستند', async () => {
    const engine = new TheaterAudioEngine();
    expect(engine.activeCharacterCueId).toBeNull();
    await expect(engine.preloadVoices()).resolves.toBeUndefined();
    await expect(engine.playCharacterCue('usher-invitation')).resolves.toBe(false);
    expect(() => engine.stopCharacterVoice()).not.toThrow();
  });
});
