export type StoryAudioCueId =
  | 'door-creak'
  | 'curtain-sweep'
  | 'shadow-breath'
  | 'audience-gasp'
  | 'final-whisper';

export interface StoryAudioCue {
  id: StoryAudioCueId;
  atMs: number;
  pan: number;
}

/** Diegetic, non-verbal sound events aligned with the shared cutscene clock. */
export const ORFEO_STORY_AUDIO_CUES: readonly StoryAudioCue[] = [
  { id: 'door-creak', atMs: 1_700, pan: 0 },
  { id: 'curtain-sweep', atMs: 24_000, pan: 0 },
  { id: 'shadow-breath', atMs: 32_100, pan: -0.72 },
  { id: 'audience-gasp', atMs: 51_100, pan: 0.15 },
  { id: 'final-whisper', atMs: 69_000, pan: 0.72 },
] as const;

/**
 * Fires one-shots only when playback crosses their timestamp. Mid-cutscene joins
 * do not replay old sounds; rewinding a preview permits those cues to play again.
 */
export class StoryCueDirector {
  private lastElapsedMs: number | null = null;
  private readonly fired = new Set<StoryAudioCueId>();

  constructor(
    private readonly cues: readonly StoryAudioCue[] = ORFEO_STORY_AUDIO_CUES,
    private readonly maxLateMs = 750,
  ) {}

  update(elapsedMs: number, onCue: (cue: StoryAudioCue) => void): void {
    if (!Number.isFinite(elapsedMs)) return;
    if (this.lastElapsedMs === null) {
      this.lastElapsedMs = elapsedMs;
      return;
    }

    if (elapsedMs < this.lastElapsedMs) {
      for (const cue of this.cues) {
        if (cue.atMs >= elapsedMs) this.fired.delete(cue.id);
      }
      this.lastElapsedMs = elapsedMs;
      return;
    }

    for (const cue of this.cues) {
      if (
        cue.atMs > this.lastElapsedMs && cue.atMs <= elapsedMs &&
        elapsedMs - cue.atMs <= this.maxLateMs && !this.fired.has(cue.id)
      ) {
        this.fired.add(cue.id);
        onCue(cue);
      }
    }
    this.lastElapsedMs = elapsedMs;
  }

  reset(): void {
    this.lastElapsedMs = null;
    this.fired.clear();
  }
}
