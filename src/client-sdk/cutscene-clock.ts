// src/client-sdk/cutscene-clock.ts — محاسبات خالص ساعت کات‌سین (قابل تست بدون مرورگر)
// فرمول قرارداد: clockOffset = serverNow - Date.now()
//              t = (Date.now() + clockOffset) - cutsceneStartedAt
import { TOTAL_CUTSCENE_DURATION_MS } from '../contracts/types';

export function computeClockOffset(serverNow: number, clientNow: number): number {
  return serverNow - clientNow;
}

export function computeCutsceneElapsedMs(
  cutsceneStartedAt: number | null,
  clockOffset: number,
  clientNow: number,
): number {
  if (cutsceneStartedAt === null) return 0;
  const elapsed = clientNow + clockOffset - cutsceneStartedAt;
  return Math.min(TOTAL_CUTSCENE_DURATION_MS, Math.max(0, elapsed));
}
