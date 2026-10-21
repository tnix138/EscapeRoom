// src/contracts/admin.ts — قراردادهای پنل ادمین (فاز ۰۹، ۱۰ و ۱۳)
// مرجع: قرارداد ۵ (AdminSession) و قرارداد ۶ (AdminEvent) در docs/CONTRACTS.md
// مالک قرارداد: توحید · مصرف‌کننده: امیر (فاز ۰۹/۱۰/۱۳) و امیرعلی (لایهٔ UI)
import type { GamePhase } from './types';

export type AdminRole = 'superadmin' | 'moderator' | 'viewer';

/** قرارداد ۵ — جلسهٔ ادمین */
export interface AdminSession {
  adminId: string;
  username: string;
  role: AdminRole;
  createdAt: number;
  expiresAt: number;
}

/** عمر پیش‌فرض جلسه: ۸ ساعت */
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1_000;

export const ADMIN_ROLES: readonly AdminRole[] = ['superadmin', 'moderator', 'viewer'];

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function isAdminSessionExpired(session: AdminSession, now = Date.now()): boolean {
  return session.expiresAt <= now;
}

/** نقش‌هایی که اجازهٔ حذف بازیکن دارند (فاز ۱۳). */
export function canModerate(role: AdminRole): boolean {
  return role === 'superadmin' || role === 'moderator';
}

/** دسترسی فقط‌خواندنی برای همهٔ نقش‌ها. */
export function canView(role: unknown): role is AdminRole {
  return isAdminRole(role);
}

export function createAdminSession(input: {
  adminId: string;
  username: string;
  role: AdminRole;
  now?: number;
  ttlMs?: number;
}): AdminSession {
  const now = input.now ?? Date.now();
  return {
    adminId: input.adminId,
    username: input.username,
    role: input.role,
    createdAt: now,
    expiresAt: now + (input.ttlMs ?? ADMIN_SESSION_TTL_MS),
  };
}

/** نمای خلاصهٔ اتاق برای داشبورد آمار (فاز ۱۰) */
export interface RoomSummary {
  code: string;
  phase: GamePhase;
  playerCount: number;
  /** تعداد صندلی‌هایی که واقعاً پر شده‌اند */
  occupiedSeats: number;
  /** تعداد بازیکنی که در ۳۰ ثانیهٔ اخیر دیده شده‌اند */
  onlineCount: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  hasAuditoriumRestart: boolean;
}

export type AdminEventType =
  | 'room_created'
  | 'player_joined'
  | 'puzzle_solved'
  | 'door_attempt'
  | 'phase_changed'
  | 'chat_message'
  | 'player_removed'
  | 'error';

export const ADMIN_EVENT_TYPES: readonly AdminEventType[] = [
  'room_created',
  'player_joined',
  'puzzle_solved',
  'door_attempt',
  'phase_changed',
  'chat_message',
  'player_removed',
  'error',
];

/** قرارداد ۶ — رویداد ثبت‌شده در جدول admin_events */
export interface AdminEvent {
  id: string;
  type: AdminEventType;
  roomCode: string | null;
  playerId: string | null;
  payload: Record<string, unknown>;
  createdAt: number;
}

export function isAdminEventType(value: unknown): value is AdminEventType {
  return typeof value === 'string' && (ADMIN_EVENT_TYPES as readonly string[]).includes(value);
}

/** ساخت رویداد تازه با شناسهٔ یکتا؛ قابل استفاده در سرور و تست. */
export function createAdminEvent(input: {
  type: AdminEventType;
  roomCode?: string | null;
  playerId?: string | null;
  payload?: Record<string, unknown>;
  createdAt?: number;
  id?: string;
}): AdminEvent {
  return {
    id: input.id ?? `evt_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
    type: input.type,
    roomCode: input.roomCode ?? null,
    playerId: input.playerId ?? null,
    payload: input.payload ?? {},
    createdAt: input.createdAt ?? Date.now(),
  };
}

/** خروجی endpointهای ادمین — هم‌شکل با قرارداد ۴ (ApiError) */
export interface AdminStatsView {
  rooms: number;
  players: number;
  online: number;
  events: number;
  phases: Record<GamePhase, number>;
  serverNow: number;
}
