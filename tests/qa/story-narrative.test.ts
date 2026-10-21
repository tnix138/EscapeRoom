// تست روایت فاز ۱۱ (Issue #96 و #97) — دیالوگ، صدا و هم‌خوانی بیت‌های داستان
// معیارهای موفقیت: هم‌خوانی زمان‌بندی با contracts/types، رد متن خالی/بلند،
// و بی‌اسپویل بودن متن‌ها (جواب معما لو نمی‌رود).
import { describe, expect, it } from 'vitest';
import {
  TOTAL_CUTSCENE_DURATION_MS,
  type CutsceneBeatId,
} from '../../src/contracts/types';
import { CUTSCENE_BEAT_WINDOWS } from '../../src/audio/theater-audio-engine';
import {
  ORFEO_STORY_SCRIPT,
  getStoryCaptionAt,
  getStoryDialogueAt,
  type StoryDialogueCue,
} from '../../src/components/cinema/story-script';
import {
  STORY_TEXT_MAX_LENGTH,
  STORY_TEXT_MIN_LENGTH,
  findSpoilers,
  validateStoryScript,
} from './story-script-rules';
import {
  ORFEO_STORY_AUDIO_CUES,
  type StoryAudioCue,
} from '../../src/audio/story-cue-director';

const BEAT_OF = (atMs: number): CutsceneBeatId => {
  const window = CUTSCENE_BEAT_WINDOWS.find((item) => atMs >= item.startMs && atMs < item.endMs);
  if (!window) throw new Error(`زمان ${atMs} در هیچ بیت کات‌سین نیست`);
  return window.beat;
};

describe('فاز ۱۱-الف — نسخهٔ داستان سالم است', () => {
  it('بازبینی خودکار هیچ ایرادی پیدا نمی‌کند', () => {
    expect(validateStoryScript(ORFEO_STORY_SCRIPT)).toEqual([]);
  });

  it('دست‌کم ۸ بیت داستانی دارد و همهٔ متن‌ها در بازهٔ مجازند', () => {
    expect(ORFEO_STORY_SCRIPT.length).toBeGreaterThanOrEqual(8);
    for (const cue of ORFEO_STORY_SCRIPT) {
      expect(cue.textFa.trim().length).toBeGreaterThanOrEqual(STORY_TEXT_MIN_LENGTH);
      expect(cue.textFa.trim().length).toBeLessThanOrEqual(STORY_TEXT_MAX_LENGTH);
      expect(cue.speaker.length).toBeGreaterThan(0);
      expect(['dialogue', 'whisper', 'narration']).toContain(cue.delivery);
    }
  });

  it('هیچ بیت داستانی جواب معما را لو نمی‌دهد', () => {
    expect(findSpoilers(ORFEO_STORY_SCRIPT)).toEqual([]);
  });
});

describe('فاز ۱۱-الف — هم‌خوانی زمان‌بندی با contracts/types', () => {
  it('همهٔ بیت‌ها داخل ۷۴ ثانیهٔ کات‌سین‌اند و ترتیب دارند', () => {
    expect(TOTAL_CUTSCENE_DURATION_MS).toBe(74_000);
    let previousEnd = 0;
    for (const cue of ORFEO_STORY_SCRIPT) {
      expect(cue.startMs).toBeGreaterThanOrEqual(previousEnd);
      expect(cue.endMs).toBeLessThanOrEqual(TOTAL_CUTSCENE_DURATION_MS);
      previousEnd = cue.endMs;
    }
  });

  it('هر بیت داستانی در یک بیت رسمی CutsceneBeatId شروع می‌شود', () => {
    for (const cue of ORFEO_STORY_SCRIPT) {
      expect(() => BEAT_OF(cue.startMs)).not.toThrow();
    }
    // همهٔ ۱۰ بیت رسمی دست‌کم یک بار پوشش داده می‌شوند یا عمداً بی‌دیالوگ‌اند
    const covered = new Set(ORFEO_STORY_SCRIPT.map((cue) => BEAT_OF(cue.startMs)));
    expect(covered.size).toBeGreaterThanOrEqual(7);
    expect(CUTSCENE_BEAT_WINDOWS).toHaveLength(10);
  });

  it('فقط راوی/دربان/بانوی صحنه/مرد سیاه‌پوش/همهمه حرف می‌زنند', () => {
    const speakers = new Set(ORFEO_STORY_SCRIPT.map((cue) => cue.speaker));
    for (const speaker of speakers) {
      expect(['راوی', 'دربان', 'بانوی صحنه', 'مرد سیاه‌پوش', 'همهمهٔ تالار']).toContain(speaker);
    }
  });
});

describe('فاز ۱۱-الف — رفتار بازبینی و انتخاب بیت', () => {
  const cue = (overrides: Partial<StoryDialogueCue>): StoryDialogueCue => ({
    id: 'test-cue',
    startMs: 1_000,
    endMs: 3_000,
    speaker: 'راوی',
    delivery: 'narration',
    textFa: 'یک متن آزمایشی کوتاه',
    ...overrides,
  });

  it('متن خالی یا خیلی بلند را رد می‌کند', () => {
    expect(validateStoryScript([cue({ textFa: '   ' })])).toEqual([
      { cueId: 'test-cue', problem: 'empty-text' },
    ]);
    expect(validateStoryScript([cue({ textFa: 'ا'.repeat(STORY_TEXT_MAX_LENGTH + 1) })])).toEqual([
      { cueId: 'test-cue', problem: 'too-long' },
    ]);
  });

  it('بازهٔ خالی، بیرون از ۷۴ ثانیه، هم‌پوشانی، ترتیب نادرست و شناسهٔ تکراری را می‌گیرد', () => {
    expect(validateStoryScript([cue({ startMs: 5_000, endMs: 5_000 })])).toContainEqual({
      cueId: 'test-cue',
      problem: 'empty-range',
    });
    expect(validateStoryScript([cue({ startMs: 73_000, endMs: 80_000 })])).toContainEqual({
      cueId: 'test-cue',
      problem: 'out-of-range',
    });
    const overlapping = [cue({ id: 'a', startMs: 0, endMs: 5_000 }), cue({ id: 'b', startMs: 4_000, endMs: 9_000 })];
    expect(validateStoryScript(overlapping)).toContainEqual({ cueId: 'b', problem: 'overlap' });
    const unsorted = [cue({ id: 'a', startMs: 5_000, endMs: 6_000 }), cue({ id: 'b', startMs: 1_000, endMs: 2_000 })];
    expect(validateStoryScript(unsorted)).toContainEqual({ cueId: 'b', problem: 'not-sorted' });
    const duplicated = [cue({ id: 'a', startMs: 0, endMs: 1_000 }), cue({ id: 'a', startMs: 2_000, endMs: 3_000 })];
    expect(validateStoryScript(duplicated)).toContainEqual({ cueId: 'a', problem: 'duplicate-id' });
  });

  it('انتخاب بیت در لبه‌ها: شروع شامل، پایان غیرشامل، بیرون null', () => {
    const first = ORFEO_STORY_SCRIPT[0] as StoryDialogueCue;
    expect(getStoryDialogueAt(first.startMs)?.id).toBe(first.id);
    expect(getStoryDialogueAt(first.endMs)).toBeNull();
    expect(getStoryDialogueAt(-1)).toBeNull();
    expect(getStoryDialogueAt(TOTAL_CUTSCENE_DURATION_MS)).toBeNull();
    expect(getStoryDialogueAt(Number.NaN)).toBeNull();
  });

  it('کپشن فقط گوینده و متن را برمی‌گرداند', () => {
    const first = ORFEO_STORY_SCRIPT[0] as StoryDialogueCue;
    expect(getStoryCaptionAt(first.startMs)).toEqual({
      speaker: first.speaker,
      textFa: first.textFa,
    });
    expect(getStoryCaptionAt(-5)).toBeNull();
  });
});

describe('فاز ۱۱-الف — افکت‌های صوتی داستان', () => {
  it('همهٔ افکت‌ها داخل زمان کات‌سین و با پن در بازهٔ مجازند', () => {
    expect(ORFEO_STORY_AUDIO_CUES.length).toBeGreaterThanOrEqual(5);
    let previous = 0;
    for (const item of ORFEO_STORY_AUDIO_CUES as readonly StoryAudioCue[]) {
      expect(item.atMs).toBeGreaterThanOrEqual(previous);
      expect(item.atMs).toBeLessThan(TOTAL_CUTSCENE_DURATION_MS);
      expect(item.pan).toBeGreaterThanOrEqual(-1);
      expect(item.pan).toBeLessThanOrEqual(1);
      previous = item.atMs;
    }
  });

  it('شناسهٔ افکت‌ها یکتاست و هر کدام به یک بیت معتبر می‌خورند', () => {
    const ids = ORFEO_STORY_AUDIO_CUES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of ORFEO_STORY_AUDIO_CUES) {
      expect(() => BEAT_OF(item.atMs)).not.toThrow();
    }
  });
});
