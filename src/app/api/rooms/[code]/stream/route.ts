// GET /api/rooms/[code]/stream?token=<seatToken>&sinceVersion=0 — استریم بلادرنگ SSE
// event: room_update به محض تغییر نسخه اتاق + event: heartbeat حاوی serverNow برای همگام‌سازی کات‌سین
import type { ClientRoomView } from '../../../../../contracts/types';
import { projectRoomView } from '../../../../../engine/view-projector';
import { subscribeRoom } from '../../../../../server/realtime/room-hub';
import { shouldSendRoomViewUpdate } from '../../../../../server/realtime/presence';
import {
  GameServiceError,
  findSeatIndexByToken,
  getRoomViewForSeat,
  loadRoom,
  PRESENCE_REFRESH_INTERVAL_MS,
  touchSeatPresence,
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

  let initialView: ClientRoomView;
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
  let presenceHeartbeat: ReturnType<typeof setInterval> | null = null;
  let lastSentVersion = 0;
  let lastOnlineSignature = '';

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // کلاینت قطع شده است؛ پاک‌سازی در cancel انجام می‌شود
        }
      };

      const sendRoomView = (roomView: typeof initialView) => {
        lastSentVersion = Math.max(lastSentVersion, roomView.version);
        lastOnlineSignature = roomView.players.map((player) => (player.isOnline ? '1' : '0')).join('');
        send('room_update', { roomView });
      };

      // وضعیت فعلی بلافاصله ارسال می‌شود تا کلاینت بدون انتظار به‌روز شود
      lastSentVersion = initialView.version;
      sendRoomView(initialView);

      unsubscribe = subscribeRoom(code, (state) => {
        if (state.version <= lastSentVersion) return;
        const seatIndex = findSeatIndexByToken(state, seatToken);
        if (seatIndex === null) return;
        sendRoomView(projectRoomView(state, seatIndex, Date.now()));
      });

      // حفظ حضور با cadence کمتر از پنجره ۳۰ ثانیه‌ای isOnline؛ هیچ دادهٔ حرکتی ارسال نمی‌شود.
      presenceHeartbeat = setInterval(() => {
        void touchSeatPresence(code, seatToken).catch(() => {
          // خطای گذرا در به‌روزرسانی حضور نباید SSE را ببندد؛ اتصال بعدی دوباره تلاش می‌کند.
        });
      }, PRESENCE_REFRESH_INTERVAL_MS);

      heartbeat = setInterval(async () => {
        const serverNow = Date.now();
        send('heartbeat', { serverNow });
        // پیشبرد فاز و بازپروژکشن حضور حتی وقتی نسخه اتاق ثابت است (مثلاً عبور آفلاین از TTL).
        try {
          const state = await loadRoom(code);
          if (state && state.version >= lastSentVersion) {
            const seatIndex = findSeatIndexByToken(state, seatToken);
            if (seatIndex !== null) {
              const roomView = projectRoomView(state, seatIndex, serverNow);
              const onlineSignature = roomView.players
                .map((player) => (player.isOnline ? '1' : '0'))
                .join('');
              if (
                shouldSendRoomViewUpdate(
                  state.version,
                  lastSentVersion,
                  onlineSignature,
                  lastOnlineSignature,
                )
              ) {
                sendRoomView(roomView);
              }
            }
          }
        } catch {
          // خطای گذرا در heartbeat نباید استریم را ببندد
        }
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (heartbeat) clearInterval(heartbeat);
        if (presenceHeartbeat) clearInterval(presenceHeartbeat);
        if (unsubscribe) unsubscribe();
        heartbeat = null;
        presenceHeartbeat = null;
        unsubscribe = null;
      };

      req.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // قبلاً بسته شده است
        }
      }, { once: true });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (presenceHeartbeat) clearInterval(presenceHeartbeat);
      if (unsubscribe) unsubscribe();
      heartbeat = null;
      presenceHeartbeat = null;
      unsubscribe = null;
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
