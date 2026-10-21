// src/client-sdk/cutscene-clock.ts — محاسبات خالص ساعت کات‌سین (قابل تست بدون مرورگر)
// فرمول قرارداد: clockOffset = serverNow - Date.now()
//              t = (Date.now() + clockOffset) - cutsceneStartedAt
import { TOTAL_CUTSCENE_DURATION_MS } from '../contracts/types';

export function computeClockOffset(serverNow: number, clientNow: number): number {
  if (!Number.isFinite(serverNow) || !Number.isFinite(clientNow)) return 0;
  return serverNow - clientNow;
}

export function computeCutsceneElapsedMs(
  cutsceneStartedAt: number | null,
  clockOffset: number,
  clientNow: number,
): number {
  if (
    cutsceneStartedAt === null ||
    !Number.isFinite(cutsceneStartedAt) ||
    !Number.isFinite(clientNow)
  ) {
    return 0;
  }
  const safeOffset = Number.isFinite(clockOffset) ? clockOffset : 0;
  const elapsed = clientNow + safeOffset - cutsceneStartedAt;
  return Math.min(TOTAL_CUTSCENE_DURATION_MS, Math.max(0, elapsed));
}
