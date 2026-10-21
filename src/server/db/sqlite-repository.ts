// src/server/db/sqlite-repository.ts — پیاده‌سازی پایدار با node:sqlite (Node 22)
// وضعیت اتاق در .data/escaperoom.db می‌ماند؛ Refresh مرورگر یا ری‌استارت سرور چیزی را پاک نمی‌کند.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { InternalRoomState } from '../../engine/index';
import type { RoomRepository } from './repository';

const DEFAULT_DB_PATH = path.join(process.cwd(), '.data', 'escaperoom.db');

interface RoomRow {
  state_json: string;
}

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

  close(): void {
    this.db.close();
  }
}
