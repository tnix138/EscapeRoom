// GET /api/admin/rooms — لیست اتاق‌های فعال با کد، فاز، بازیکن و آخرین فعالیت (فاز ۱۰)
import { loadAdminRooms } from '@/server/admin/queries';
import { getRoomRepository } from '@/server/db/repository';
import { jsonError, jsonOk, requireAdmin } from '../_lib/responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const rooms = await loadAdminRooms(getRoomRepository());
    return jsonOk({ rooms }, { headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    console.error('[admin/rooms]', err);
    return jsonError('INTERNAL_ERROR', 'خواندن لیست اتاق‌ها ناموفق بود.', 500);
  }
}
