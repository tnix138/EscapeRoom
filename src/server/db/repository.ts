// src/server/db/repository.ts — اینترفیس واحد + تشخیص خودکار SQLite یا Supabase
import type { InternalRoomState } from '../../engine/index';
import { SqliteRoomRepository } from './sqlite-repository';
import { SupabaseRoomRepository } from './supabase-repository';

export type StorageDriver = 'sqlite' | 'supabase';

export interface RoomRepository {
  readonly driver: StorageDriver;
  createRoom(state: InternalRoomState): Promise<void>;
  getRoom(code: string): Promise<InternalRoomState | null>;
  /**
   * ذخیره مشروط OCC: فقط اگر نسخه ذخیره‌شده هنوز expectedVersion باشد.
   * در موفقیت نسخه را یکی زیاد می‌کند و true برمی‌گرداند.
   */
  saveRoomIfVersion(state: InternalRoomState, expectedVersion: number): Promise<boolean>;
}

export function resolveStorageDriver(): StorageDriver {
  return process.env.STORAGE_DRIVER === 'supabase' ? 'supabase' : 'sqlite';
}

let cached: RoomRepository | null = null;

export function getRoomRepository(): RoomRepository {
  if (cached) return cached;
  cached =
    resolveStorageDriver() === 'supabase'
      ? new SupabaseRoomRepository()
      : new SqliteRoomRepository();
  return cached;
}

/** فقط برای تست‌ها: ساخت ریپازیتوری تازه با مسیر دیتابیس مشخص */
export function createSqliteRepository(dbPath?: string): RoomRepository {
  return new SqliteRoomRepository(dbPath);
}
