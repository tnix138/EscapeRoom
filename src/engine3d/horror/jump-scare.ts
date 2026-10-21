export interface JumpScareCue {
  id: string;
  /** Cue activation time on the shared scene timeline, in milliseconds. */
  atMs: number;
  durationMs: number;
  intensity?: number;
  position?: { x: number; y: number; z: number };
}

export interface ActiveJumpScare {
  cue: JumpScareCue;
  progress: number;
  intensity: number;
}

/** A short, deterministic authored jump-scare timeline. */
export class JumpScare {
  private readonly cues: readonly JumpScareCue[];
  private readonly fired = new Set<string>();
  private lastElapsedMs = -Infinity;

  constructor(cues: readonly JumpScareCue[], private readonly onTrigger?: (cue: JumpScareCue) => void) {
    this.cues = validateAndSortCues(cues);
  }

  /**
   * Advance against authoritative elapsed milliseconds. Returns the active cue,
   * triggering its callback once per forward playback pass (including mid-scene joins).
   */
  update(elapsedMs: number): ActiveJumpScare | null {
    if (!Number.isFinite(elapsedMs)) return null;
    if (elapsedMs < this.lastElapsedMs) this.fired.clear();
    this.lastElapsedMs = elapsedMs;

    const cue = findActiveCue(this.cues, elapsedMs);
    if (!cue) return null;
    if (!this.fired.has(cue.id)) {
      this.fired.add(cue.id);
      this.onTrigger?.(cue);
    }

    const progress = clamp((elapsedMs - cue.atMs) / cue.durationMs, 0, 1);
    const envelope = Math.sin(progress * Math.PI);
    return {
      cue,
      progress,
      intensity: clamp(cue.intensity ?? 1, 0, 1) * envelope,
    };
  }

  reset(): void {
    this.lastElapsedMs = -Infinity;
    this.fired.clear();
  }
}

export function findActiveCue(
  cues: readonly JumpScareCue[],
  elapsedMs: number,
): JumpScareCue | null {
  if (!Number.isFinite(elapsedMs)) return null;
  // Later cues win if authored windows overlap.
  for (let index = cues.length - 1; index >= 0; index--) {
    const cue = cues[index];
    if (elapsedMs >= cue.atMs && elapsedMs < cue.atMs + cue.durationMs) return cue;
  }
  return null;
}

function validateAndSortCues(cues: readonly JumpScareCue[]): JumpScareCue[] {
  const ids = new Set<string>();
  return cues.map((cue) => {
    if (!cue.id.trim() || ids.has(cue.id)) throw new Error(`Jump-scare cue id must be unique: ${cue.id}`);
    if (!Number.isFinite(cue.atMs) || cue.atMs < 0 || !Number.isFinite(cue.durationMs) || cue.durationMs <= 0) {
      throw new RangeError(`Invalid jump-scare timing for cue: ${cue.id}`);
    }
    ids.add(cue.id);
    return { ...cue, position: cue.position ? { ...cue.position } : undefined };
  }).sort((a, b) => a.atMs - b.atMs);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
