import type { GamePhase } from '@/contracts/types';
import {
  DOOR_CUTSCENE_DURATION_MS as CONTRACT_DOOR_CUTSCENE_DURATION_MS,
  TOTAL_CUTSCENE_DURATION_MS,
} from '@/contracts/types';

export const DOOR_CUTSCENE_DURATION_MS = CONTRACT_DOOR_CUTSCENE_DURATION_MS;
export const FULL_CUTSCENE_DURATION_MS = TOTAL_CUTSCENE_DURATION_MS;

/**
 * Keep the presentation moving between cutscene chapters even when the SSE
 * connection has not yet delivered the server's next phase snapshot.
 */
export function resolveRoomPhase(phase: GamePhase, elapsedMs: number): GamePhase {
  if (phase === 'in_theater') return phase;

  if (phase === 'door_cutscene' || phase === 'theater_cutscene') {
    if (elapsedMs >= FULL_CUTSCENE_DURATION_MS) return 'in_theater';
    if (phase === 'door_cutscene' && elapsedMs >= DOOR_CUTSCENE_DURATION_MS) {
      return 'theater_cutscene';
    }
  }

  return phase;
}
