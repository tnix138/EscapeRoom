export type StorySpeaker = 'راوی' | 'دربان' | 'بانوی صحنه' | 'مرد سیاه‌پوش' | 'همهمهٔ تالار';
export type StoryDelivery = 'dialogue' | 'whisper' | 'narration';

export interface StoryDialogueCue {
  id: string;
  startMs: number;
  endMs: number;
  speaker: StorySpeaker;
  textFa: string;
  delivery: StoryDelivery;
}

/** Persian story/dialogue track for Orfeo's 74-second cutscene; intervals are [startMs, endMs). */
export const ORFEO_STORY_SCRIPT: readonly StoryDialogueCue[] = [
  {
    id: 'usher-invitation', startMs: 2_600, endMs: 5_700, speaker: 'دربان', delivery: 'dialogue',
    textFa: 'بلیط‌هایتان، لطفاً. این تالار فقط برای نام‌هایی که روی بلیط آمده باز می‌شود.',
  },
  {
    id: 'empty-seats', startMs: 12_300, endMs: 16_600, speaker: 'راوی', delivery: 'narration',
    textFa: 'بیست صندلی مخملی؛ و فقط شما. انگار سالن از پیش می‌دانست چند نفر دعوت می‌شوند.',
  },
  {
    id: 'soprano-first-verse', startMs: 25_500, endMs: 29_600, speaker: 'بانوی صحنه', delivery: 'dialogue',
    textFa: 'شب پرده را بالا می‌زند؛ هر سایه نامی دارد که هنوز نگفته‌ایم.',
  },
  {
    id: 'shadow-warning', startMs: 32_000, endMs: 36_500, speaker: 'همهمهٔ تالار', delivery: 'whisper',
    textFa: 'سمت چپ را نگاه کن… آن سایه با بقیه فرق دارد.',
  },
  {
    id: 'dark-man-offer', startMs: 40_400, endMs: 44_800, speaker: 'مرد سیاه‌پوش', delivery: 'dialogue',
    textFa: 'برای هر نمایش، یک تماشاگر لازم است. امشب، تو انتخاب می‌کنی.',
  },
  {
    id: 'singer-refusal', startMs: 46_000, endMs: 49_550, speaker: 'بانوی صحنه', delivery: 'dialogue',
    textFa: 'من برای تماشاگران نمی‌رقصم؛ برای آن‌که می‌شنود، آواز می‌خوانم.',
  },
  {
    id: 'dark-man-answer', startMs: 49_650, endMs: 52_750, speaker: 'مرد سیاه‌پوش', delivery: 'whisper',
    textFa: 'پس گوش کن.',
  },
  {
    id: 'audience-counted', startMs: 53_000, endMs: 55_800, speaker: 'راوی', delivery: 'narration',
    textFa: 'نگاهش دیگر به صحنه نیست. حالا شما را شمرده است.',
  },
  {
    id: 'theater-attack', startMs: 58_200, endMs: 64_900, speaker: 'راوی', delivery: 'narration',
    textFa: 'ضربه‌ها در تالار می‌پیچند؛ هر بار نزدیک‌تر، هر بار بی‌پاسخ‌تر.',
  },
  {
    id: 'final-refrain', startMs: 68_200, endMs: 73_800, speaker: 'همهمهٔ تالار', delivery: 'whisper',
    textFa: 'پرده هنوز نیفتاده… این تالار هنوز تماشاگر می‌خواهد.',
  },
] as const;

export function getStoryDialogueAt(elapsedMs: number): StoryDialogueCue | null {
  if (!Number.isFinite(elapsedMs)) return null;
  return ORFEO_STORY_SCRIPT.find(
    (cue) => elapsedMs >= cue.startMs && elapsedMs < cue.endMs,
  ) ?? null;
}

export function getStoryCaptionAt(elapsedMs: number): { speaker: StorySpeaker; textFa: string } | null {
  const cue = getStoryDialogueAt(elapsedMs);
  return cue ? { speaker: cue.speaker, textFa: cue.textFa } : null;
}
