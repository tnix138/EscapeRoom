// GET /api/admin/players — لیست بازیکنان نشسته با نام، صندلی و آخرین فعالیت (فاز ۱۰)
import { loadAdminPlayers } from '@/server/admin/queries';
import { getRoomRepository } from '@/server/db/repository';
import { jsonError, jsonOk, requireAdmin } from '../_lib/responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const players = await loadAdminPlayers(getRoomRepository());
    return jsonOk({ players }, { headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    console.error('[admin/players]', err);
    return jsonError('INTERNAL_ERROR', 'خواندن لیست بازیکنان ناموفق بود.', 500);
  }
}
