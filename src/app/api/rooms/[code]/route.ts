// GET /api/rooms/[code]?sinceVersion=0 — دریافت وضعیت فعلی با توکن صندلی (هدر X-Seat-Token)
import { NextResponse } from 'next/server';
import {
  GameServiceError,
  getRoomViewForSeat,
} from '../../../../server/services/room-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(err: unknown) {
  if (err instanceof GameServiceError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message } },
      { status: err.status },
    );
  }
  console.error('[rooms/[code]]', err);
  return NextResponse.json(
    { ok: false, error: { code: 'INTERNAL_ERROR', message: 'خطای داخلی سرور.' } },
    { status: 500 },
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const seatToken = req.headers.get('x-seat-token') ?? '';
    if (!seatToken) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_SEAT_TOKEN', message: 'توکن صندلی ارسال نشده است.' } },
        { status: 401 },
      );
    }
    const sinceVersion = Number(new URL(req.url).searchParams.get('sinceVersion') ?? '0');
    const roomView = await getRoomViewForSeat(code, seatToken);
    if (sinceVersion === roomView.version) {
      return NextResponse.json({
        ok: true,
        data: { unchanged: true, version: roomView.version, serverNow: roomView.serverNow },
      });
    }
    return NextResponse.json({ ok: true, data: { unchanged: false, roomView } });
  } catch (err) {
    return errorResponse(err);
  }
}
