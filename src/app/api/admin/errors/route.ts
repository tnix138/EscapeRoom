// GET /api/admin/errors — آخرین خطاهای ثبت‌شده در admin_events (فاز ۱۳)
// پارامترهای اختیاری: ?limit=50 و ?roomCode=ABC123
import { ADMIN_EVENT_LIMIT, loadAdminErrors } from '@/server/admin/queries';
import { getRoomRepository } from '@/server/db/repository';
import { jsonError, jsonOk, requireAdmin } from '../_lib/responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LIMIT = 200;

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const rawLimit = url.searchParams.get('limit');
  const rawRoom = url.searchParams.get('roomCode');
  const limit = rawLimit === null ? ADMIN_EVENT_LIMIT : Number(rawLimit);
  if (!Number.isFinite(limit) || limit < 1 || limit > MAX_LIMIT) {
    return jsonError('VALIDATION_ERROR', `limit باید عددی بین ۱ و ${MAX_LIMIT} باشد.`, 400);
  }

  try {
    const errors = await loadAdminErrors(
      getRoomRepository(),
      Math.floor(limit),
      rawRoom ? rawRoom.toUpperCase() : undefined,
    );
    return jsonOk({ errors }, { headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    console.error('[admin/errors]', err);
    return jsonError('INTERNAL_ERROR', 'خواندن لیست خطاها ناموفق بود.', 500);
  }
}
