/** Procedural, asset-free horror ambience; AudioContext is created only after user interaction. */

export function heartbeatIntervalMs(fearLevel: number): number {
  const level = clamp(fearLevel, 0, 1);
  const beatsPerMinute = 58 + level * 82;
  return 60_000 / beatsPerMinute;
}

/** Convert threat distance to fear: near threats approach 1, distant threats approach 0. */
export function fearLevelFromThreatDistance(
  distanceM: number,
  nearM = 4,
  farM = 16,
): number {
  if (!Number.isFinite(distanceM) || !Number.isFinite(nearM) || !Number.isFinite(farM) ||
    nearM < 0 || farM <= nearM) {
    throw new RangeError('Threat distance must be finite and farM must be greater than nearM >= 0.');
  }
  return 1 - clamp((distanceM - nearM) / (farM - nearM), 0, 1);
}

export interface HorrorAudioOptions {
  masterVolume?: number;
  windVolume?: number;
  heartbeatVolume?: number;
  audienceVolume?: number;
}

export class HorrorAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private heartbeatGain: GainNode | null = null;
  private audienceGain: GainNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private audienceSource: AudioBufferSourceNode | null = null;
  private audienceFilter: BiquadFilterNode | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatActive = false;
  private disposed = false;
  private muted = false;
  private fearLevel = 0.25;
  private readonly masterVolume: number;
  private readonly windVolume: number;
  private readonly heartbeatVolume: number;
  private readonly audienceVolume: number;

  constructor(options: HorrorAudioOptions = {}) {
    this.masterVolume = clamp(options.masterVolume ?? 0.75, 0, 1);
    this.windVolume = clamp(options.windVolume ?? 0.28, 0, 1);
    this.heartbeatVolume = clamp(options.heartbeatVolume ?? 0.72, 0, 1);
    this.audienceVolume = clamp(options.audienceVolume ?? 0.045, 0, 0.2);
  }

  get isInitialized(): boolean {
    return this.context !== null;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get fear(): number {
    return this.fearLevel;
  }

  /** Call from a user gesture; returns false safely in SSR/unsupported browsers. */
  async init(): Promise<boolean> {
    if (this.disposed || typeof window === 'undefined') return false;
    if (!this.context) {
      const Context = window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return false;
      this.context = new Context();
      this.buildGraph();
    }
    if (this.context.state === 'suspended') await this.context.resume();
    return true;
  }

  startAmbience(): void {
    const context = this.context;
    if (!context || this.disposed) return;
    if (!this.windSource) {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const channel = buffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < channel.length; i++) {
        // Low-frequency Brownian wind: smooth noise with a restrained rumbling character.
        brown = (brown + 0.025 * (Math.random() * 2 - 1)) / 1.025;
        channel[i] = brown * 3.5;
      }
      source.buffer = buffer;
      source.loop = true;
      filter.type = 'lowpass';
      filter.frequency.value = 430;
      filter.Q.value = 0.5;
      source.connect(filter);
      filter.connect(this.windGain!);
      source.start();
      this.windSource = source;
      this.windFilter = filter;
    }
    this.startAudienceAmbience();
    this.startHeartbeat();
  }

  private startAudienceAmbience(): void {
    const context = this.context;
    if (!context || !this.audienceGain || this.audienceSource || this.disposed) return;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index++) {
      // Whisper-quiet filtered noise suggests a distant, indistinct audience without words.
      channel[index] = (Math.random() * 2 - 1) * (0.55 + 0.45 * Math.sin(index * 0.00021));
    }
    source.buffer = buffer;
    source.loop = true;
    filter.type = 'bandpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.42;
    source.connect(filter);
    filter.connect(this.audienceGain);
    source.start();
    this.audienceFilter = filter;
    this.audienceSource = source;
  }

  setFearLevel(level: number): void {
    if (!Number.isFinite(level)) throw new RangeError('Fear level must be a finite number.');
    this.fearLevel = clamp(level, 0, 1);
    const now = this.context?.currentTime ?? 0;
    this.windFilter?.frequency.setTargetAtTime(280 + this.fearLevel * 420, now, 0.18);
    this.windGain?.gain.setTargetAtTime(this.muted ? 0 : this.windVolume * (0.65 + this.fearLevel * 0.5), now, 0.12);
    this.audienceGain?.gain.setTargetAtTime(
      this.muted ? 0 : this.audienceVolume * (1 - this.fearLevel * 0.55), now, 0.35,
    );
    // The next beat reads the latest fear level; do not reset its timer on every state update.
  }

  /** Update fear and heartbeat from the nearest active threat distance. */
  setThreatDistance(distanceM: number, nearM = 4, farM = 16): number {
    const level = fearLevelFromThreatDistance(distanceM, nearM, farM);
    this.setFearLevel(level);
    return level;
  }

  /** One immediate double-thump; safe to call before init (no-op). */
  triggerHeartbeat(): void {
    if (!this.context || !this.heartbeatGain || this.muted || this.disposed) return;
    const at = this.context.currentTime + 0.01;
    this.playThump(at, 1);
    this.playThump(at + 0.12, 0.72);
  }

  startHeartbeat(): void {
    if (!this.context || this.disposed || this.heartbeatActive) return;
    this.heartbeatActive = true;
    this.scheduleNextHeartbeat(0);
  }

  stopHeartbeat(): void {
    this.heartbeatActive = false;
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.masterGain?.gain.setTargetAtTime(muted ? 0 : this.masterVolume, this.context?.currentTime ?? 0, 0.025);
  }

  stopAmbience(): void {
    this.stopHeartbeat();
    if (this.windSource) {
      try {
        this.windSource.stop();
      } catch {
        // Already stopped.
      }
      this.windSource.disconnect();
      this.windSource = null;
    }
    this.windFilter?.disconnect();
    this.windFilter = null;
    if (this.audienceSource) {
      try {
        this.audienceSource.stop();
      } catch {
        // Already stopped.
      }
      this.audienceSource.disconnect();
      this.audienceSource = null;
    }
    this.audienceFilter?.disconnect();
    this.audienceFilter = null;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.stopAmbience();
    if (this.context) {
      await this.context.close().catch(() => undefined);
      this.context = null;
      this.masterGain = null;
      this.windGain = null;
      this.heartbeatGain = null;
      this.audienceGain = null;
    }
  }

  private buildGraph(): void {
    const context = this.context;
    if (!context) return;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -22;
    compressor.ratio.value = 5;
    compressor.connect(context.destination);

    this.masterGain = context.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    this.masterGain.connect(compressor);

    this.windGain = context.createGain();
    this.windGain.gain.value = this.windVolume * (0.65 + this.fearLevel * 0.5);
    this.windGain.connect(this.masterGain);

    this.heartbeatGain = context.createGain();
    this.heartbeatGain.gain.value = this.heartbeatVolume;
    this.heartbeatGain.connect(this.masterGain);

    this.audienceGain = context.createGain();
    this.audienceGain.gain.value = this.audienceVolume * (1 - this.fearLevel * 0.55);
    this.audienceGain.connect(this.masterGain);
  }

  private scheduleNextHeartbeat(delayMs: number): void {
    this.stopHeartbeatTimer();
    if (!this.heartbeatActive || this.disposed) return;
    this.heartbeatTimer = setTimeout(() => {
      if (!this.heartbeatActive || this.disposed) return;
      if (!this.muted) this.triggerHeartbeat();
      this.scheduleNextHeartbeat(heartbeatIntervalMs(this.fearLevel));
    }, Math.max(0, delayMs));
  }

  private stopHeartbeatTimer(): void {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private playThump(at: number, volume: number): void {
    const context = this.context;
    const output = this.heartbeatGain;
    if (!context || !output) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const filter = context.createBiquadFilter();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(63 - this.fearLevel * 12, at);
    oscillator.frequency.exponentialRampToValueAtTime(38, at + 0.13);
    filter.type = 'lowpass';
    filter.frequency.value = 150;
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.001, volume * this.heartbeatVolume * (0.2 + this.fearLevel * 0.45)),
      at + 0.012,
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.19);
    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(output);
    oscillator.start(at);
    oscillator.stop(at + 0.2);
    oscillator.onended = () => {
      oscillator.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}
