import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  INVITATION_DEFAULT_VOLUME,
  INVITATION_EIGHTH_SEC,
  INVITATION_FADE_IN_SEC,
  INVITATION_MAX_MASTER_GAIN,
  INVITATION_SCORE_BARS,
  INVITATION_STEPS_PER_BAR,
  InvitationPreludeAudio,
  clampUnitVolume,
  computeInvitationMasterGain,
  midiToHz,
  resolveInitialInvitationVolume,
} from '../../src/audio/invitation-prelude-audio';

const ROOT = resolve(__dirname, '../..');

interface MockOscRecord {
  type: OscillatorType;
  frequency: { value: number };
  detune: object;
  startedAt: number | null;
  stoppedAt: number | null;
}

function createMockAudioContextClass(options?: { staySuspendedOnFirstResume?: boolean }) {
  const oscillators: MockOscRecord[] = [];
  const delays: Array<{ delayTime: { value: number } }> = [];
  const filters: Array<{ type: BiquadFilterType; frequency: { value: number } }> = [];
  const gains: Array<{
    gain: {
      value: number;
      setValueAtTime: ReturnType<typeof vi.fn>;
      linearRampToValueAtTime: ReturnType<typeof vi.fn>;
      setTargetAtTime: ReturnType<typeof vi.fn>;
    };
  }> = [];
  let closedCount = 0;
  let resumedCount = 0;

  class MockAudioParam {
    value = 0;
    setValueAtTime = vi.fn((val: number) => {
      this.value = val;
    });
    linearRampToValueAtTime = vi.fn((val: number) => {
      this.value = val;
    });
    exponentialRampToValueAtTime = vi.fn((val: number) => {
      this.value = val;
    });
    setTargetAtTime = vi.fn((val: number) => {
      this.value = val;
    });
    cancelScheduledValues = vi.fn();
  }

  class MockNode {
    connect = vi.fn((target: unknown) => target);
  }

  class MockGainNode extends MockNode {
    gain = new MockAudioParam();
  }

  class MockFilterNode extends MockNode {
    type: BiquadFilterType = 'lowpass';
    frequency = new MockAudioParam();
    Q = new MockAudioParam();
  }

  class MockDelayNode extends MockNode {
    delayTime = new MockAudioParam();
  }

  class MockStereoPannerNode extends MockNode {
    pan = new MockAudioParam();
  }

  class MockAudioContext {
    currentTime = 1.0;
    state: AudioContextState = 'suspended';
    destination = new MockNode();

    resume = vi.fn(async () => {
      resumedCount += 1;
      if (options?.staySuspendedOnFirstResume && resumedCount === 1) {
        return;
      }
      this.state = 'running';
    });

    close = vi.fn(async () => {
      closedCount += 1;
      this.state = 'closed';
    });

    createGain() {
      const node = new MockGainNode();
      gains.push(node);
      return node;
    }

    createBiquadFilter() {
      const node = new MockFilterNode();
      filters.push(node);
      return node;
    }

    createDelay() {
      const node = new MockDelayNode();
      delays.push(node);
      return node;
    }

    createStereoPanner() {
      return new MockStereoPannerNode();
    }

    createOscillator() {
      const record: MockOscRecord = {
        type: 'sine',
        frequency: { value: 440 },
        detune: new MockAudioParam(),
        startedAt: null,
        stoppedAt: null,
      };
      oscillators.push(record);
      return {
        get type() {
          return record.type;
        },
        set type(next: OscillatorType) {
          record.type = next;
        },
        frequency: record.frequency,
        detune: record.detune,
        connect: vi.fn(),
        start: vi.fn((when = 0) => {
          record.startedAt = when;
        }),
        stop: vi.fn((when = 0) => {
          record.stoppedAt = when;
        }),
      };
    }
  }

  return {
    Ctor: MockAudioContext as unknown as typeof AudioContext,
    oscillators,
    delays,
    filters,
    gains,
    getClosedCount: () => closedCount,
    getResumedCount: () => resumedCount,
  };
}

describe('invitation prelude Escape Room soundtrack (auto-play + gentle normal volume)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('auto-plays from page entry at a gentle normal default volume and removes the old static hum', () => {
    const componentSrc = readFileSync(
      resolve(ROOT, 'src/components/invitation/InvitationCardVideo.tsx'),
      'utf8',
    );
    expect(componentSrc).not.toContain('164.81');
    expect(componentSrc).not.toContain('[110,');
    expect(componentSrc).not.toContain('createOscillator');
    expect(componentSrc).toContain('InvitationPreludeAudio');
    expect(componentSrc).toContain('triggerSceneAccent');
    expect(componentSrc).toContain('const [musicOn, setMusicOn] = useState(true)');
    expect(componentSrc).toContain('useState(INVITATION_DEFAULT_VOLUME)');
    expect(componentSrc).toContain('resolveInitialInvitationVolume');
  });

  it('contains zero white/pink noise buffers in invitation-prelude-audio.ts', () => {
    const engineSrc = readFileSync(
      resolve(ROOT, 'src/audio/invitation-prelude-audio.ts'),
      'utf8',
    );
    expect(engineSrc).not.toContain('Math.random');
    expect(engineSrc).not.toContain('createBufferSource');
    expect(engineSrc).not.toContain('sawtooth');
  });

  it('calibrates default volume and master gain to a comfortable, non-fatiguing normal level', () => {
    expect(INVITATION_DEFAULT_VOLUME).toBeGreaterThanOrEqual(0.35);
    expect(INVITATION_DEFAULT_VOLUME).toBeLessThanOrEqual(0.5);
    expect(INVITATION_FADE_IN_SEC).toBeGreaterThanOrEqual(1.0);
    expect(INVITATION_MAX_MASTER_GAIN).toBeLessThanOrEqual(0.38);

    // در شروع خودکار با بلندی نرمال، بهرهٔ خروجی ملایم است تا گوش را اذیت نکند
    const defaultGain = computeInvitationMasterGain(INVITATION_DEFAULT_VOLUME);
    expect(defaultGain).toBeGreaterThan(0.1);
    expect(defaultGain).toBeLessThan(0.2);

    // اگر کاربر قبلاً صدای کمتری تنظیم کرده بود حفظ شود، ولی صدای بلند قبلی در شروع خودکار محدود شود
    expect(resolveInitialInvitationVolume(0.9)).toBe(INVITATION_DEFAULT_VOLUME);
    expect(resolveInitialInvitationVolume(0.7)).toBe(INVITATION_DEFAULT_VOLUME);
    expect(resolveInitialInvitationVolume(0.25)).toBe(0.25);
    expect(resolveInitialInvitationVolume(0)).toBe(INVITATION_DEFAULT_VOLUME);
    expect(resolveInitialInvitationVolume(undefined)).toBe(INVITATION_DEFAULT_VOLUME);
  });

  it('defines a complete 8-bar D harmonic minor mystery score in natural acoustic registers', () => {
    expect(INVITATION_SCORE_BARS).toHaveLength(8);
    expect(INVITATION_EIGHTH_SEC).toBeGreaterThan(0.25);

    for (const bar of INVITATION_SCORE_BARS) {
      expect(bar.bassMidi).toBeGreaterThanOrEqual(28);
      expect(bar.bassMidi).toBeLessThanOrEqual(45);
      expect(bar.arpeggioMidi).toHaveLength(INVITATION_STEPS_PER_BAR);
      for (const note of bar.arpeggioMidi) {
        expect(note).toBeGreaterThanOrEqual(40);
        expect(note).toBeLessThanOrEqual(72);
      }
      for (const [beat, celestaMidi] of bar.celestaHits) {
        expect(beat).toBeGreaterThanOrEqual(0);
        expect(beat).toBeLessThan(INVITATION_STEPS_PER_BAR);
        expect(celestaMidi).toBeGreaterThanOrEqual(68);
        expect(celestaMidi).toBeLessThanOrEqual(92);
      }
    }

    expect(midiToHz(69)).toBeCloseTo(440, 5);
    expect(midiToHz(57)).toBeCloseTo(220, 5);
    expect(clampUnitVolume(-0.4)).toBe(0);
    expect(clampUnitVolume(1.8)).toBe(1);
    expect(clampUnitVolume(Number.NaN)).toBe(INVITATION_DEFAULT_VOLUME);
    expect(computeInvitationMasterGain(1)).toBeLessThanOrEqual(0.38);
    expect(computeInvitationMasterGain(0)).toBe(0);
  });

  it('schedules enveloped finite notes, preserves smooth fade-in, and unlocks suspended autoplay on first gesture', async () => {
    vi.useFakeTimers();
    const listeners = new Map<string, EventListener>();
    vi.stubGlobal('window', {
      addEventListener: vi.fn((evt: string, fn: EventListener) => {
        listeners.set(evt, fn);
      }),
      removeEventListener: vi.fn((evt: string) => {
        listeners.delete(evt);
      }),
    });

    const mock = createMockAudioContextClass({ staySuspendedOnFirstResume: true });
    const engine = new InvitationPreludeAudio(INVITATION_DEFAULT_VOLUME);

    expect(engine.start(mock.Ctor)).toBe(true);
    expect(mock.getResumedCount()).toBe(1);
    expect(listeners.has('pointerdown')).toBe(true);

    // فراخوانی setVolume با همان مقدار اولیه نباید شیب نرم Fade-In را با setTargetAtTime بشکند
    const masterGainNode = mock.gains[0];
    engine.setVolume(INVITATION_DEFAULT_VOLUME);
    expect(masterGainNode.gain.setTargetAtTime).not.toHaveBeenCalled();

    // اولین اشارهٔ کاربر در مرورگر، AudioContext معلق را خودکار فعال و شنونده‌ها را پاک می‌کند
    listeners.get('pointerdown')?.(new Event('pointerdown'));
    await Promise.resolve();
    expect(mock.getResumedCount()).toBe(2);
    expect(listeners.size).toBe(0);

    // زنگ ظریف باز شدن پاکت و بلیط‌ها
    const beforeAccentCount = mock.oscillators.length;
    engine.triggerSceneAccent('card');
    engine.triggerSceneAccent('tickets');
    expect(mock.oscillators.length).toBeGreaterThan(beforeAccentCount);

    // تضمین کلیدی عدم وجود نویز/وزوز ممتد: هر نوسان‌ساز حتماً زمان توقف مشخص دارد
    for (const osc of mock.oscillators) {
      expect(osc.startedAt).not.toBeNull();
      expect(osc.stoppedAt).not.toBeNull();
      expect(osc.stoppedAt!).toBeGreaterThan(osc.startedAt!);
    }

    engine.dispose();
    engine.dispose();
    vi.advanceTimersByTime(150);
    expect(mock.getClosedCount()).toBe(1);
  });
});
