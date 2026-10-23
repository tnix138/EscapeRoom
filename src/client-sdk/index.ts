'use client';
// src/client-sdk/index.ts — اکسپورت‌های توحید طبق API-CONTRACT.md بخش ۴.۱
// موج ۱: reserveRoomApi + createPreviewRoomState
// موج ۳: هوک کامل useTheaterSession با SSE اشتراکی، همگام‌سازی ۶۰ فریم ساعت سرور و ارسال ضدگیر نجوا.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameActionPayload } from '../contracts/actions';
import { normalizeSeatToken } from '../contracts/seat-token-format';
import type { ClientRoomView, HostReservationResult } from '../contracts/types';
import { computeClockOffset, computeCutsceneElapsedMs } from './cutscene-clock';
import { openSharedRoomStream } from './shared-room-stream';

export { createPreviewRoomState, PREVIEW_PLAYER_NAMES } from './preview-fixtures';
export { computeClockOffset, computeCutsceneElapsedMs } from './cutscene-clock';
export {
  activeSharedStreamCount,
  canonicalRoomStreamConnectUrl,
  canonicalRoomStreamKey,
  openSharedRoomStream,
} from './shared-room-stream';

export const WHISPER_REQUEST_TIMEOUT_MS = 8_000;
const ROOM_SYNC_POLL_MS = 2_500;

interface ApiOk<T> {
  ok: true;
  data: T;
}
interface ApiErr {
  ok: false;
  error: { code: string; message: string };
}

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): { promise: Promise<Response>; cancel: () => void } {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  const promise = fetchImpl(url, {
    ...init,
    signal: controller?.signal,
  }).finally(() => {
    clearTimeout(timer);
  });
  return { promise, cancel: () => controller?.abort() };
}

/**
 * ارسال پیام نجوای گروهی با مهلت زمانی مشخص، بازخوانی ایمن JSON و یک تلاش مجدد روی خطای گذرای شبکه/۵xx.
 * برخلاف نسخهٔ قبلی که هم بدون timeout بود (باعث قفل دائمی دکمه روی «در حال فرستادن…» می‌شد) و هم
 * پاسخ‌های خطای سرور (`!body.ok`) را بی‌صدا نادیده می‌گرفت، در صورت شکست خطای دقیق پرتاب می‌کند.
 */
export async function postRoomWhisper(
  roomCode: string,
  seatToken: string,
  text: string,
  shareStub?: boolean,
  options?: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  },
): Promise<ClientRoomView> {
  const token = normalizeSeatToken(seatToken);
  if (!roomCode || !token) {
    throw new Error('نشست صندلی آماده نیست؛ صفحه را تازه کنید.');
  }
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? WHISPER_REQUEST_TIMEOUT_MS;
  const url = `/api/rooms/${encodeURIComponent(roomCode)}/chat`;
  const payload = JSON.stringify({ text, shareStub });

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { promise } = fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Seat-Token': token },
          body: payload,
          cache: 'no-store',
        },
        timeoutMs,
        fetchImpl,
      );
      const res = await promise;
      const body = (await res.json().catch(() => null)) as
        | ApiOk<{ roomView: ClientRoomView }>
        | ApiErr
        | null;

      if (res.ok && body && body.ok && body.data?.roomView) {
        return body.data.roomView;
      }

      const serverMsg =
        body && !body.ok && body.error?.message
          ? body.error.message
          : 'پیام فرستاده نشد؛ دوباره تلاش کنید.';

      // خطاهای منطقی کلاینت (400/401/403/404/429) بلافاصله گزارش می‌شوند؛ روی 409/5xx یک‌بار تلاش مجدد می‌کنیم
      if (res.status < 500 && res.status !== 409) {
        throw new Error(serverMsg);
      }
      lastError = new Error(serverMsg);
    } catch (err) {
      const isAbort =
        err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message));
      if (isAbort) {
        lastError = new Error('پاسخ سرور دیر شد؛ دوباره تلاش کنید.');
      } else if (err instanceof Error) {
        // اگر خطای منطقی ۴xx در همین دور پرتاب شده باشد، بدون تکرار بیرون می‌رویم
        if (
          lastError !== err &&
          !/شبکه|fetch|network|Failed to fetch/i.test(err.message)
        ) {
          throw err;
        }
        lastError = err;
      } else {
        lastError = new Error('خطای ارتباط با سرور.');
      }
    }
  }

  throw lastError ?? new Error('پیام فرستاده نشد؛ دوباره تلاش کنید.');
}

export async function reserveRoomApi(input: {
  playerCount: number;
  playerNames: string[];
}): Promise<HostReservationResult> {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = (await res.json()) as ApiOk<HostReservationResult> | ApiErr;
  if (!body.ok) throw new Error(body.error.message);
  return body.data;
}

/**
 * نشست اتاق. توکن ورودی ممکن است از آدرس لینک دعوت، storage یا `?token=` آمده باشد و
 * نویسهٔ پنهان/encode‌شده داشته باشد؛ همان‌جا نرمال می‌شود تا هدر ارسالی همیشه سالم باشد.
 */
export function useTheaterSession(
  roomCode: string,
  rawSeatToken: string,
): {
  loading: boolean;
  room: ClientRoomView | null;
  cutsceneElapsedMs: number;
  error: string | null;
  performAction: (action: GameActionPayload) => Promise<{ accepted: boolean; message: string }>;
  sendWhisper: (text: string, shareStub?: boolean) => Promise<void>;
} {
  const seatToken = useMemo(() => normalizeSeatToken(rawSeatToken), [rawSeatToken]);
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<ClientRoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cutsceneElapsedMs, setCutsceneElapsedMs] = useState(0);
  const clockOffsetRef = useRef(0);
  const roomRef = useRef<ClientRoomView | null>(null);
  roomRef.current = room;

  const applyView = useCallback((view: ClientRoomView) => {
    clockOffsetRef.current = computeClockOffset(view.serverNow, Date.now());
    const current = roomRef.current;
    if (current && current.roomCode === view.roomCode && view.version < current.version) {
      return;
    }
    roomRef.current = view;
    setRoom(view);
  }, []);

  useEffect(() => {
    if (!roomCode || !seatToken) return;
    try {
      sessionStorage.setItem(`seat:${roomCode}`, seatToken);
      localStorage.setItem(`seat:${roomCode}`, seatToken);
    } catch {
      // ذخیره محلی اختیاری است
    }
    let cancelled = false;
    (async () => {
      try {
        const { promise } = fetchWithTimeout(
          `/api/rooms/${encodeURIComponent(roomCode)}`,
          { headers: { 'X-Seat-Token': seatToken }, cache: 'no-store' },
          8_000,
        );
        const res = await promise;
        const body = (await res.json()) as
          | ApiOk<{ unchanged: boolean; roomView?: ClientRoomView }>
          | ApiErr;
        if (cancelled) return;
        if (!body.ok) throw new Error(body.error.message);
        if (body.data.roomView) applyView(body.data.roomView);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'خطای شبکه');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomCode, seatToken, applyView]);

  // موج ۳: استریم بلادرنگ SSE اشتراکی (تک‌اتصال برای هر صندلی) + polling مشروط پشتیبان برای محیط‌های Serverless
  useEffect(() => {
    if (!roomCode || !seatToken) return;
    const url = `/api/rooms/${encodeURIComponent(roomCode)}/stream?token=${encodeURIComponent(seatToken)}`;
    const source = openSharedRoomStream(url);

    const onRoomUpdate: EventListener = (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          roomView: ClientRoomView;
        };
        if (payload?.roomView) {
          applyView(payload.roomView);
          setLoading(false);
        }
      } catch {
        // فریم ناقص نادیده گرفته می‌شود؛ فریم بعدی وضعیت کامل را می‌آورد
      }
    };

    const onHeartbeat: EventListener = (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as { serverNow: number };
        clockOffsetRef.current = computeClockOffset(payload.serverNow, Date.now());
      } catch {
        // heartbeat ناقص اثری ندارد
      }
    };

    source?.addEventListener('room_update', onRoomUpdate);
    source?.addEventListener('heartbeat', onHeartbeat);

    // همگام‌سازی سبک شرطی (sinceVersion) تا اگر در Serverless استریم SSE بین دو Lambda جدا افتاد یا قطع شد، نجواها گم نشوند
    let pollInFlight = false;
    let disposed = false;
    const pollTimer = setInterval(() => {
      if (disposed || pollInFlight) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const sinceVersion = roomRef.current?.version ?? 0;
      pollInFlight = true;
      const { promise } = fetchWithTimeout(
        `/api/rooms/${encodeURIComponent(roomCode)}?sinceVersion=${sinceVersion}`,
        { headers: { 'X-Seat-Token': seatToken }, cache: 'no-store' },
        4_000,
      );
      void promise
        .then(async (res) => {
          if (!res.ok || disposed) return;
          const body = (await res.json().catch(() => null)) as
            | ApiOk<{ unchanged: boolean; roomView?: ClientRoomView }>
            | ApiErr
            | null;
          if (!disposed && body && body.ok && !body.data.unchanged && body.data.roomView) {
            applyView(body.data.roomView);
            setLoading(false);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          pollInFlight = false;
        });
    }, ROOM_SYNC_POLL_MS);

    return () => {
      disposed = true;
      clearInterval(pollTimer);
      source?.close();
    };
  }, [roomCode, seatToken, applyView]);

  // محاسبه زنده ۶۰ فریم‌برثانیه سپری‌شده کات‌سین بر پایه ساعت کالیبره‌شده سرور
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const view = roomRef.current;
      setCutsceneElapsedMs(
        computeCutsceneElapsedMs(view?.cutsceneStartedAt ?? null, clockOffsetRef.current, Date.now()),
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const performAction = useCallback(
    async (action: GameActionPayload) => {
      try {
        const { promise } = fetchWithTimeout(
          `/api/rooms/${encodeURIComponent(roomCode)}/action`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Seat-Token': seatToken },
            body: JSON.stringify(action),
            cache: 'no-store',
          },
          8_000,
        );
        const res = await promise;
        const body = (await res.json().catch(() => null)) as
          | ApiOk<{ accepted: boolean; message: string; roomView: ClientRoomView }>
          | ApiErr
          | null;
        if (!body || !body.ok) {
          return {
            accepted: false,
            message: body && !body.ok ? body.error.message : 'پاسخی از سرور دریافت نشد.',
          };
        }
        applyView(body.data.roomView);
        return { accepted: body.data.accepted, message: body.data.message };
      } catch {
        return { accepted: false, message: 'ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.' };
      }
    },
    [roomCode, seatToken, applyView],
  );

  const sendWhisper = useCallback(
    async (text: string, shareStub?: boolean) => {
      const updatedView = await postRoomWhisper(roomCode, seatToken, text, shareStub);
      applyView(updatedView);
    },
    [roomCode, seatToken, applyView],
  );

  return { loading, room, cutsceneElapsedMs, error, performAction, sendWhisper };
}
