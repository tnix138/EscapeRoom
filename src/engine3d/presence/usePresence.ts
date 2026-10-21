'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlayerTransform } from '../types';
import { PresenceTracker } from './presence-tracker';
import {
  canPublishPresence,
  PRESENCE_OFFLINE_TIMEOUT_MS,
  PRESENCE_SEND_INTERVAL_MS,
  parsePresenceFrame,
  type PresenceSnapshot,
  type PresenceTransport,
} from './types';

export interface UsePresenceOptions {
  roomCode: string;
  seatToken: string;
  playerId: string;
  transform: PlayerTransform | null;
  phase?: string;
  enabled?: boolean;
  /** Override for tests or a different realtime transport. */
  transport?: PresenceTransport;
}

export interface UsePresenceResult {
  remotePlayers: PresenceSnapshot[];
}

/**
 * Synchronizes local player transforms at 10Hz and tracks remote peers.
 * The default client transport expects Phase 03's authenticated POST endpoint and
 * a `presence_update` event on the room SSE stream.
 */
export function createPresenceHttpTransport(roomCode: string, seatToken: string): PresenceTransport {
  const roomPath = `/api/rooms/${encodeURIComponent(roomCode)}`;
  return {
    async publish(snapshot, phase = snapshot.phase ?? 'alley_puzzle') {
      const response = await fetch(`${roomPath}/presence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Seat-Token': seatToken,
        },
        body: JSON.stringify({
          position: {
            x: snapshot.transform.x,
            y: snapshot.transform.y,
            z: snapshot.transform.z,
          },
          // The room API stores yaw in radians while Three.js transforms use degrees.
          yaw: snapshot.transform.yawDeg * (Math.PI / 180),
          phase,
        }),
      });
      if (!response.ok) throw new Error(`Presence publish failed (${response.status})`);
    },
    subscribe(onSnapshots) {
      let closed = false;
      const headers = { 'X-Seat-Token': seatToken };
      // Bootstrap a newly joined player from the authenticated snapshot endpoint.
      void fetch(`${roomPath}/presence`, { headers })
        .then(async (response) => {
          if (!response.ok) return;
          const body: unknown = await response.json();
          const frame = body && typeof body === 'object' && 'data' in body
            ? (body as { data: unknown }).data
            : body;
          const snapshots = parsePresenceFrame(frame);
          if (!closed && snapshots.length) onSnapshots(snapshots);
        })
        .catch(() => undefined);

      if (typeof EventSource === 'undefined') return () => { closed = true; };
      const source = new EventSource(
        `${roomPath}/stream?token=${encodeURIComponent(seatToken)}`,
      );
      const onPresence = (event: MessageEvent<string>) => {
        try {
          const snapshots = parsePresenceFrame(JSON.parse(event.data) as unknown);
          if (snapshots.length) onSnapshots(snapshots);
        } catch {
          // Ignore malformed realtime frames; the next complete snapshot repairs state.
        }
      };
      source.addEventListener('presence_update', onPresence as EventListener);
      return () => {
        closed = true;
        source.removeEventListener('presence_update', onPresence as EventListener);
        source.close();
      };
    },
  };
}

export function usePresence({
  roomCode,
  seatToken,
  playerId,
  transform,
  phase = 'alley_puzzle',
  enabled = true,
  transport,
}: UsePresenceOptions): UsePresenceResult {
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const trackerRef = useRef<PresenceTracker | null>(null);
  if (!trackerRef.current) trackerRef.current = new PresenceTracker();
  const [remotePlayers, setRemotePlayers] = useState<PresenceSnapshot[]>([]);

  useEffect(() => {
    const tracker = trackerRef.current!;
    tracker.clear();
    setRemotePlayers([]);
    if (!enabled || !roomCode || !seatToken || !playerId) return;

    const activeTransport = transport ?? createPresenceHttpTransport(roomCode, seatToken);
    let lastPublishedAt = -Infinity;
    let publishing = false;
    let disposed = false;

    const refreshRemotePlayers = (now: number) => {
      if (disposed) return;
      const next = tracker.getOnline(now, playerId);
      setRemotePlayers((current) => {
        const unchanged = current.length === next.length && current.every((snapshot, index) => {
          const candidate = next[index];
          const a = snapshot.transform;
          const b = candidate.transform;
          return snapshot.playerId === candidate.playerId && snapshot.updatedAt === candidate.updatedAt &&
            a.x === b.x && a.y === b.y && a.z === b.z &&
            a.yawDeg === b.yawDeg && a.pitchDeg === b.pitchDeg;
        });
        return unchanged ? current : next;
      });
    };

    const unsubscribe = activeTransport.subscribe((snapshots) => {
      if (tracker.updateMany(snapshots)) refreshRemotePlayers(Date.now());
    });

    const publishLatest = async () => {
      const currentTransform = transformRef.current;
      const now = Date.now();
      if (
        disposed || publishing || !currentTransform ||
        !canPublishPresence(now, lastPublishedAt)
      ) return;

      lastPublishedAt = now;
      publishing = true;
      const snapshot: PresenceSnapshot = {
        playerId,
        transform: { ...currentTransform },
        updatedAt: now,
        phase,
      };
      try {
        await activeTransport.publish(snapshot, phase);
      } catch {
        // A temporary network error must not stop later 10Hz updates.
      } finally {
        publishing = false;
      }
    };

    void publishLatest();
    const timer = setInterval(() => {
      void publishLatest();
      // Prune peers even during a quiet period with no new SSE frames.
      refreshRemotePlayers(Date.now());
    }, PRESENCE_SEND_INTERVAL_MS);

    return () => {
      disposed = true;
      clearInterval(timer);
      unsubscribe();
      tracker.clear();
    };
  }, [enabled, roomCode, seatToken, playerId, phase, transport]);

  return { remotePlayers };
}

export { PRESENCE_OFFLINE_TIMEOUT_MS, PRESENCE_SEND_INTERVAL_MS };
