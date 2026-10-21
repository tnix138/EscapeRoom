// GET  /api/rooms/[code]/presence — فهرست حضور هم‌تیمی‌ها (probe کلاینت + bootstrap)
// POST /api/rooms/[code]/presence — ثبت موقعیت بازیکن (قرارداد #104، فاز ۰۳)
//
// هویت از هدر `x-seat-token` خوانده می‌شود؛ `playerId` و `seatIndex` در بدنه
// پذیرفته نمی‌شوند. `yaw` رادیان است. پاسخ‌ها از قرارداد ۴ پیروی می‌کنند.
import { NextResponse } from 'next/server';
import {
  GameServiceError,
} from '../../../../../server/services/room-service';
import {
  getSeatPresences,
  publishSeatPresence,
} from '../../../../../server/services/presence-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(err: unknown): NextResponse {
  if (err instanceof GameServiceError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message } },
      { status: err.status },
    );
  }
  console.error('[rooms/[code]/presence]', err);
  return NextResponse.json(
    { ok: false, error: { code: 'INTERNAL_ERROR', message: 'خطای داخلی سرور.' } },
    { status: 500 },
  );
}

function readToken(req: Request): string {
  return req.headers.get('x-seat-token') ?? '';
}

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const frame = await getSeatPresences(code, readToken(req));
    return NextResponse.json({ ok: true, data: frame });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body: unknown = await req.json().catch(() => null);
    const frame = await publishSeatPresence(code, readToken(req), body);
    return NextResponse.json({ ok: true, data: frame });
  } catch (err) {
    return errorResponse(err);
  }
}
