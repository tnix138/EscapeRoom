// src/server/db/supabase-repository.ts — پیاده‌سازی ابری با PostgREST + کنترل همزمانی (version)
// کلید سرویس فقط از env خوانده می‌شود و هرگز در Git نوشته نمی‌شود (اجرای ابری با ایجنت چهارم است).
import type { AdminEvent } from '../../contracts/admin';
import type { InternalRoomState } from '../../engine/index';
import type { ListAdminEventsOptions, RoomRepository } from './repository';

interface RoomRow {
  state_json: string;
}

interface AdminEventRow {
  id: string;
  type: string;
  room_code: string | null;
  player_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: number;
}

const DEFAULT_EVENT_LIMIT = 100;
const MAX_EVENT_LIMIT = 500;
const MAX_DELETE_ATTEMPTS = 3;

function clampLimit(limit: number | undefined): number {
  return Math.max(1, Math.min(limit ?? DEFAULT_EVENT_LIMIT, MAX_EVENT_LIMIT));
}

export class SupabaseRoomRepository implements RoomRepository {
  readonly driver = 'supabase' as const;
  private readonly url: string;
  private readonly serviceKey: string;

  constructor(
    url: string | undefined = process.env.SUPABASE_URL,
    serviceKey: string | undefined = process.env.SUPABASE_SERVICE_ROLE_KEY,
  ) {
    if (!url || !serviceKey) {
      throw new Error(
        'STORAGE_DRIVER=supabase نیازمند SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY است.',
      );
    }
    this.url = url.replace(/\/$/, '');
    this.serviceKey = serviceKey;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  private rowOf(state: InternalRoomState): Record<string, unknown> {
    return {
      code: state.code,
      version: state.version,
      phase: state.phase,
      state_json: JSON.stringify(state),
      created_at: state.createdAt,
      updated_at: state.updatedAt,
    };
  }

  async createRoom(state: InternalRoomState): Promise<void> {
    const res = await fetch(`${this.url}/rest/v1/rooms`, {
      method: 'POST',
      headers: this.headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(this.rowOf(state)),
    });
    if (!res.ok) throw new Error(`Supabase createRoom failed: ${res.status} ${await res.text()}`);
  }

  async getRoom(code: string): Promise<InternalRoomState | null> {
    const res = await fetch(
      `${this.url}/rest/v1/rooms?code=eq.${encodeURIComponent(code.toUpperCase())}&select=state_json`,
      { headers: this.headers() },
    );
    if (!res.ok) throw new Error(`Supabase getRoom failed: ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as RoomRow[];
    return rows[0] ? (JSON.parse(rows[0].state_json) as InternalRoomState) : null;
  }

  async saveRoomIfVersion(state: InternalRoomState, expectedVersion: number): Promise<boolean> {
    const next: InternalRoomState = { ...state, version: expectedVersion + 1, updatedAt: Date.now() };
    const res = await fetch(
      `${this.url}/rest/v1/rooms?code=eq.${encodeURIComponent(next.code)}&version=eq.${expectedVersion}`,
      {
        method: 'PATCH',
        headers: this.headers({ Prefer: 'return=representation' }),
        body: JSON.stringify(this.rowOf(next)),
      },
    );
    if (!res.ok) throw new Error(`Supabase saveRoomIfVersion failed: ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as unknown[];
    if (rows.length === 1) {
      state.version = next.version;
      state.updatedAt = next.updatedAt;
      return true;
    }
    return false;
  }

  // --- فاز ۱۰ و ۱۳: خواندن برای پنل ادمین ---

  async listRooms(limit = DEFAULT_EVENT_LIMIT): Promise<InternalRoomState[]> {
    const res = await fetch(
      `${this.url}/rest/v1/rooms?select=state_json&order=updated_at.desc&limit=${clampLimit(limit)}`,
      { headers: this.headers() },
    );
    if (!res.ok) throw new Error(`Supabase listRooms failed: ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as RoomRow[];
    return rows.map((row) => JSON.parse(row.state_json) as InternalRoomState);
  }

  async recordAdminEvent(event: AdminEvent): Promise<void> {
    const res = await fetch(`${this.url}/rest/v1/admin_events`, {
      method: 'POST',
      headers: this.headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        id: event.id,
        type: event.type,
        room_code: event.roomCode,
        player_id: event.playerId,
        payload: event.payload ?? {},
        created_at: event.createdAt,
      }),
    });
    if (!res.ok) {
      throw new Error(`Supabase recordAdminEvent failed: ${res.status} ${await res.text()}`);
    }
  }

  async listAdminEvents(options: ListAdminEventsOptions = {}): Promise<AdminEvent[]> {
    const filters: string[] = ['select=*', 'order=created_at.desc,id.desc', `limit=${clampLimit(options.limit)}`];
    if (options.roomCode) {
      filters.push(`room_code=eq.${encodeURIComponent(options.roomCode.toUpperCase())}`);
    }
    if (options.type) filters.push(`type=eq.${encodeURIComponent(options.type)}`);

    const res = await fetch(`${this.url}/rest/v1/admin_events?${filters.join('&')}`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`Supabase listAdminEvents failed: ${res.status} ${await res.text()}`);
    }
    const rows = (await res.json()) as AdminEventRow[];
    return rows.map((row) => ({
      id: row.id,
      type: row.type as AdminEvent['type'],
      roomCode: row.room_code,
      playerId: row.player_id,
      payload: row.payload ?? {},
      createdAt: row.created_at,
    }));
  }

  async countAdminEvents(
    options: Omit<ListAdminEventsOptions, 'limit'> = {},
  ): Promise<number> {
    const filters: string[] = ['select=id', 'limit=1'];
    if (options.roomCode) {
      filters.push(`room_code=eq.${encodeURIComponent(options.roomCode.toUpperCase())}`);
    }
    if (options.type) filters.push(`type=eq.${encodeURIComponent(options.type)}`);

    const res = await fetch(`${this.url}/rest/v1/admin_events?${filters.join('&')}`, {
      headers: this.headers({ Prefer: 'count=exact' }),
    });
    if (!res.ok) {
      throw new Error(`Supabase countAdminEvents failed: ${res.status} ${await res.text()}`);
    }
    // PostgREST تعداد را در Content-Range برمی‌گرداند: «0-0/42»
    const range = res.headers.get('content-range') ?? '';
    const total = Number(range.split('/')[1]);
    return Number.isFinite(total) ? total : 0;
  }

  async deleteSeat(roomCode: string, seatIndex: number): Promise<boolean> {
    const code = roomCode.toUpperCase();
    for (let attempt = 0; attempt < MAX_DELETE_ATTEMPTS; attempt++) {
      const state = await this.getRoom(code);
      if (!state) return false;

      const seat = state.seats[seatIndex];
      if (!seat) return false;

      seat.seatTokenHash = '';
      seat.playerName = `صندلی ${seatIndex + 1}`;
      seat.joined = false;
      seat.isOnline = false;
      seat.hasWatchedInvitation = false;
      seat.ticketPunched = false;
      seat.selectedPunch = null;
      seat.lastSeenAt = null;
      state.updatedAt = Date.now();

      if (await this.saveRoomIfVersion(state, state.version)) return true;
    }
    return false;
  }
}
