import {
  acceptSnapshot,
  isPresenceSnapshot,
  PRESENCE_OFFLINE_TIMEOUT_MS,
  type PresenceSnapshot,
} from './types';

/** Small, allocation-conscious store for the latest remote transform per player. */
export class PresenceTracker {
  private readonly snapshots = new Map<string, PresenceSnapshot>();

  constructor(private readonly offlineTimeoutMs = PRESENCE_OFFLINE_TIMEOUT_MS) {}

  update(input: unknown): boolean {
    if (!isPresenceSnapshot(input)) return false;
    const previous = this.snapshots.get(input.playerId);
    if (!acceptSnapshot(previous, input)) return false;
    this.snapshots.set(input.playerId, {
      playerId: input.playerId,
      updatedAt: input.updatedAt,
      transform: { ...input.transform },
    });
    return true;
  }

  updateMany(inputs: readonly unknown[]): boolean {
    let changed = false;
    for (const input of inputs) changed = this.update(input) || changed;
    return changed;
  }

  /** Returns fresh snapshots, excluding the local player, and prunes stale entries. */
  getOnline(now: number, localPlayerId?: string): PresenceSnapshot[] {
    const online: PresenceSnapshot[] = [];
    for (const [playerId, snapshot] of this.snapshots) {
      if (now - snapshot.updatedAt >= this.offlineTimeoutMs) {
        this.snapshots.delete(playerId);
        continue;
      }
      if (playerId !== localPlayerId) online.push(snapshot);
    }
    return online;
  }

  clear(): void {
    this.snapshots.clear();
  }
}
