// DELETE /api/admin/players/[id] — اخراج بازیکن: توکن صندلی باطل و صندلی آزاد (فاز ۱۳)
import { removePlayerById } from '@/server/admin/queries';
import { getRoomRepository } from '@/server/db/repository';
import { jsonError, jsonOk, requireAdmin } from '../../_lib/responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req, { moderate: true });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const playerId = decodeURIComponent(id ?? '').trim();
  if (!playerId) {
    return jsonError('VALIDATION_ERROR', 'شناسهٔ بازیکن لازم است.', 400);
  }

  try {
    const result = await removePlayerById(getRoomRepository(), playerId, {
      username: auth.session.username,
    });
    if (!result) {
      return jsonError('PLAYER_NOT_FOUND', 'بازیکنی با این شناسه در اتاق‌ها پیدا نشد.', 404);
    }
    if (!result.removed) {
      return jsonError(
        'CONFLICT_RETRY_EXHAUSTED',
        'حذف بازیکن انجام نشد؛ دوباره تلاش کنید.',
        409,
      );
    }
    return jsonOk({
      removed: true,
      roomCode: result.roomCode,
      seatIndex: result.seatIndex,
      playerName: result.playerName,
    });
  } catch (err) {
    console.error('[admin/players/[id]]', err);
    return jsonError('INTERNAL_ERROR', 'حذف بازیکن ناموفق بود.', 500);
  }
}
