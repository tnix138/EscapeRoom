// src/server/admin/queries.ts — پرس‌وجوهای پنل ادمین روی همان ریپازیتوری بازی
// (فاز ۱۰ و ۱۳ — مصرف‌کننده: امیر). هیچ توکن صندلی یا دادهٔ حساسی برنمی‌گرداند.
import {
  createAdminEvent,
  type AdminEvent,
  type AdminPlayerView,
  type AdminStatsView,
  type RoomSummary,
} from '../../contracts/admin';
import { ONLINE_WINDOW_MS } from '../../engine/view-projector';
import type { InternalRoomState } from '../../engine/index';
import type { RoomRepository } from '../db/repository';
import { buildAdminStats, summarizeRooms } from './room-summary';

export const ADMIN_ROOM_LIMIT = 100;
export const ADMIN_EVENT_LIMIT = 100;

/** همهٔ اتاق‌ها به‌صورت خلاصه، جدیدترین اول. */
export async function loadAdminRooms(
  repo: RoomRepository,
  now = Date.now(),
  limit = ADMIN_ROOM_LIMIT,
): Promise<RoomSummary[]> {
  const states = await repo.listRooms(limit);
  return summarizeRooms(states, now, limit);
}

/** بازیکنان نشسته در اتاق‌ها (صندلی‌های آزاد نمایش داده نمی‌شوند). */
export function playersOfRooms(
  states: readonly InternalRoomState[],
  now = Date.now(),
): AdminPlayerView[] {
  const players: AdminPlayerView[] = [];
  for (const state of states) {
    for (const seat of state.seats) {
      if (!seat.joined) continue;
      const lastSeenAt = seat.lastSeenAt;
      players.push({
        playerId: seat.playerId,
        playerName: seat.playerName,
        roomCode: state.code,
        seatIndex: seat.seatIndex,
        seatLabel: seat.seatLabel,
        phase: state.phase,
        isOnline:
          seat.isOnline && lastSeenAt !== null && now - lastSeenAt <= ONLINE_WINDOW_MS,
        lastSeenAt,
      });
    }
  }
  return players.sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
}

export async function loadAdminPlayers(
  repo: RoomRepository,
  now = Date.now(),
): Promise<AdminPlayerView[]> {
  const states = await repo.listRooms(ADMIN_ROOM_LIMIT);
  return playersOfRooms(states, now);
}

/** آمار داشبورد؛ هم‌خوان با همان جدول‌هایی که پنل نشان می‌دهد. */
export async function loadAdminStats(
  repo: RoomRepository,
  now = Date.now(),
): Promise<AdminStatsView> {
  const states = await repo.listRooms(ADMIN_ROOM_LIMIT);
  const summaries = summarizeRooms(states, now, ADMIN_ROOM_LIMIT);
  const [events, errors] = await Promise.all([
    repo.countAdminEvents(),
    repo.countAdminEvents({ type: 'error' }),
  ]);
  return buildAdminStats(summaries, events, now, errors);
}

/** آخرین خطاهای ثبت‌شده (قرارداد ۶، نوع `error`). */
export async function loadAdminErrors(
  repo: RoomRepository,
  limit = ADMIN_EVENT_LIMIT,
  roomCode?: string,
): Promise<AdminEvent[]> {
  return repo.listAdminEvents({ type: 'error', limit, roomCode });
}

export interface RemovePlayerResult {
  removed: boolean;
  roomCode: string;
  seatIndex: number;
  playerName: string;
}

/**
 * حذف بازیکن با شناسهٔ بازیکن (فاز ۱۳).
 * توکن صندلی باطل می‌شود و رویداد `player_removed` در admin_events ثبت می‌شود.
 * اگر بازیکن پیدا نشود null برمی‌گردد.
 */
export async function removePlayerById(
  repo: RoomRepository,
  playerId: string,
  admin: { username: string },
  now = Date.now(),
): Promise<RemovePlayerResult | null> {
  const states = await repo.listRooms(ADMIN_ROOM_LIMIT);
  for (const state of states) {
    const seat = state.seats.find((item) => item.joined && item.playerId === playerId);
    if (!seat) continue;

    const removed = await repo.deleteSeat(state.code, seat.seatIndex);
    if (!removed) return { removed: false, roomCode: state.code, seatIndex: seat.seatIndex, playerName: seat.playerName };

    await repo.recordAdminEvent(
      createAdminEvent({
        type: 'player_removed',
        roomCode: state.code,
        playerId,
        payload: {
          seatIndex: seat.seatIndex,
          seatLabel: seat.seatLabel,
          playerName: seat.playerName,
          byAdmin: admin.username,
        },
        createdAt: now,
      }),
    );
    return {
      removed: true,
      roomCode: state.code,
      seatIndex: seat.seatIndex,
      playerName: seat.playerName,
    };
  }
  return null;
}
