// GET  /api/rooms/[code]/presence — فهرست حضور هم‌تیمی‌ها (probe کلاینت + bootstrap)
// POST /api/rooms/[code]/presence — ثبت موقعیت بازیکن (قرارداد #104، فاز ۰۳)
//
// هویت از هدر `x-seat-token` خوانده می‌شود؛ `playerId` و `seatIndex` در بدنه
// پذیرفته نمی‌شوند. `yaw` رادیان است. پاسخ‌ها از قرارداد ۴ پیروی می‌کنند.
import { NextResponse } from 'next/server';
import { normalizeSeatToken } from '../../../../../contracts/seat-token-format';
import {
  GameServiceError,
} from '../../../../../server/services/room-service';
import {
  getSeatPresences,
  publishSeatPresence,
} from '../../../../../server/services/presence-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** سقف بدنهٔ ارسالی؛ snapshot حضور بیشتر از چند صد بایت نیست.
 * (export نمی‌شود: Next در فایل route فقط خروجی‌های شناخته‌شده را می‌پذیرد.) */
const PRESENCE_MAX_BODY_BYTES = 4_096;

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function errorResponse(err: unknown): NextResponse {
  if (err instanceof GameServiceError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message } },
      { status: err.status, headers: NO_STORE },
    );
  }
  console.error('[rooms/[code]/presence]', err);
  return NextResponse.json(
    { ok: false, error: { code: 'INTERNAL_ERROR', message: 'خطای داخلی سرور.' } },
    { status: 500, headers: NO_STORE },
  );
}

/** توکن را نرمال برمی‌گرداند تا لینک کپی‌شده با نویسهٔ پنهان هم صندلی خودش را پیدا کند. */
function readToken(req: Request): string {
  return normalizeSeatToken(req.headers.get('x-seat-token'));
}

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const frame = await getSeatPresences(code, readToken(req));
    return NextResponse.json({ ok: true, data: frame }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    // بدنه اول به متن خوانده می‌شود تا سقف اندازه پیش از parse اعمال شود.
    const raw = await req.text().catch(() => '');
    if (raw.length > PRESENCE_MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'بدنهٔ درخواست بیش از حد بزرگ است.' } },
        { status: 413, headers: NO_STORE },
      );
    }
    let body: unknown = null;
    try {
      body = raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      body = null;
    }
    const frame = await publishSeatPresence(code, readToken(req), body);
    return NextResponse.json({ ok: true, data: frame }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
