// POST /api/rooms — رزرو اتاق ۳ تا ۸ نفره و تولید لینک‌های اختصاصی نام‌دار
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { reserveRoom } from '../../../server/services/room-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json().catch(() => null);
    if (body === null || typeof body !== 'object') {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'بدنه درخواست معتبر نیست.' } },
        { status: 400 },
      );
    }
    const data = await reserveRoom(body);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: err.issues.map((i) => i.message).join(' '),
          },
        },
        { status: 400 },
      );
    }
    console.error('[POST /api/rooms]', err);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'خطای داخلی سرور.' } },
      { status: 500 },
    );
  }
}
