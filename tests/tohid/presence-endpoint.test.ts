// تست فاز ۰۳ — endpoint حضور: POST/GET با احراز توکن صندلی و پاسخ‌های فارسی قرارداد ۴
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

// ریپازیتوری پیش‌فرض مسیر دیتابیس را در اولین استفاده از env می‌خواند
const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-presence-http-'));
process.env.ESCAPEROOM_DB_PATH = path.join(tmpDir, 'endpoint.db');

import { GET, POST } from '../../src/app/api/rooms/[code]/presence/route';
import { resetRateLimits } from '../../src/server/auth/rate-limit';
import { resetPresenceStore } from '../../src/server/presence/presence-store';
import { reserveRoom } from '../../src/server/services/room-service';

afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

let roomCounter = 0;

async function setupRoom() {
  const reservation = await reserveRoom({
    playerCount: 3,
    playerNames: ['توحید الف', 'علیرضا ب', 'امیرعلی ج'],
  });
  return {
    code: reservation.roomCode,
    tokens: reservation.invites.map((invite) => invite.seatToken),
  };
}

const params = (code: string) => ({ params: Promise.resolve({ code }) });

const validBody = (overrides: Record<string, unknown> = {}) => ({
  position: { x: 1, y: 1.65, z: 4 },
  yaw: 0.4,
  phase: 'alley_puzzle',
  ...overrides,
});

function postRequest(code: string, token: string | null, body: unknown) {
  return new Request(`http://localhost/api/rooms/${code}/presence`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-seat-token': token } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetRateLimits();
  resetPresenceStore();
});

describe('فاز ۰۳ — POST /api/rooms/[code]/presence', () => {
  it('snapshot معتبر را با ۲۰۰ و هویت صندلی برمی‌گرداند', async () => {
    const { code, tokens } = await setupRoom();
    const res = await POST(postRequest(code, tokens[0] as string, validBody({ seatIndex: 2 })), params(code));
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      ok: boolean;
      data: { accepted: boolean; entry: { seatIndex: number; playerName: string }; presences: unknown[] };
    };
    expect(json.ok).toBe(true);
    expect(json.data.accepted).toBe(true);
    expect(json.data.entry.seatIndex).toBe(0);
    expect(json.data.entry.playerName).toBe('توحید الف');
    expect(json.data.presences).toHaveLength(1);
  });

  it('بدون توکن ۴۰۱ و با موقعیت خارج از محدوده ۴۰۰ با پیام فارسی می‌دهد', async () => {
    const { code, tokens } = await setupRoom();

    const noToken = await POST(postRequest(code, null, validBody()), params(code));
    expect(noToken.status).toBe(401);
    expect(((await noToken.json()) as { error: { code: string } }).error.code).toBe(
      'INVALID_SEAT_TOKEN',
    );

    const outOfBounds = await POST(
      postRequest(code, tokens[0] as string, validBody({ position: { x: 500, y: 1.65, z: 0 } })),
      params(code),
    );
    expect(outOfBounds.status).toBe(400);
    const body = (await outOfBounds.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('خارج از محدودهٔ جهان');
  });

  it('بدنهٔ خالی و JSON خراب را با VALIDATION_ERROR رد می‌کند', async () => {
    const { code, tokens } = await setupRoom();

    const empty = await POST(postRequest(code, tokens[0] as string, null), params(code));
    expect(empty.status).toBe(400);
    expect(((await empty.json()) as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR',
    );

    const broken = await POST(
      new Request(`http://localhost/api/rooms/${code}/presence`, {
        method: 'POST',
        headers: { 'x-seat-token': tokens[0] as string, 'content-type': 'application/json' },
        body: '{ not json',
      }),
      params(code),
    );
    expect(broken.status).toBe(400);
    const brokenBody = (await broken.json()) as { error: { message: string } };
    expect(brokenBody.error.message).toContain('snapshot حضور');
  });

  it('توکن نامعتبر ۴۰۱ و اتاق ناموجود ۴۰۴ می‌دهد', async () => {
    const { code } = await setupRoom();

    const badToken = await POST(postRequest(code, 'z'.repeat(48), validBody()), params(code));
    expect(badToken.status).toBe(401);
    expect(((await badToken.json()) as { error: { code: string } }).error.code).toBe(
      'INVALID_SEAT_TOKEN',
    );

    const missingRoom = await POST(
      postRequest('ZZZZZZ', 'q'.repeat(48), validBody()),
      params('ZZZZZZ'),
    );
    expect(missingRoom.status).toBe(404);
    expect(((await missingRoom.json()) as { error: { code: string } }).error.code).toBe(
      'ROOM_NOT_FOUND',
    );
  });

  it('درخواست پنجاه‌ویکم در یک ثانیه ۴۲۹ می‌گیرد', async () => {
    const { code, tokens } = await setupRoom();
    const token = tokens[0] as string;

    for (let i = 0; i < 50; i++) {
      const res = await POST(postRequest(code, token, validBody()), params(code));
      expect(res.status).toBe(200);
    }

    const limited = await POST(postRequest(code, token, validBody()), params(code));
    expect(limited.status).toBe(429);
    expect(((await limited.json()) as { error: { code: string } }).error.code).toBe('RATE_LIMITED');
  });
});

describe('فاز ۰۳ — GET /api/rooms/[code]/presence', () => {
  it('آخرین حضور همهٔ هم‌تیمی‌ها را برای صندلی احرازشده برمی‌گرداند', async () => {
    const { code, tokens } = await setupRoom();
    await POST(postRequest(code, tokens[0] as string, validBody()), params(code));
    await POST(
      postRequest(code, tokens[1] as string, validBody({ position: { x: -3, y: 1.65, z: 2 } })),
      params(code),
    );

    const res = await GET(
      new Request(`http://localhost/api/rooms/${code}/presence?token=${tokens[2] as string}`),
      params(code),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      data: { presences: Array<{ seatIndex: number; position: { x: number } }>; serverNow: number };
    };
    expect(json.ok).toBe(true);
    expect(json.data.presences.map((entry) => entry.seatIndex)).toEqual([0, 1]);
    expect(json.data.presences[1]?.position.x).toBe(-3);
    expect(typeof json.data.serverNow).toBe('number');
  });

  it('بدون توکن ۴۰۱ می‌دهد', async () => {
    const { code } = await setupRoom();
    const res = await GET(
      new Request(`http://localhost/api/rooms/${code}/presence`),
      params(code),
    );
    expect(res.status).toBe(401);
  });
});
