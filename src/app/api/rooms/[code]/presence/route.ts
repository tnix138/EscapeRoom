// POST /api/rooms/[code]/presence — ثبت آخرین snapshot حضور بازیکن (فاز ۰۳ — توحید)
// GET  /api/rooms/[code]/presence — خواندن وضعیت حضور اتاق (fallback برای کلاینت بدون SSE)
// احراز هویت: هدر x-seat-token (یا ?token= در GET). هویت هرگز از بدنه پذیرفته نمی‌شود.
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  GameServiceError,
} from '../../../../../server/services/room-service';
import {
  getSeatPresence,
  submitSeatPresence,
} from '../../../../../server/presence/presence-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function mapError(err: unknown) {
  if (err instanceof GameServiceError) {
    return errorResponse(err.code, err.message, err.status);
  }
  if (err instanceof ZodError) {
    return errorResponse(
      'VALIDATION_ERROR',
      err.issues.map((issue) => issue.message).join(' '),
      400,
    );
  }
  console.error('[rooms/[code]/presence]', err);
  return errorResponse('INTERNAL_ERROR', 'خطای داخلی سرور.', 500);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const seatToken = req.headers.get('x-seat-token') ?? '';
    if (!seatToken) {
      return errorResponse('INVALID_SEAT_TOKEN', 'توکن صندلی ارسال نشده است.', 401);
    }

    const body: unknown = await req.json().catch(() => null);
    const result = await submitSeatPresence({ roomCode: code, seatToken }, body);

    return NextResponse.json({
      ok: true,
      data: {
        accepted: true,
        entry: result.entry,
        presences: result.presences,
        serverNow: result.serverNow,
      },
    });
  } catch (err) {
    return mapError(err);
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const url = new URL(req.url);
    const seatToken =
      url.searchParams.get('token') ?? req.headers.get('x-seat-token') ?? '';
    if (!seatToken) {
      return errorResponse('INVALID_SEAT_TOKEN', 'توکن صندلی ارسال نشده است.', 401);
    }

    const result = await getSeatPresence({ roomCode: code, seatToken });
    return NextResponse.json({
      ok: true,
      data: { presences: result.presences, serverNow: result.serverNow },
    });
  } catch (err) {
    return mapError(err);
  }
}
