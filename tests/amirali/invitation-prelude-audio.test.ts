import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  INVITATION_EIGHTH_SEC,
  INVITATION_SCORE_BARS,
  INVITATION_STEPS_PER_BAR,
  InvitationPreludeAudio,
  clampUnitVolume,
  computeInvitationMasterGain,
  midiToHz,
} from '../../src/audio/invitation-prelude-audio';

const ROOT = resolve(__dirname, '../..');

interface MockOscRecord {
  type: OscillatorType;
  frequency: { value: number };
  detune: object;
  startedAt: number | null;
  stoppedAt: number | null;
}

function createMockAudioContextClass() {
  const oscillators: MockOscRecord[] = [];
  const delays: Array<{ delayTime: { value: number } }> = [];
  const filters: Array<{ type: BiquadFilterType; frequency: { value: number } }> = [];
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
      this.state = 'running';
    });

    close = vi.fn(async () => {
      closedCount += 1;
      this.state = 'closed';
    });

    createGain() {
      return new MockGainNode();
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
    getClosedCount: () => closedCount,
    getResumedCount: () => resumedCount,
  };
}

describe('invitation prelude Escape Room soundtrack (zero-noise replacement)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes the continuous 110/164.81/220 Hz static hum from InvitationCardVideo.tsx', () => {
    const componentSrc = readFileSync(
      resolve(ROOT, 'src/components/invitation/InvitationCardVideo.tsx'),
      'utf8',
    );
    expect(componentSrc).not.toContain('164.81');
    expect(componentSrc).not.toContain('[110,');
    expect(componentSrc).not.toContain('createOscillator');
    expect(componentSrc).toContain('InvitationPreludeAudio');
    expect(componentSrc).toContain('triggerSceneAccent');
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
    expect(clampUnitVolume(Number.NaN)).toBe(0.7);
    expect(computeInvitationMasterGain(1)).toBeLessThanOrEqual(0.65);
    expect(computeInvitationMasterGain(0)).toBe(0);
  });

  it('schedules enveloped finite notes (every oscillator has a finite stop time) and disposes cleanly', () => {
    vi.useFakeTimers();
    const mock = createMockAudioContextClass();
    const engine = new InvitationPreludeAudio(0.75);

    expect(engine.start(mock.Ctor)).toBe(true);
    expect(mock.getResumedCount()).toBe(1);
    expect(mock.delays.length).toBe(2);
    expect(mock.filters.length).toBeGreaterThanOrEqual(2);
    expect(mock.oscillators.length).toBeGreaterThan(0);

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

    engine.setVolume(0.4);
    engine.dispose();
    engine.dispose(); // فراخوانی مجدد امن است
    vi.advanceTimersByTime(150);
    expect(mock.getClosedCount()).toBe(1);
  });
});
