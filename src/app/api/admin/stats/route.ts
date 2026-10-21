// GET /api/admin/stats — آمار داشبورد: اتاق‌ها، بازیکنان، آنلاین‌ها، نرخ خطا (فاز ۱۰)
import { loadAdminStats } from '@/server/admin/queries';
import { getRoomRepository } from '@/server/db/repository';
import { jsonError, jsonOk, requireAdmin } from '../_lib/responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const stats = await loadAdminStats(getRoomRepository());
    return jsonOk(stats, { headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    console.error('[admin/stats]', err);
    return jsonError('INTERNAL_ERROR', 'خواندن آمار ناموفق بود.', 500);
  }
}
