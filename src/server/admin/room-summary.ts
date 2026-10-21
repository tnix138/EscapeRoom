// src/server/admin/room-summary.ts — ساخت نمای امن ادمین از وضعیت داخلی اتاق
// (فاز ۱۰ — توحید). هیچ توکن صندلی، کد در یا جواب معمایی در این نما نیست.
import type { AdminStatsView, RoomSummary } from '../../contracts/admin';
import type { GamePhase } from '../../contracts/types';
import type { InternalRoomState } from '../../engine/index';
import { ONLINE_WINDOW_MS } from '../../engine/view-projector';

export function summarizeRoom(state: InternalRoomState, now = Date.now()): RoomSummary {
  const occupiedSeats = state.seats.filter((seat) => seat.joined).length;
  const onlineCount = state.seats.filter(
    (seat) => seat.lastSeenAt !== null && now - seat.lastSeenAt <= ONLINE_WINDOW_MS,
  ).length;

  return {
    code: state.code,
    phase: state.phase,
    playerCount: state.playerCount,
    occupiedSeats,
    onlineCount,
    version: state.version,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    hasAuditoriumRestart: state.restartedInTheaterAt !== null,
  };
}

/** جدیدترین اتاق‌ها اول؛ برای جدول اتاق‌های پنل ادمین. */
export function summarizeRooms(
  states: readonly InternalRoomState[],
  now = Date.now(),
  limit = 100,
): RoomSummary[] {
  return states
    .map((state) => summarizeRoom(state, now))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.code.localeCompare(b.code))
    .slice(0, Math.max(0, limit));
}

export function buildAdminStats(
  summaries: readonly RoomSummary[],
  eventCount: number,
  now = Date.now(),
  errorCount = 0,
): AdminStatsView {
  const phases: Record<GamePhase, number> = {
    alley_puzzle: 0,
    door_cutscene: 0,
    theater_cutscene: 0,
    in_theater: 0,
  };
  let players = 0;
  let online = 0;
  for (const summary of summaries) {
    phases[summary.phase] += 1;
    players += summary.occupiedSeats;
    online += summary.onlineCount;
  }
  const events = Math.max(0, eventCount);
  const errors = Math.max(0, Math.min(errorCount, events));
  return {
    rooms: summaries.length,
    players,
    online,
    events,
    errors,
    errorRate: events > 0 ? errors / events : 0,
    phases,
    serverNow: now,
  };
}
