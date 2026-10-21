import type { PlayerTransform } from '../types';

/** Latest client transform sent to the room's presence endpoint. */
export interface PresenceSnapshot {
  playerId: string;
  transform: PlayerTransform;
  updatedAt: number;
}

export interface PresenceTransport {
  publish(snapshot: PresenceSnapshot): Promise<void>;
  subscribe(onSnapshots: (snapshots: readonly PresenceSnapshot[]) => void): () => void;
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
