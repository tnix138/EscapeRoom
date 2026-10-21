// tests/qa/story-script-rules.ts
// قواعد بازبینی نسخهٔ داستان (Issue #96 / #97).
// این قواعد عمداً بیرون از `src/components/cinema/**` نگه داشته می‌شوند تا
// محدودهٔ فایل مالک آن بخش (علیرضا) دست‌نخورده بماند؛ تست روایت با همین تابع،
// سالم بودن متن‌ها را در CI تضمین می‌کند و هر متن خالی/بلند/هم‌پوشان سوئیت را قرمز می‌کند.
import { TOTAL_CUTSCENE_DURATION_MS } from '../../src/contracts/types';
import type { StoryDialogueCue } from '../../src/components/cinema/story-script';

/** کوتاه‌ترین و بلندترین متن مجاز یک بیت داستانی. */
export const STORY_TEXT_MIN_LENGTH = 8;
export const STORY_TEXT_MAX_LENGTH = 150;

export type StoryScriptProblem =
  | 'empty-text'
  | 'too-long'
  | 'out-of-range'
  | 'empty-range'
  | 'overlap'
  | 'not-sorted'
  | 'duplicate-id';

export interface StoryScriptIssue {
  cueId: string;
  problem: StoryScriptProblem;
}

/**
 * بازبینی خودکار نسخهٔ داستان: متن خالی یا بیش از حد بلند، بازهٔ نامعتبر،
 * بیرون از طول کات‌سین، هم‌پوشانی، ترتیب نادرست و شناسهٔ تکراری.
 * خروجی خالی یعنی نسخهٔ داستان سالم است.
 */
export function validateStoryScript(
  script: readonly StoryDialogueCue[],
  durationMs = TOTAL_CUTSCENE_DURATION_MS,
): StoryScriptIssue[] {
  const issues: StoryScriptIssue[] = [];
  const seen = new Set<string>();
  let previousStart = Number.NEGATIVE_INFINITY;
  let previousEnd = Number.NEGATIVE_INFINITY;

  for (const cue of script) {
    const text = (cue.textFa ?? '').trim();
    if (text.length < STORY_TEXT_MIN_LENGTH) issues.push({ cueId: cue.id, problem: 'empty-text' });
    if (text.length > STORY_TEXT_MAX_LENGTH) issues.push({ cueId: cue.id, problem: 'too-long' });
    if (!Number.isFinite(cue.startMs) || !Number.isFinite(cue.endMs) || cue.endMs <= cue.startMs) {
      issues.push({ cueId: cue.id, problem: 'empty-range' });
    }
    if (cue.startMs < 0 || cue.endMs > durationMs) {
      issues.push({ cueId: cue.id, problem: 'out-of-range' });
    }
    if (cue.startMs < previousEnd) issues.push({ cueId: cue.id, problem: 'overlap' });
    if (cue.startMs < previousStart) issues.push({ cueId: cue.id, problem: 'not-sorted' });
    if (seen.has(cue.id)) issues.push({ cueId: cue.id, problem: 'duplicate-id' });

    seen.add(cue.id);
    previousStart = cue.startMs;
    previousEnd = Math.max(previousEnd, cue.endMs);
  }

  return issues;
}

/** الگوهای اسپویل: عدد سه‌رقمی/بیشتر و واژه‌های لو‌دهندهٔ جواب به‌صورت واژهٔ مستقل. */
const SPOILER_PATTERNS = [
  /[0-9۰-۹]{3,}/,
  /(?:^|[\s،؛.:!؟«»"'])(?:رمز|پاسخ|جواب|کدِ در)(?=$|[\s،؛.:!؟«»"'!])/,
];

/** بررسی می‌کند که متن هیچ بیتی جواب معما را لو نمی‌دهد. */
export function findSpoilers(script: readonly StoryDialogueCue[]): string[] {
  return script
    .filter((cue) => SPOILER_PATTERNS.some((pattern) => pattern.test(cue.textFa)))
    .map((cue) => cue.id);
}
