// GET /api/health — سلامت سرور و درایور ذخیره‌سازی فعال
import { NextResponse } from 'next/server';
import { getRoomRepository } from '../../../server/db/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const repo = getRoomRepository();
  return NextResponse.json({
    ok: true,
    data: { status: 'healthy', storageDriver: repo.driver, serverNow: Date.now() },
  });
}
