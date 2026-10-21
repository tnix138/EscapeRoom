'use client';

import * as THREE from 'three';
import { RemotePlayer, type RemotePlayerOptions } from './RemotePlayer';
import { isPresenceSnapshot, PRESENCE_OFFLINE_TIMEOUT_MS, type PresenceSnapshot } from './types';

export interface RemotePlayerManagerOptions extends RemotePlayerOptions {
  offlineTimeoutMs?: number;
}

export interface RemotePlayerSyncResult {
  added: number;
  updated: number;
  removed: number;
}

/** Maintains the Three.js avatar group for the latest online peers. */
export class RemotePlayerManager extends THREE.Group {
  private readonly players = new Map<string, RemotePlayer>();
  private readonly offlineTimeoutMs: number;
  private disposed = false;

  constructor(private readonly options: RemotePlayerManagerOptions = {}) {
    super();
    this.name = 'RemotePlayerManager';
    this.offlineTimeoutMs = Math.max(1, options.offlineTimeoutMs ?? PRESENCE_OFFLINE_TIMEOUT_MS);
  }

  get size(): number {
    return this.players.size;
  }

  getPlayer(playerId: string): RemotePlayer | undefined {
    return this.players.get(playerId);
  }

  /** Add/update peers, exclude the local player, and remove offline or absent peers. */
  sync(
    snapshots: readonly unknown[],
    now = Date.now(),
    localPlayerId?: string,
  ): RemotePlayerSyncResult {
    if (this.disposed || !Number.isFinite(now)) return { added: 0, updated: 0, removed: 0 };

    const latest = new Map<string, PresenceSnapshot>();
    for (const value of snapshots) {
      if (!isPresenceSnapshot(value)) continue;
      if (value.playerId === localPlayerId || now - value.updatedAt >= this.offlineTimeoutMs) continue;
      const previous = latest.get(value.playerId);
      if (!previous || value.updatedAt >= previous.updatedAt) latest.set(value.playerId, value);
    }

    let added = 0;
    let updated = 0;
    let removed = 0;
    for (const [playerId, snapshot] of latest) {
      const player = this.players.get(playerId);
      if (player) {
        player.setSnapshot(snapshot);
        updated++;
      } else {
        const created = new RemotePlayer(snapshot, this.options);
        this.players.set(playerId, created);
        this.add(created);
        added++;
      }
    }

    for (const [playerId, player] of this.players) {
      if (latest.has(playerId)) continue;
      this.players.delete(playerId);
      this.remove(player);
      player.dispose();
      removed++;
    }

    return { added, updated, removed };
  }

  /** Call once per render frame to interpolate all remote avatars. */
  update(deltaSeconds: number): void {
    for (const player of this.players.values()) player.update(deltaSeconds);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const player of this.players.values()) {
      this.remove(player);
      player.dispose();
    }
    this.players.clear();
    this.clear();
  }
}
