// GET /api/rooms/[code]/stream?token=<seatToken>&sinceVersion=0 — استریم بلادرنگ SSE
// event: room_update به محض تغییر نسخه اتاق + event: heartbeat حاوی serverNow برای همگام‌سازی کات‌سین
import { projectRoomView } from '../../../../../engine/view-projector';
import { subscribeRoom } from '../../../../../server/realtime/room-hub';
import {
  GameServiceError,
  findSeatIndexByToken,
  getRoomViewForSeat,
  loadRoom,
} from '../../../../../server/services/room-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 2_000;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const url = new URL(req.url);
  const seatToken = url.searchParams.get('token') ?? '';
  if (!seatToken) {
    return Response.json(
      { ok: false, error: { code: 'INVALID_SEAT_TOKEN', message: 'توکن صندلی ارسال نشده است.' } },
      { status: 401 },
    );
  }

  let initialView;
  try {
    initialView = await getRoomViewForSeat(code, seatToken);
  } catch (err) {
    if (err instanceof GameServiceError) {
      return Response.json(
        { ok: false, error: { code: err.code, message: err.message } },
        { status: err.status },
      );
    }
    return Response.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'خطای داخلی سرور.' } },
      { status: 500 },
    );
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let lastSentVersion = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // کلاینت قطع شده است؛ پاک‌سازی در cancel انجام می‌شود
        }
      };

      // وضعیت فعلی بلافاصله ارسال می‌شود تا کلاینت بدون انتظار به‌روز شود
      lastSentVersion = initialView.version;
      send('room_update', { roomView: initialView });

      unsubscribe = subscribeRoom(code, (state) => {
        if (state.version <= lastSentVersion) return;
        const seatIndex = findSeatIndexByToken(state, seatToken);
        if (seatIndex === null) return;
        lastSentVersion = state.version;
        send('room_update', { roomView: projectRoomView(state, seatIndex, Date.now()) });
      });

      heartbeat = setInterval(async () => {
        send('heartbeat', { serverNow: Date.now() });
        // پیشبرد فاز بر اساس ساعت سرور حتی اگر هیچ اکشنی رخ ندهد (پایان کات‌سین)
        try {
          const state = await loadRoom(code);
          if (state && state.version > lastSentVersion) {
            const seatIndex = findSeatIndexByToken(state, seatToken);
            if (seatIndex !== null) {
              lastSentVersion = state.version;
              send('room_update', { roomView: projectRoomView(state, seatIndex, Date.now()) });
            }
          }
        } catch {
          // خطای گذرا در heartbeat نباید استریم را ببندد
        }
      }, HEARTBEAT_MS);

      req.signal.addEventListener('abort', () => {
        if (heartbeat) clearInterval(heartbeat);
        if (unsubscribe) unsubscribe();
        try {
          controller.close();
        } catch {
          // قبلاً بسته شده است
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
