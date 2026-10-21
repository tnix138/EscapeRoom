// تست زمان‌بندی افکت‌های صوتی داستان (Issue #96 / #97)
// معیار: هر افکت دقیقاً یک بار، فقط وقتی پخش از روی آن عبور می‌کند، و پرش میان‌کات‌سین
// افکت‌های قدیمی را دوباره پخش نمی‌کند.
import { describe, expect, it } from 'vitest';
import {
  ORFEO_STORY_AUDIO_CUES,
  StoryCueDirector,
  type StoryAudioCueId,
} from '../../src/audio/story-cue-director';

function play(
  director: StoryCueDirector,
  frames: number[],
): { fired: StoryAudioCueId[]; pans: number[] } {
  const fired: StoryAudioCueId[] = [];
  const pans: number[] = [];
  for (const elapsed of frames) {
    director.update(elapsed, (cue) => {
      fired.push(cue.id);
      pans.push(cue.pan);
    });
  }
  return { fired, pans };
}

describe('StoryCueDirector — عبور از روی افکت‌ها', () => {
  it('پخش پیوستهٔ ۷۴ ثانیه همهٔ ۵ افکت را به ترتیب زمان پخش می‌کند', () => {
    const director = new StoryCueDirector();
    const frames = Array.from({ length: 150 }, (_, i) => i * 500);
    const { fired } = play(director, frames);
    expect(fired).toEqual(ORFEO_STORY_AUDIO_CUES.map((cue) => cue.id));
    expect(fired).toEqual([
      'door-creak',
      'curtain-sweep',
      'shadow-breath',
      'audience-gasp',
      'final-whisper',
    ]);
  });

  it('عبور گام‌به‌گام از یک افکت آن را فقط یک بار پخش می‌کند', () => {
    const director = new StoryCueDirector();
    const { fired } = play(director, [0, 1_000, 1_800, 1_900, 2_000]);
    expect(fired).toEqual(['door-creak']);
  });

  it('پرش یک‌باره تا آخر کات‌سین افکت‌های گذشته را دوباره پخش نمی‌کند', () => {
    const director = new StoryCueDirector();
    const { fired } = play(director, [0, 74_000]);
    expect(fired).toEqual([]);
  });

  it('افکت دیررس (بیش از آستانهٔ مجاز) پخش نمی‌شود اما در گام‌های دقیق پخش می‌شود', () => {
    const relaxed = new StoryCueDirector();
    expect(play(relaxed, [0, 24_000]).fired).toEqual(['curtain-sweep']);

    const strict = new StoryCueDirector(undefined, 100);
    const frames = Array.from({ length: 4 }, (_, i) => i * 1_000);
    // door-creak در ۱٬۷۰۰ است و در گام ۲٬۰۰۰ با ۳۰۰ms تأخیر می‌رسد؛ سقف ۱۰۰ms آن را رد می‌کند
    expect(play(strict, frames).fired).toEqual([]);
  });

  it('زمان نامعتبر نادیده گرفته می‌شود و reset همه‌چیز را برمی‌گرداند', () => {
    const director = new StoryCueDirector();
    const { fired } = play(director, [Number.NaN, Number.POSITIVE_INFINITY, 0, 2_000]);
    expect(fired).toEqual(['door-creak']);

    director.reset();
    const afterReset = play(director, [2_000]);
    // پس از reset، اولین فریم فقط لنگر زمان است و افکت گذشته دوباره پخش نمی‌شود
    expect(afterReset.fired).toEqual([]);
  });

  it('پن افکت‌ها با موقعیت صحنه هم‌خوان است (سایه چپ، همهمه راست)', () => {
    const director = new StoryCueDirector();
    const { fired, pans } = play(
      director,
      Array.from({ length: 150 }, (_, i) => i * 500),
    );
    const panOf = (id: StoryAudioCueId) => pans[fired.indexOf(id)];
    expect(panOf('shadow-breath')).toBeLessThan(0);
    expect(panOf('final-whisper')).toBeGreaterThan(0);
    expect(panOf('door-creak')).toBe(0);
  });
});
