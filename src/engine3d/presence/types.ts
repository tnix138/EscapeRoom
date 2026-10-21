import type { PlayerTransform } from '../types';

/** Latest client transform sent to the room's presence endpoint. */
export interface PresenceSnapshot {
  playerId: string;
  transform: PlayerTransform;
  updatedAt: number;
  playerName?: string | null;
  seatIndex?: number;
  phase?: string;
}

export interface PresenceTransport {
  publish(snapshot: PresenceSnapshot, phase?: string): Promise<void>;
  subscribe(onSnapshots: (snapshots: readonly PresenceSnapshot[]) => void): () => void;
}

/** Decode the server presence frame (position + radian yaw) into client transforms. */
export function parsePresenceFrame(value: unknown): PresenceSnapshot[] {
  const records = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? ((value as { presences?: unknown; snapshots?: unknown }).presences ??
        (value as { snapshots?: unknown }).snapshots)
      : null;
  if (!Array.isArray(records)) return [];

  return records.flatMap((record): PresenceSnapshot[] => {
    if (isPresenceSnapshot(record)) return [{ ...record, transform: { ...record.transform } }];
    if (!record || typeof record !== 'object') return [];
    const wire = record as {
      playerId?: unknown;
      playerName?: unknown;
      seatIndex?: unknown;
      position?: { x?: unknown; y?: unknown; z?: unknown } | null;
      yaw?: unknown;
      phase?: unknown;
      updatedAt?: unknown;
      lastUpdate?: unknown;
      receivedAt?: unknown;
    };
    const position = wire.position;
    const updatedAt = wire.lastUpdate ?? wire.receivedAt ?? wire.updatedAt;
    if (
      typeof wire.playerId !== 'string' || !wire.playerId || !position ||
      !Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z) ||
      !Number.isFinite(wire.yaw) || !Number.isFinite(updatedAt)
    ) return [];

    return [{
      playerId: wire.playerId,
      transform: {
        x: position.x as number,
        y: position.y as number,
        z: position.z as number,
        yawDeg: (wire.yaw as number) * (180 / Math.PI),
        pitchDeg: 0,
      },
      updatedAt: updatedAt as number,
      playerName: typeof wire.playerName === 'string' ? wire.playerName : null,
      ...(Number.isInteger(wire.seatIndex) ? { seatIndex: wire.seatIndex as number } : {}),
      ...(typeof wire.phase === 'string' ? { phase: wire.phase } : {}),
    }];
  });
}

export const PRESENCE_SEND_INTERVAL_MS = 100;
export const PRESENCE_OFFLINE_TIMEOUT_MS = 30_000;

export function isPresenceSnapshot(value: unknown): value is PresenceSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<PresenceSnapshot>;
  const transform = snapshot.transform;
  return Boolean(
    typeof snapshot.playerId === 'string' && snapshot.playerId.length > 0 &&
    typeof snapshot.updatedAt === 'number' && Number.isFinite(snapshot.updatedAt) &&
    (snapshot.playerName === undefined || snapshot.playerName === null || typeof snapshot.playerName === 'string') &&
    (snapshot.seatIndex === undefined || Number.isInteger(snapshot.seatIndex)) &&
    (snapshot.phase === undefined || typeof snapshot.phase === 'string') &&
    transform &&
    Number.isFinite(transform.x) && Number.isFinite(transform.y) && Number.isFinite(transform.z) &&
    Number.isFinite(transform.yawDeg) && Number.isFinite(transform.pitchDeg),
  );
}

/** Rejects snapshots older than the most recently accepted update for that player. */
export function acceptSnapshot(
  previous: PresenceSnapshot | undefined,
  incoming: PresenceSnapshot,
): boolean {
  return !previous || incoming.updatedAt >= previous.updatedAt;
}

/** True when the 10Hz throttle permits sending the current transform. */
export function canPublishPresence(now: number, lastPublishedAt: number): boolean {
  return Number.isFinite(now) && now - lastPublishedAt >= PRESENCE_SEND_INTERVAL_MS;
}
