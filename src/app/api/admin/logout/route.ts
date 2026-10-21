// POST /api/admin/logout — خروج ادمین: کوکی نشست پاک می‌شود (فاز ۰۹)
import { clearedAdminSessionCookie } from '@/server/admin/session';
import { jsonOk } from '../_lib/responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return jsonOk(
    { loggedOut: true },
    { headers: { 'set-cookie': clearedAdminSessionCookie(), 'cache-control': 'no-store' } },
  );
}
