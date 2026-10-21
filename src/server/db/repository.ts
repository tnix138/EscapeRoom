// src/server/db/repository.ts — اینترفیس واحد + تشخیص خودکار SQLite یا Supabase
import type { AdminEvent } from '../../contracts/admin';
import type { InternalRoomState } from '../../engine/index';
import { SqliteRoomRepository } from './sqlite-repository';
import { SupabaseRoomRepository } from './supabase-repository';

export type StorageDriver = 'sqlite' | 'supabase';

export interface ListAdminEventsOptions {
  limit?: number;
  roomCode?: string;
  type?: AdminEvent['type'];
}

export interface RoomRepository {
  readonly driver: StorageDriver;
  createRoom(state: InternalRoomState): Promise<void>;
  getRoom(code: string): Promise<InternalRoomState | null>;
  /**
   * ذخیره مشروط OCC: فقط اگر نسخه ذخیره‌شده هنوز expectedVersion باشد.
   * در موفقیت نسخه را یکی زیاد می‌کند و true برمی‌گرداند.
   */
  saveRoomIfVersion(state: InternalRoomState, expectedVersion: number): Promise<boolean>;

  // --- فاز ۱۰ و ۱۳ (پنل ادمین) ---
  /** همهٔ اتاق‌ها، برای داشبورد آمار و جدول اتاق‌ها. */
  listRooms(limit?: number): Promise<InternalRoomState[]>;
  /** ثبت رویداد ادمین (قرارداد ۶). */
  recordAdminEvent(event: AdminEvent): Promise<void>;
  /** رویدادها به ترتیب جدیدترین. */
  listAdminEvents(options?: ListAdminEventsOptions): Promise<AdminEvent[]>;
  /** شمارش رویدادها برای کارت‌های آمار (فاز ۱۰). */
  countAdminEvents(options?: Omit<ListAdminEventsOptions, 'limit'>): Promise<number>;
  /**
   * حذف (اخراج) یک بازیکن از اتاق: توکن صندلی باطل و صندلی آزاد می‌شود.
   * در صورت وجود صندلی و موفقیت true برمی‌گرداند.
   */
  deleteSeat(roomCode: string, seatIndex: number): Promise<boolean>;
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
