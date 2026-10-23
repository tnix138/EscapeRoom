'use client';

/**
 * use-presence-feed.ts — اتصال HUD حضور به قرارداد ۲ (فاز ۱۲ — امیرعلی)
 * ---------------------------------------------------------------------------
 * وظیفه: گرفتن snapshotهای هم‌تیمی‌ها از استریم اتاق و فرستادن موقعیت خود بازیکن
 * با نرخ ۱۰Hz — دقیقاً طبق Issue #104.
 *
 * سه قاعدهٔ مهم این فایل:
 *  ۱) **fail-safe بودن**: اگر مسیر `POST/GET /api/rooms/{code}/presence` هنوز
 *     پیاده نشده باشد (فاز ۰۳)، یک‌بار بررسی می‌شود و بعد هیچ درخواستی
 *     فرستاده نمی‌شود؛ نه خطای ۴۰۴ پشت سر هم، نه EventSource دوم.
 *  ۲) **throttle واقعی**: ارسال حداکثر ۱۰ بار در ثانیه و فقط وقتی حرکت
 *     معنادار بوده؛ به‌روزرسانی UI حداکثر یک‌بار در هر فریم (RAF) با هم‌جوشی
 *     ۵۰ms طبق قرارداد.
 *  ۳) **پاک‌سازی**: بعد از ۳۰ ثانیه بی‌خبری، هم‌تیمی از فهرست حذف می‌شود
 *     (قرارداد ۲) و ساعت با `serverNow` سرور هم‌تراز می‌شود، نه ساعت مرورگر.
 *
 * این hook هیچ فایلی از `src/engine3d/**` را تغییر نمی‌دهد و هیچ import ای از
 * موتور سه‌بعدی ندارد.
 */

import { useEffect, useRef, useState } from 'react';
import {
  openSharedRoomStream,
  type SharedStreamHandle,
} from '../../../client-sdk/shared-room-stream';
import {
  PRESENCE_OFFLINE_TIMEOUT_MS,
  PRESENCE_SEND_INTERVAL_MS,
  isTeammateOnline,
  type RemotePlayer,
} from './presence-hud';
import {
  buildPresencePublishBody,
  clockOffsetFromFrame,
  mergePresenceFrames,
  presenceEndpoint,
  presenceProbeRetryDelay,
  presenceStreamUrl,
  readPresenceFrame,
  serverClockNow,
  shouldPublishTransform,
  type PublishableTransform,
} from './presence-contract';

/** فاصلهٔ هم‌جوشی رویدادهای SSE طبق قرارداد (۵۰ms). */
export const PRESENCE_COALESCE_MS = 50;

/** هر چند وقت یک‌بار در نبود حرکت هم یک snapshot تازه بفرستیم (ms). */
export const PRESENCE_KEEPALIVE_MS = 1_000;

/** بعد از این تعداد خطای پشت‌سرهم، ارسال قطع می‌شود. */
export const PRESENCE_MAX_FAILURES = 5;

/** مهلت بررسی اولیهٔ وجود endpoint (ms). */
export const PRESENCE_PROBE_TIMEOUT_MS = 3_000;

export interface UsePresenceFeedOptions {
  roomCode: string;
  seatToken: string | null | undefined;
  playerId: string;
  /** موقعیت محلی موتور (`PlayerTransform`) — yaw آن درجه است. */
  transform: PublishableTransform | null;
  phase: string;
  /** خاموش کردن کامل شبکه (مثلاً حالت پیش‌نمایش). */
  enabled?: boolean;
}

export interface PresenceFeedState {
  /** null = هنوز بررسی نشده؛ false = سرویس در دسترس نیست (HUD بی‌صدا می‌ماند). */
  available: boolean | null;
  /** هم‌تیمی‌های آنلاین (بدون بازیکن محلی). */
  presences: RemotePlayer[];
  /** تخمین ساعت سرور (ms)؛ برای سنجش کهنگی. */
  serverNow: number | null;
}

const INITIAL_STATE: PresenceFeedState = { available: null, presences: [], serverNow: null };

/**
 * خواندن توکن صندلی از همان کلیدهایی که صفحهٔ اتاق می‌نویسد.
 * (بدون تغییر فایل‌های دیگر؛ فقط خواندن.)
 */
export function readStoredSeatToken(roomCode: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const direct = sessionStorage.getItem(`seat:${roomCode}`) ?? localStorage.getItem(`seat:${roomCode}`);
    if (direct) return direct;
    const prefix = `orfeo:${roomCode}:`;
    for (const storage of [sessionStorage, localStorage]) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(prefix)) return storage.getItem(key) ?? key.slice(prefix.length);
      }
    }
  } catch {
    /* storage در دسترس نیست (حالت خصوصی) */
  }
  return null;
}

/**
 * اتصال حضور. در نبود سرویس، `available: false` برمی‌گرداند و هیچ درخواست
 * دیگری نمی‌فرستد؛ HUD می‌تواند بی‌خطر mount بماند.
 */
export function usePresenceFeed({
  roomCode,
  seatToken,
  playerId,
  transform,
  phase,
  enabled = true,
}: UsePresenceFeedOptions): PresenceFeedState {
  const [state, setState] = useState<PresenceFeedState>(INITIAL_STATE);

  const transformRef = useRef(transform);
  transformRef.current = transform;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (!enabled || !roomCode || !playerId) {
      setState(INITIAL_STATE);
      return undefined;
    }

    const token = seatToken ?? readStoredSeatToken(roomCode);
    if (!token) {
      setState({ available: false, presences: [], serverNow: null });
      return undefined;
    }

    let disposed = false;
    let source: SharedStreamHandle | null = null;
    let publishTimer: ReturnType<typeof setInterval> | null = null;
    let pruneTimer: ReturnType<typeof setInterval> | null = null;
    let flushFrame: number | null = null;
    let flushTimeout: ReturnType<typeof setTimeout> | null = null;
    let publishInFlight = false;
    let clockOffset = 0;
    let lastSentAt = 0;
    let lastSentTransform: PublishableTransform | null = null;
    let failures = 0;
    let pending: RemotePlayer[] = [];
    let merged: RemotePlayer[] = [];

    const flush = () => {
      flushFrame = null;
      if (disposed) return;
      const now = serverClockNow(clockOffset);
      merged = merged.filter((player) => isTeammateOnline(player, now));
      const incoming = pending;
      pending = [];
      merged = mergePresenceFrames(merged, incoming);
      setState({ available: true, presences: merged, serverNow: now });
    };

    const scheduleFlush = () => {
      if (disposed || flushFrame !== null) return;
      if (typeof requestAnimationFrame === 'function') {
        flushFrame = requestAnimationFrame(flush);
      } else {
        flushTimeout = setTimeout(flush, PRESENCE_COALESCE_MS);
      }
    };

    const sendPresence = () => {
      if (disposed || publishInFlight) return;
      const current = transformRef.current;
      const now = Date.now();
      const due = now - lastSentAt >= PRESENCE_SEND_INTERVAL_MS;
      if (!due) return;
      const changed = shouldPublishTransform(lastSentTransform, current);
      const keepalive = now - lastSentAt >= PRESENCE_KEEPALIVE_MS;
      if (!changed && !keepalive) return;

      const body = buildPresencePublishBody(current, phaseRef.current);
      if (!body) return;

      lastSentAt = now;
      lastSentTransform = current ? { ...current } : null;
      publishInFlight = true;

      const abortCtrl = typeof AbortController === 'function' ? new AbortController() : null;
      const postTimeout = setTimeout(() => abortCtrl?.abort(), 2_500);

      void fetch(presenceEndpoint(roomCode), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-seat-token': token },
        body: JSON.stringify(body),
        keepalive: true,
        cache: 'no-store',
        signal: abortCtrl?.signal,
      })
        .then(async (response) => {
          if (response.ok) {
            failures = 0;
            const json: unknown = await response.json().catch(() => null);
            const frame = readPresenceFrame(json);
            if (!disposed) {
              if (frame.serverNow !== null) {
                clockOffset = clockOffsetFromFrame(frame.serverNow, Date.now());
              }
              if (frame.presences.length > 0) {
                pending = pending.concat(frame.presences);
                scheduleFlush();
              }
            }
            return;
          }
          failures += 1;
          if (failures >= PRESENCE_MAX_FAILURES) stopPublishing();
        })
        .catch(() => {
          failures += 1;
          if (failures >= PRESENCE_MAX_FAILURES) stopPublishing();
        })
        .finally(() => {
          clearTimeout(postTimeout);
          publishInFlight = false;
        });
    };

    const stopPublishing = () => {
      if (publishTimer) {
        clearInterval(publishTimer);
        publishTimer = null;
      }
    };

    const startStreaming = () => {
      source = openSharedRoomStream(presenceStreamUrl(roomCode, token));
      if (!source) return;
      source.addEventListener('presence_update', (event) => {
        if (disposed) return;
        try {
          const payload: unknown = JSON.parse((event as MessageEvent<string>).data);
          const frame = readPresenceFrame(payload);
          if (frame.serverNow !== null) {
            clockOffset = clockOffsetFromFrame(frame.serverNow, Date.now());
          }
          if (frame.presences.length > 0) {
            pending = pending.concat(frame.presences);
            scheduleFlush();
          }
        } catch {
          // قاب ناقص: فریم بعدی وضعیت را ترمیم می‌کند.
        }
      });
    };

    const prune = () => {
      if (disposed || merged.length === 0) return;
      const now = serverClockNow(clockOffset);
      const remaining = merged.filter((player) => isTeammateOnline(player, now));
      if (remaining.length !== merged.length) {
        merged = remaining;
        setState({ available: true, presences: merged, serverNow: now });
      }
    };

    // ۱) بررسی وجود سرویس (فاز ۰۳). در نبودش، HUD بی‌صدا می‌ماند.
    //    خطای گذرا (ری‌استارت سرور) باعث خاموشی دائمی نمی‌شود: حداکثر سه
    //    تلاش دوباره با فاصلهٔ ۵/۱۵/۳۰ ثانیه، بعد سکوت کامل.
    let probeAttempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const probe = () => {
      if (disposed) return;
      controller = typeof AbortController === 'function' ? new AbortController() : null;
      const probeTimeout = setTimeout(() => controller?.abort(), PRESENCE_PROBE_TIMEOUT_MS);

      fetch(`${presenceEndpoint(roomCode)}?token=${encodeURIComponent(token)}`, {
        headers: { 'x-seat-token': token },
        cache: 'no-store',
        signal: controller?.signal,
      })
        .then((response) => {
          clearTimeout(probeTimeout);
          if (disposed) return;
          // ۴۰۴/۵۰۱ یعنی سرویس حضور هنوز سوار نشده؛ ۴۰۱/۴۰۳ یعنی توکن معتبر نیست.
          if (!response.ok) {
            const delay = presenceProbeRetryDelay(probeAttempt);
            probeAttempt += 1;
            if (delay !== null) {
              retryTimer = setTimeout(probe, delay);
            } else {
              setState({ available: false, presences: [], serverNow: null });
            }
            return;
          }
          setState((previous) => ({ ...previous, available: true }));
          startStreaming();
          publishTimer = setInterval(sendPresence, PRESENCE_SEND_INTERVAL_MS);
          pruneTimer = setInterval(prune, 1_000);
          sendPresence();
        })
        .catch(() => {
          clearTimeout(probeTimeout);
          if (disposed) return;
          const delay = presenceProbeRetryDelay(probeAttempt);
          probeAttempt += 1;
          if (delay !== null) retryTimer = setTimeout(probe, delay);
          else setState({ available: false, presences: [], serverNow: null });
        });
    };

    probe();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      controller?.abort();
      stopPublishing();
      if (pruneTimer) clearInterval(pruneTimer);
      if (flushFrame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(flushFrame);
      if (flushTimeout) clearTimeout(flushTimeout);
      source?.close();
      source = null;
    };
  }, [enabled, roomCode, seatToken, playerId]);

  return state;
}

export { PRESENCE_OFFLINE_TIMEOUT_MS, PRESENCE_SEND_INTERVAL_MS };
