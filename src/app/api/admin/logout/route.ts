// POST /api/admin/logout — پایان جلسهٔ ادمین (قرارداد ۵، فاز ۰۹)
// همیشه ۲۰۰ برمی‌گرداند: خروج باید حتی با توکن نامعتبر هم بی‌خطر باشد.
import { NextResponse } from 'next/server';
import { clearAdminSessionCookie } from '../../../../server/auth/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ ok: true, data: { loggedOut: true } });
  response.headers.append('Set-Cookie', clearAdminSessionCookie());
  return response;
}
