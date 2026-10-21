// src/server/db/supabase-repository.ts — پیاده‌سازی ابری با PostgREST + کنترل همزمانی (version)
// کلید سرویس فقط از env خوانده می‌شود و هرگز در Git نوشته نمی‌شود (اجرای ابری با ایجنت چهارم است).
import type { InternalRoomState } from '../../engine/index';
import type { RoomRepository } from './repository';

interface RoomRow {
  state_json: string;
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
}
