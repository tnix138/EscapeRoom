// تست هم‌ارزی درایور Supabase برای متدهای پنل ادمین (فاز ۱۰ و ۱۳)
// fetch شبیه‌سازی می‌شود تا بدون کلید واقعی، همان قرارداد PostgREST بررسی شود.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminEvent } from '../../src/contracts/admin';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import { SupabaseRoomRepository } from '../../src/server/db/supabase-repository';
import { reserveRoom } from '../../src/server/services/room-service';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-admin-sb-'));
const START = 1_700_400_000_000;

afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

interface SimRoomRow {
  code: string;
  version: number;
  phase: string;
  state_json: string;
  created_at: number;
  updated_at: number;
}

interface SimEventRow {
  id: string;
  type: string;
  room_code: string | null;
  player_id: string | null;
  payload: Record<string, unknown>;
  created_at: number;
}

interface Calls {
  methods: string[];
  urls: string[];
}

function setupFetchMock() {
  const rooms = new Map<string, SimRoomRow>();
  const events: SimEventRow[] = [];
  const calls: Calls = { methods: [], urls: [] };

  const mock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const method = init?.method ?? 'GET';
    calls.methods.push(method);
    calls.urls.push(`${url.pathname}${url.search}`);
    const headers = new Headers(init?.headers);
    expect(headers.get('apikey')).toBe('test-service-role-key');

    const table = url.pathname.split('/').pop();

    if (table === 'rooms' && method === 'POST') {
      const row = JSON.parse(String(init?.body)) as SimRoomRow;
      rooms.set(row.code, row);
      return new Response('', { status: 201 });
    }
    if (table === 'rooms' && method === 'GET') {
      const codeFilter = url.searchParams.get('code')?.replace(/^eq\./, '');
      if (codeFilter) {
        const found = rooms.get(codeFilter);
        return Response.json(found ? [{ state_json: found.state_json }] : []);
      }
      const limit = Number(url.searchParams.get('limit') ?? '100');
      const rows = [...rooms.values()]
        .sort((a, b) => b.updated_at - a.updated_at)
        .slice(0, limit)
        .map((row) => ({ state_json: row.state_json }));
      return Response.json(rows);
    }
    if (table === 'rooms' && method === 'PATCH') {
      const code = (url.searchParams.get('code') ?? '').replace(/^eq\./, '');
      const expected = Number((url.searchParams.get('version') ?? '').replace(/^eq\./, ''));
      const current = rooms.get(code);
      if (!current || current.version !== expected) return Response.json([]);
      const next = JSON.parse(String(init?.body)) as SimRoomRow;
      rooms.set(code, next);
      return Response.json([next]);
    }

    if (table === 'admin_events' && method === 'POST') {
      const row = JSON.parse(String(init?.body)) as SimEventRow;
      if (events.some((event) => event.id === row.id)) {
        return new Response(JSON.stringify({ message: 'duplicate key' }), { status: 409 });
      }
      events.push(row);
      return new Response('', { status: 201 });
    }
    if (table === 'admin_events' && method === 'GET') {
      const roomCode = url.searchParams.get('room_code')?.replace(/^eq\./, '');
      const type = url.searchParams.get('type')?.replace(/^eq\./, '');
      const limit = Number(url.searchParams.get('limit') ?? '100');
      const matching = events
        .filter((event) => (roomCode ? event.room_code === roomCode : true))
        .filter((event) => (type ? event.type === type : true));
      // شمارش: PostgREST تعداد کل را در Content-Range برمی‌گرداند
      if (headers.get('prefer')?.includes('count=exact')) {
        return new Response('[]', {
          status: 200,
          headers: { 'content-range': `0-0/${matching.length}` },
        });
      }
      const rows = matching
        .sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id))
        .slice(0, limit);
      return Response.json(rows);
    }

    return new Response('unexpected', { status: 500 });
  });

  vi.stubGlobal('fetch', mock);
  return { rooms, events, calls };
}

function makeRepo() {
  return new SupabaseRoomRepository('https://example.supabase.co/', 'test-service-role-key');
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ادمین روی Supabase — اتاق‌ها', () => {
  it('listRooms را با مرتب‌سازی و limit درست صدا می‌زند', async () => {
    const { rooms, calls } = setupFetchMock();
    const sqlite = new SqliteRoomRepository(path.join(tmpDir, 'parity-rooms.db'));
    const reservation = await reserveRoom(
      { playerCount: 3, playerNames: ['الف یک', 'ب دو', 'ج سه'] },
      sqlite,
      START,
    );
    const state = await sqlite.getRoom(reservation.roomCode);
    rooms.set(state!.code, {
      code: state!.code,
      version: state!.version,
      phase: state!.phase,
      state_json: JSON.stringify(state),
      created_at: state!.createdAt,
      updated_at: state!.updatedAt,
    });

    const listed = await makeRepo().listRooms(5);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.code).toBe(reservation.roomCode);
    expect(listed[0]?.seats).toHaveLength(3);
    expect(calls.urls.some((u) => u.includes('order=updated_at.desc') && u.includes('limit=5'))).toBe(true);
    sqlite.close();
  });
});

describe('ادمین روی Supabase — رویدادها', () => {
  it('رویداد را با نام ستون‌های snake_case ذخیره و فیلترشده برمی‌گرداند', async () => {
    const { events } = setupFetchMock();
    const repo = makeRepo();

    await repo.recordAdminEvent(
      createAdminEvent({ type: 'room_created', roomCode: 'AAA111', createdAt: START, id: 'e1' }),
    );
    await repo.recordAdminEvent(
      createAdminEvent({
        type: 'error',
        roomCode: 'BBB222',
        playerId: 'seat-2',
        payload: { message: 'خطای شبکه' },
        createdAt: START + 5,
        id: 'e2',
      }),
    );

    expect(events[0]).toMatchObject({ room_code: 'AAA111', player_id: null });
    expect(events[1]).toMatchObject({ room_code: 'BBB222', player_id: 'seat-2' });

    const errors = await repo.listAdminEvents({ type: 'error' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ id: 'e2', roomCode: 'BBB222', playerId: 'seat-2' });
    expect(errors[0]?.payload).toEqual({ message: 'خطای شبکه' });

    const limited = await repo.listAdminEvents({ limit: 1 });
    expect(limited).toHaveLength(1);
    expect(limited[0]?.id).toBe('e2');

    const none = await repo.listAdminEvents({ roomCode: 'ZZZ999' });
    expect(none).toEqual([]);
  });

  it('تعداد رویدادها را با Content-Range می‌شمارد', async () => {
    const { events } = setupFetchMock();
    const repo = makeRepo();

    await repo.recordAdminEvent(
      createAdminEvent({ type: 'room_created', roomCode: 'AAA111', createdAt: START, id: 'c1' }),
    );
    await repo.recordAdminEvent(
      createAdminEvent({ type: 'error', roomCode: 'AAA111', createdAt: START + 1, id: 'c2' }),
    );
    await repo.recordAdminEvent(
      createAdminEvent({ type: 'error', roomCode: 'BBB222', createdAt: START + 2, id: 'c3' }),
    );

    expect(events).toHaveLength(3);
    await expect(repo.countAdminEvents()).resolves.toBe(3);
    await expect(repo.countAdminEvents({ type: 'error' })).resolves.toBe(2);
    await expect(repo.countAdminEvents({ roomCode: 'bbb222' })).resolves.toBe(1);
  });

  it('در خطای دیتابیس پیام فارسی‌ساز Fail-fast می‌دهد', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    await expect(
      makeRepo().recordAdminEvent(createAdminEvent({ type: 'error', id: 'x1', createdAt: START })),
    ).rejects.toThrow(/recordAdminEvent failed/);
    await expect(makeRepo().listAdminEvents()).rejects.toThrow(/listAdminEvents failed/);
  });
});

describe('ادمین روی Supabase — حذف بازیکن', () => {
  it('توکن صندلی را باطل می‌کند و روی همان state ذخیره‌شده اعمال می‌شود', async () => {
    const { rooms } = setupFetchMock();
    const sqlite = new SqliteRoomRepository(path.join(tmpDir, 'parity-delete.db'));
    const reservation = await reserveRoom(
      { playerCount: 3, playerNames: ['الف یک', 'ب دو', 'ج سه'] },
      sqlite,
      START,
    );
    const state = await sqlite.getRoom(reservation.roomCode);
    rooms.set(state!.code, {
      code: state!.code,
      version: state!.version,
      phase: state!.phase,
      state_json: JSON.stringify(state),
      created_at: state!.createdAt,
      updated_at: state!.updatedAt,
    });

    const repo = makeRepo();
    const removed = await repo.deleteSeat(reservation.roomCode, 0);
    expect(removed).toBe(true);

    const stored = JSON.parse([...rooms.values()][0]?.state_json ?? '{}') as {
      version: number;
      seats: Array<{ seatTokenHash: string; joined: boolean; playerName: string }>;
    };
    expect(stored.seats[0]?.seatTokenHash).toBe('');
    expect(stored.seats[0]?.joined).toBe(false);
    expect(stored.seats[0]?.playerName).toBe('صندلی 1');
    expect(stored.version).toBe(state!.version + 1);
    expect(stored.seats[1]?.seatTokenHash).toBe(state!.seats[1]?.seatTokenHash);

    // اتاق ناموجود
    expect(await repo.deleteSeat('ZZZZZZ', 0)).toBe(false);
    sqlite.close();
  });

  it('در تداخل OCC دوباره تلاش می‌کند و در نهایت موفق می‌شود', async () => {
    const { rooms } = setupFetchMock();
    const sqlite = new SqliteRoomRepository(path.join(tmpDir, 'parity-occ.db'));
    const reservation = await reserveRoom(
      { playerCount: 3, playerNames: ['الف یک', 'ب دو', 'ج سه'] },
      sqlite,
      START,
    );
    const state = await sqlite.getRoom(reservation.roomCode);
    const row: SimRoomRow = {
      code: state!.code,
      version: state!.version,
      phase: state!.phase,
      state_json: JSON.stringify(state),
      created_at: state!.createdAt,
      updated_at: state!.updatedAt,
    };
    rooms.set(state!.code, row);

    // اولین PATCH را با شکست OCC پاسخ می‌دهیم
    const baseFetch = globalThis.fetch as unknown as (input: string | URL, init?: RequestInit) => Promise<Response>;
    let patches = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'PATCH') {
          patches++;
          if (patches === 1) return Response.json([]);
        }
        return baseFetch(input, init);
      }),
    );

    expect(await makeRepo().deleteSeat(reservation.roomCode, 1)).toBe(true);
    expect(patches).toBe(2);
    sqlite.close();
  });
});
