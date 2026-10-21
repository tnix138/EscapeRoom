// src/server/db/sqlite-repository.ts — پیاده‌سازی پایدار با node:sqlite (Node 22)
// وضعیت اتاق در .data/escaperoom.db می‌ماند؛ Refresh مرورگر یا ری‌استارت سرور چیزی را پاک نمی‌کند.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AdminEvent } from '../../contracts/admin';
import type { InternalRoomState } from '../../engine/index';
import type { ListAdminEventsOptions, RoomRepository } from './repository';

const DEFAULT_DB_PATH = path.join(process.cwd(), '.data', 'escaperoom.db');

interface RoomRow {
  state_json: string;
}

interface AdminEventRow {
  id: string;
  type: string;
  room_code: string | null;
  player_id: string | null;
  payload_json: string;
  created_at: number;
}

const DEFAULT_EVENT_LIMIT = 100;
const MAX_EVENT_LIMIT = 500;

export class SqliteRoomRepository implements RoomRepository {
  readonly driver = 'sqlite' as const;
  private readonly db: DatabaseSync;

  constructor(dbPath: string = process.env.ESCAPEROOM_DB_PATH ?? DEFAULT_DB_PATH) {
    if (dbPath !== ':memory:') {
      mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        phase TEXT NOT NULL,
        state_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS admin_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        room_code TEXT,
        player_id TEXT,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS admin_events_created_at_idx ON admin_events (created_at);
      CREATE INDEX IF NOT EXISTS admin_events_room_code_idx ON admin_events (room_code);
    `);
  }

  async createRoom(state: InternalRoomState): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO rooms (code, version, phase, state_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        state.code,
        state.version,
        state.phase,
        JSON.stringify(state),
        state.createdAt,
        state.updatedAt,
      );
  }

  async getRoom(code: string): Promise<InternalRoomState | null> {
    const row = this.db
      .prepare('SELECT state_json FROM rooms WHERE code = ?')
      .get(code.toUpperCase()) as RoomRow | undefined;
    return row ? (JSON.parse(row.state_json) as InternalRoomState) : null;
  }

  async saveRoomIfVersion(state: InternalRoomState, expectedVersion: number): Promise<boolean> {
    const next: InternalRoomState = {
      ...state,
      version: expectedVersion + 1,
      updatedAt: Date.now(),
    };
    const result = this.db
      .prepare(
        `UPDATE rooms SET version = ?, phase = ?, state_json = ?, updated_at = ?
         WHERE code = ? AND version = ?`,
      )
      .run(
        next.version,
        next.phase,
        JSON.stringify(next),
        next.updatedAt,
        next.code,
        expectedVersion,
      );
    if (Number(result.changes) === 1) {
      state.version = next.version;
      state.updatedAt = next.updatedAt;
      return true;
    }
    return false;
  }

  // --- فاز ۱۰ و ۱۳: خواندن برای پنل ادمین ---

  async listRooms(limit = DEFAULT_EVENT_LIMIT): Promise<InternalRoomState[]> {
    const rows = this.db
      .prepare('SELECT state_json FROM rooms ORDER BY updated_at DESC LIMIT ?')
      .all(Math.max(1, Math.min(limit, MAX_EVENT_LIMIT))) as unknown as RoomRow[];
    return rows.map((row) => JSON.parse(row.state_json) as InternalRoomState);
  }

  async recordAdminEvent(event: AdminEvent): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO admin_events (id, type, room_code, player_id, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.type,
        event.roomCode,
        event.playerId,
        JSON.stringify(event.payload ?? {}),
        event.createdAt,
      );
  }

  async listAdminEvents(options: ListAdminEventsOptions = {}): Promise<AdminEvent[]> {
    const limit = Math.max(
      1,
      Math.min(options.limit ?? DEFAULT_EVENT_LIMIT, MAX_EVENT_LIMIT),
    );
    const conditions: string[] = [];
    const params: Array<string | number> = [];
    if (options.roomCode) {
      conditions.push('room_code = ?');
      params.push(options.roomCode.toUpperCase());
    }
    if (options.type) {
      conditions.push('type = ?');
      params.push(options.type);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(
        `SELECT id, type, room_code, player_id, payload_json, created_at
         FROM admin_events ${where}
         ORDER BY created_at DESC, id DESC LIMIT ?`,
      )
      .all(...params, limit) as unknown as AdminEventRow[];

    return rows.map((row) => ({
      id: row.id,
      type: row.type as AdminEvent['type'],
      roomCode: row.room_code,
      playerId: row.player_id,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      createdAt: row.created_at,
    }));
  }

  async deleteSeat(roomCode: string, seatIndex: number): Promise<boolean> {
    const code = roomCode.toUpperCase();
    for (let attempt = 0; attempt < 3; attempt++) {
      const state = await this.getRoom(code);
      if (!state) return false;

      const seat = state.seats[seatIndex];
      if (!seat) return false;

      // توکن صندلی باطل می‌شود تا بازیکن حذف‌شده نتواند دوباره وارد شود.
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

  close(): void {
    this.db.close();
  }
}
