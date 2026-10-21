// POST /api/rooms/[code]/chat — نجوای تیمی و اشتراک مشخصات بلیط (shareStub)
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  GameServiceError,
  sendChatMessage,
} from '../../../../../server/services/room-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
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
    const body: unknown = await req.json().catch(() => null);
    const roomView = await sendChatMessage(code, seatToken, body);
    return NextResponse.json({ ok: true, data: { roomView } });
  } catch (err) {
    if (err instanceof GameServiceError) {
      return NextResponse.json(
        { ok: false, error: { code: err.code, message: err.message } },
        { status: err.status },
      );
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: err.issues.map((i) => i.message).join(' ') },
        },
        { status: 400 },
      );
    }
    console.error('[rooms/[code]/chat]', err);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'خطای داخلی سرور.' } },
      { status: 500 },
    );
  }
}
