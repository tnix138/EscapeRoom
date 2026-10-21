'use client';
// src/client-sdk/index.ts — اکسپورت‌های توحید طبق API-CONTRACT.md بخش ۴.۱
// موج ۱: reserveRoomApi + createPreviewRoomState
// (هوک کامل SSE و همگام‌سازی ۶۰ فریم در موج ۳ روی همین امضاها تکمیل می‌شود.)
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameActionPayload } from '../contracts/actions';
import type { ClientRoomView, HostReservationResult } from '../contracts/types';

export { createPreviewRoomState, PREVIEW_PLAYER_NAMES } from './preview-fixtures';

interface ApiOk<T> {
  ok: true;
  data: T;
}
interface ApiErr {
  ok: false;
  error: { code: string; message: string };
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

export function useTheaterSession(
  roomCode: string,
  seatToken: string,
): {
  loading: boolean;
  room: ClientRoomView | null;
  cutsceneElapsedMs: number;
  error: string | null;
  performAction: (action: GameActionPayload) => Promise<{ accepted: boolean; message: string }>;
  sendWhisper: (text: string, shareStub?: boolean) => Promise<void>;
} {
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<ClientRoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cutsceneElapsedMs, setCutsceneElapsedMs] = useState(0);
  const clockOffsetRef = useRef(0);
  const roomRef = useRef<ClientRoomView | null>(null);
  roomRef.current = room;

  const applyView = useCallback((view: ClientRoomView) => {
    clockOffsetRef.current = view.serverNow - Date.now();
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
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`, {
          headers: { 'X-Seat-Token': seatToken },
        });
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

  // محاسبه زنده سپری‌شده کات‌سین بر پایه ساعت سرور (تکمیل ۶۰fps + SSE در موج ۳)
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const view = roomRef.current;
      if (view?.cutsceneStartedAt) {
        setCutsceneElapsedMs(
          Math.max(0, Date.now() + clockOffsetRef.current - view.cutsceneStartedAt),
        );
      } else {
        setCutsceneElapsedMs(0);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const performAction = useCallback(
    async (action: GameActionPayload) => {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Seat-Token': seatToken },
        body: JSON.stringify(action),
      });
      const body = (await res.json()) as
        | ApiOk<{ accepted: boolean; message: string; roomView: ClientRoomView }>
        | ApiErr;
      if (!body.ok) return { accepted: false, message: body.error.message };
      applyView(body.data.roomView);
      return { accepted: body.data.accepted, message: body.data.message };
    },
    [roomCode, seatToken, applyView],
  );

  const sendWhisper = useCallback(
    async (text: string, shareStub?: boolean) => {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Seat-Token': seatToken },
        body: JSON.stringify({ text, shareStub }),
      });
      const body = (await res.json()) as ApiOk<{ roomView: ClientRoomView }> | ApiErr;
      if (body.ok) applyView(body.data.roomView);
    },
    [roomCode, seatToken, applyView],
  );

  return { loading, room, cutsceneElapsedMs, error, performAction, sendWhisper };
}
