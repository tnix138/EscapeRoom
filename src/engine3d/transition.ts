'use client';

/**
 * transition.ts — مدیریت گذارها بین فازها (علیرضا — موج ۵)
 * - دعوت‌نامه → کوچه (loading feedback)
 * - کوچه → در (باز شدن در)
 * - در → کات‌سین (فید سیاه سینمایی)
 * - بازگشت از کات‌سین به سالن تاریک
 */

export type TransitionPhase = 'idle' | 'loading' | 'door_opening' | 'entering_theater' | 'fading_to_cutscene';

export interface TransitionState {
  phase: TransitionPhase;
  progress: number; // 0..1
  messageFa: string;
}

export function getTransitionMessage(phase: TransitionPhase): string {
  switch (phase) {
    case 'loading':
      return 'در حال بارگذاری کوچه تماشاخانه…';
    case 'door_opening':
      return 'قفل برنجی آزاد شد — درهای سنگین گشوده می‌شوند…';
    case 'entering_theater':
      return 'وارد سالن می‌شوید…';
    case 'fading_to_cutscene':
      return 'چراغ‌ها خاموش می‌شوند و پرده بالا می‌رود…';
    default:
      return '';
  }
}

export function createTransitionState(phase: TransitionPhase, progress: number): TransitionState {
  return {
    phase,
    progress: Math.min(1, Math.max(0, progress)),
    messageFa: getTransitionMessage(phase),
  };
}

/**
 * محاسبه پیشرفت فید سیاه بین کوچه و کات‌سین
 */
export function doorTransitionProgress(elapsedMs: number, durationMs = 2200): number {
  if (elapsedMs <= 0) return 0;
  if (elapsedMs >= durationMs) return 1;
  return elapsedMs / durationMs;
}
