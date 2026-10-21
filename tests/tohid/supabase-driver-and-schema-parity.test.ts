// تست انطباق آداپتور ابری Supabase با SQLite و اسکیمای مایگریشن 001_initial_schema.sql
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialRoomState } from '../../src/engine/index';
import { resolveStorageDriver } from '../../src/server/db/repository';
import { SupabaseRoomRepository } from '../../src/server/db/supabase-repository';

interface SimRow {
  code: string;
  version: number;
  phase: string;
  state_json: string;
  created_at: number;
  updated_at: number;
}

describe('موج ۱۰ — هم‌ارزی SupabaseRoomRepository و صحت مایگریشن SQL', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.STORAGE_DRIVER;
  });

  it('بدون کلیدهای محیطی خطای صریح می‌دهد و درایور را بر اساس env تشخیص می‌دهد', () => {
    delete process.env.STORAGE_DRIVER;
    expect(resolveStorageDriver()).toBe('sqlite');
    process.env.STORAGE_DRIVER = 'supabase';
    expect(resolveStorageDriver()).toBe('supabase');
    expect(() => new SupabaseRoomRepository('', '')).toThrow();
  });

  it('چرخه کامل createRoom، getRoom و کنترل همزمانی OCC (version=eq) را مطابق PostgREST اجرا می‌کند', async () => {
    const table = new Map<string, SimRow>();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input.toString());
        const method = init?.method ?? 'GET';
        const headers = new Headers(init?.headers);
        expect(headers.get('apikey')).toBe('test-service-role-key');
        expect(headers.get('Authorization')).toBe('Bearer test-service-role-key');

        if (method === 'POST') {
          const row = JSON.parse(String(init?.body)) as SimRow;
          table.set(row.code.toUpperCase(), row);
          return new Response('', { status: 201 });
        }

        if (method === 'GET') {
          const codeFilter = url.searchParams.get('code') ?? '';
          const code = codeFilter.replace(/^eq\./, '').toUpperCase();
          const found = table.get(code);
          return Response.json(found ? [{ state_json: found.state_json }] : []);
        }

        if (method === 'PATCH') {
          const code = (url.searchParams.get('code') ?? '').replace(/^eq\./, '').toUpperCase();
          const expectedVersion = Number((url.searchParams.get('version') ?? '').replace(/^eq\./, ''));
          const existing = table.get(code);
          if (!existing || existing.version !== expectedVersion) {
            return Response.json([]);
          }
          const updated = JSON.parse(String(init?.body)) as SimRow;
          table.set(code, updated);
          return Response.json([updated]);
        }

        return new Response('Unsupported', { status: 405 });
      }),
    );

    const repo = new SupabaseRoomRepository('https://example.supabase.co/', 'test-service-role-key');
    const initial = createInitialRoomState({
      code: 'SUPA01',
      playerNames: ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'],
      seatTokenHashes: ['h1', 'h2', 'h3'],
      seed: 138,
      now: 1_700_000_000_000,
    });

    await repo.createRoom(initial);
    const copyA = await repo.getRoom('supa01');
    const copyB = await repo.getRoom('SUPA01');
    expect(copyA).not.toBeNull();
    expect(copyB).not.toBeNull();

    // اولین ذخیره مشروط موفق می‌شود و نسخه به ۲ می‌رسد؛ دومی با نسخه کهنه رد می‌شود
    copyA!.doorAttempts = 1;
    expect(await repo.saveRoomIfVersion(copyA!, 1)).toBe(true);
    expect(copyA!.version).toBe(2);
    expect(await repo.saveRoomIfVersion(copyB!, 1)).toBe(false);
    expect(await repo.getRoom('NONEXISTENT')).toBeNull();
  });

  it('فایل مایگریشن 001_initial_schema.sql همه فازها، ایندکس‌ها و RLS را بدون کلید محرمانه تعریف می‌کند', () => {
    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '001_initial_schema.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    expect(sql).toContain('create table if not exists public.rooms');
    for (const phase of ['alley_puzzle', 'door_cutscene', 'theater_cutscene', 'in_theater']) {
      expect(sql).toContain(`'${phase}'`);
    }
    expect(sql).toContain('rooms_phase_idx');
    expect(sql).toContain('rooms_updated_at_idx');
    expect(sql).toContain('alter table public.rooms enable row level security');
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}|sbp_[A-Za-z0-9]{10,}/);
  });
});
