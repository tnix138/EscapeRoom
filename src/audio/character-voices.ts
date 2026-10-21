/**
 * character-voices.ts — کارگردان و پردازشگر صدای هوش مصنوعی شخصیت‌های «تماشاخانه اُرفه‌ئو»
 * -----------------------------------------------------------------------------------------
 * هر ۵ شخصیت داستانی (`دربان`، `راوی`، `بانوی صحنه`، `مرد سیاه‌پوش`، `همهمهٔ تالار`)
 * فایل صوتی از پیش تولیدشده با هوش مصنوعی دارند (`/audio/dialogue/<id>.mp3`) و در زمان پخش
 * از یک زنجیره اختصاصی Web Audio عبور می‌کنند:
 *  - بُرش خودکار سکوت ابتدایی و انتهایی فایل صوتی (`trimAudioBufferSilence`) برای قفل میلی‌ثانیه‌ای؛
 *  - فیلتر آکوستیک و پن فضایی مختص هر شخصیت (مثلاً رزونانس بم و پن چپ برای مرد سیاه‌پوش،
 *    و لایه‌بندی هم‌سرایی شبح‌وار چپ/راست برای همهمهٔ تالار)؛
 *  - کاهش نرم صدای موسیقی پس‌زمینه هنگام صحبت کاراکترها (Auto-Ducking)؛
 *  - پشتیبانی از پرش زمانی، ورود میانهٔ کات‌سین و باز شدن دیرهنگام صدای مرورگر با آفست دقیق.
 */

import {
  ORFEO_STORY_SCRIPT,
  type StoryDialogueCue,
  type StorySpeaker,
} from '../components/cinema/story-script';

export type CharacterRoleId =
  | 'usher'
  | 'narrator'
  | 'stage-lady'
  | 'dark-man'
  | 'hall-whisper';

export interface CharacterVoiceProfile {
  roleId: CharacterRoleId;
  /** موقعیت استریوی پایه شخصیت در صحنه [-1, +1] پیش از چرخش سر بازیکن */
  basePan: number;
  /** ضریب سرعت/زیروبمی پخش برای امضای صوتی شخصیت و هم‌ترازی دقیق با بازه دیالوگ */
  playbackRate: number;
  /** تراز خروجی صدای شخصیت */
  gain: number;
  /** نوع فیلتر شکل‌دهنده رنگ صدا */
  filterType: BiquadFilterType;
  filterFreqHz: number;
  filterGainDb: number;
  filterQ: number;
  /** میزان ارسال خشک/تر اضافه یا لایه هم‌سرایی همهمه (۰ یا ۲ لایه شبح‌وار چپ و راست) */
  chorusVoices: 0 | 2;
  /** ضریب کاهش موقت موسیقی پس‌زمینه هنگام صحبت این شخصیت (۱ یعنی بدون کاهش) */
  duckLevel: number;
}

export const CHARACTER_VOICE_PROFILES: Readonly<Record<StorySpeaker, CharacterVoiceProfile>> = {
  'دربان': {
    roleId: 'usher',
    basePan: -0.08,
    playbackRate: 1.03,
    gain: 1.0,
    filterType: 'peaking',
    filterFreqHz: 340,
    filterGainDb: 2.4,
    filterQ: 1.0,
    chorusVoices: 0,
    duckLevel: 0.42,
  },
  'راوی': {
    roleId: 'narrator',
    basePan: 0,
    playbackRate: 1.05,
    gain: 1.02,
    filterType: 'highshelf',
    filterFreqHz: 3_800,
    filterGainDb: 2.0,
    filterQ: 0.7,
    chorusVoices: 0,
    duckLevel: 0.44,
  },
  'بانوی صحنه': {
    roleId: 'stage-lady',
    basePan: 0.12,
    playbackRate: 1.08,
    gain: 1.0,
    filterType: 'peaking',
    filterFreqHz: 2_600,
    filterGainDb: 2.8,
    filterQ: 1.1,
    chorusVoices: 0,
    duckLevel: 0.38,
  },
  'مرد سیاه‌پوش': {
    roleId: 'dark-man',
    basePan: -0.42,
    playbackRate: 0.99,
    gain: 1.14,
    filterType: 'lowshelf',
    filterFreqHz: 210,
    filterGainDb: 5.5,
    filterQ: 0.8,
    chorusVoices: 0,
    duckLevel: 0.34,
  },
  'همهمهٔ تالار': {
    roleId: 'hall-whisper',
    basePan: 0,
    playbackRate: 1.01,
    gain: 0.96,
    filterType: 'bandpass',
    filterFreqHz: 1_350,
    filterGainDb: 0,
    filterQ: 0.55,
    chorusVoices: 2,
    duckLevel: 0.45,
  },
};

export const DIALOGUE_AUDIO_BASE_PATH = '/audio/dialogue';

/** مسیر عمومی فایل صوتی هر دیالوگ بر اساس شناسه پایدار آن در `ORFEO_STORY_SCRIPT` */
export function getDialogueAudioUrl(cueId: string): string {
  return `${DIALOGUE_AUDIO_BASE_PATH}/${encodeURIComponent(cueId)}.mp3`;
}

/**
 * حذف سکوت دیجیتال ابتدایی و انتهایی یک `AudioBuffer` با حفظ حاشیه نرم ۲۰ میلی‌ثانیه‌ای
 * تا شروع هر جمله دقیقاً روی زمان `startMs` بنشیند و هیچ کلیک صوتی ایجاد نشود.
 */
export function trimAudioBufferSilence(
  ctx: Pick<BaseAudioContext, 'createBuffer'>,
  buffer: AudioBuffer,
  threshold = 0.008,
): AudioBuffer {
  const { numberOfChannels, length, sampleRate } = buffer;
  if (length === 0 || numberOfChannels === 0) return buffer;

  let firstSample = length;
  let lastSample = -1;

  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      if (Math.abs(data[i]) >= threshold) {
        if (i < firstSample) firstSample = i;
        break;
      }
    }
    for (let i = length - 1; i >= 0; i--) {
      if (Math.abs(data[i]) >= threshold) {
        if (i > lastSample) lastSample = i;
        break;
      }
    }
  }

  // اگر کل بافر زیر آستانه سکوت بود، دست‌نخورده برگردان
  if (lastSample < firstSample) return buffer;

  const padSamples = Math.floor(sampleRate * 0.02);
  const start = Math.max(0, firstSample - padSamples);
  const end = Math.min(length, lastSample + padSamples + 1);
  const trimmedLength = end - start;
  if (trimmedLength <= 0 || trimmedLength === length) return buffer;

  const trimmed = ctx.createBuffer(numberOfChannels, trimmedLength, sampleRate);
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    trimmed.getChannelData(ch).set(src.subarray(start, end));
  }
  return trimmed;
}

export type DialogueBufferLoader = (
  url: string,
  ctx: BaseAudioContext,
) => Promise<AudioBuffer | null>;

async function defaultBufferLoader(
  url: string,
  ctx: BaseAudioContext,
): Promise<AudioBuffer | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    return trimAudioBufferSilence(ctx, decoded);
  } catch {
    return null;
  }
}

interface ActivePlaybackHandle {
  cueId: string;
  token: number;
  sources: AudioBufferSourceNode[];
  envelope: GainNode;
}

export interface CharacterVoiceDirectorOptions {
  cues?: readonly StoryDialogueCue[];
  loader?: DialogueBufferLoader;
  onDuckChange?: (duckLevel: number) => void;
}

export class CharacterVoiceDirector {
  private readonly cues: readonly StoryDialogueCue[];
  private readonly loader: DialogueBufferLoader;
  private readonly onDuckChange?: (duckLevel: number) => void;

  private ctx: AudioContext | null = null;
  private outputBus: AudioNode | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly inflight = new Map<string, Promise<AudioBuffer | null>>();

  private active: ActivePlaybackHandle | null = null;
  private firedCueIds = new Set<string>();
  private lastElapsedMs: number | null = null;
  private playbackToken = 0;
  private disposed = false;

  constructor(options: CharacterVoiceDirectorOptions = {}) {
    this.cues = options.cues ?? ORFEO_STORY_SCRIPT;
    this.loader = options.loader ?? defaultBufferLoader;
    this.onDuckChange = options.onDuckChange;
  }

  attach(ctx: AudioContext, outputBus: AudioNode): void {
    this.disposed = false;
    this.ctx = ctx;
    this.outputBus = outputBus;
  }

  get loadedCount(): number {
    return this.buffers.size;
  }

  get activeCueId(): string | null {
    return this.active?.cueId ?? null;
  }

  /** بارگذاری موازی همه دیالوگ‌ها در حافظه (بدون خطا اگر شبکه یا فایل در تست نبود) */
  async preloadAll(): Promise<void> {
    if (!this.ctx || this.disposed) return;
    await Promise.all(this.cues.map((cue) => this.ensureBuffer(cue.id)));
  }

  private ensureBuffer(cueId: string): Promise<AudioBuffer | null> {
    const existing = this.buffers.get(cueId);
    if (existing) return Promise.resolve(existing);
    const pending = this.inflight.get(cueId);
    if (pending) return pending;
    const ctx = this.ctx;
    if (!ctx || this.disposed) return Promise.resolve(null);

    const task = this.loader(getDialogueAudioUrl(cueId), ctx)
      .then((buffer) => {
        this.inflight.delete(cueId);
        if (buffer && !this.disposed) {
          this.buffers.set(cueId, buffer);
          this.resumePendingCueIfStillActive(cueId);
        }
        return buffer;
      })
      .catch(() => {
        this.inflight.delete(cueId);
        return null;
      });
    this.inflight.set(cueId, task);
    return task;
  }

  /**
   * اگر صدای مرورگر در میانه یک دیالوگ باز شد و بافر چند میلی‌ثانیه بعد دیکد شد،
   * باقی‌مانده همان جمله دقیقاً از لحظه جاری کات‌سین پخش می‌شود.
   */
  private resumePendingCueIfStillActive(cueId: string): void {
    if (this.lastElapsedMs === null || this.active?.cueId === cueId) return;
    const cue = this.cues.find((item) => item.id === cueId);
    if (!cue) return;
    if (this.lastElapsedMs >= cue.startMs && this.lastElapsedMs < cue.endMs) {
      const offsetSec = (this.lastElapsedMs - cue.startMs) / 1000;
      this.startCuePlayback(cue, offsetSec);
    }
  }

  /** همگام‌سازی خودکار پخش دیالوگ‌ها با `elapsedMs` ساعت کات‌سین */
  syncToElapsedMs(elapsedMs: number): void {
    if (!Number.isFinite(elapsedMs) || this.disposed) return;

    const prev = this.lastElapsedMs;
    const jumpedBackward = prev !== null && elapsedMs < prev - 250;
    const jumpedForward = prev !== null && elapsedMs - prev > 900;
    const firstSync = prev === null;

    if (jumpedBackward) {
      this.firedCueIds.clear();
      this.stopActiveVoice();
    } else if (jumpedForward) {
      this.stopActiveVoice();
    }

    this.lastElapsedMs = elapsedMs;
    if (!this.ctx || !this.outputBus) return;

    const currentCue = this.cues.find(
      (cue) => elapsedMs >= cue.startMs && elapsedMs < cue.endMs,
    );
    if (!currentCue) return;

    // در جریان عادی فریم‌به‌فریم، هر جمله دقیقاً یک‌بار از ابتدا پخش می‌شود
    if (!firstSync && !jumpedBackward && !jumpedForward) {
      if (this.firedCueIds.has(currentCue.id)) return;
      this.firedCueIds.add(currentCue.id);
      const offsetSec = Math.max(0, (elapsedMs - currentCue.startMs) / 1000);
      this.triggerCue(currentCue, offsetSec < 0.18 ? 0 : offsetSec);
      return;
    }

    // ورود میانه کات‌سین، باز شدن دیرهنگام صدا، یا اسکراب نوار زمان Preview
    this.firedCueIds.add(currentCue.id);
    const rawSeekSec = Math.max(0, (elapsedMs - currentCue.startMs) / 1000);
    this.triggerCue(currentCue, rawSeekSec < 0.18 ? 0 : rawSeekSec);
  }

  /** پخش مستقیم یک دیالوگ از ثانیه صفر (مخصوص پنل تست شخصیت‌ها در Preview) */
  async playCueFromStart(cueId: string): Promise<boolean> {
    if (!this.ctx || !this.outputBus || this.disposed) return false;
    const cue = this.cues.find((item) => item.id === cueId);
    if (!cue) return false;
    const buffer = await this.ensureBuffer(cue.id);
    if (!buffer || this.disposed) return false;
    return this.startCuePlayback(cue, 0);
  }

  private triggerCue(cue: StoryDialogueCue, offsetSec: number): void {
    const buffer = this.buffers.get(cue.id);
    if (buffer) {
      this.startCuePlayback(cue, offsetSec);
      return;
    }
    void this.ensureBuffer(cue.id);
  }

  private startCuePlayback(cue: StoryDialogueCue, timelineOffsetSec: number): boolean {
    const ctx = this.ctx;
    const output = this.outputBus;
    const buffer = this.buffers.get(cue.id);
    if (!ctx || !output || !buffer || this.disposed) return false;

    const profile = CHARACTER_VOICE_PROFILES[cue.speaker];
    const bufferOffset = Math.max(0, timelineOffsetSec * profile.playbackRate);
    // اگر کمتر از ۱۲۰ میلی‌ثانیه از فایل صوتی باقی مانده، از پخش تکه بریده خودداری کن
    if (bufferOffset >= buffer.duration - 0.12) return false;

    this.stopActiveVoice();

    const token = ++this.playbackToken;
    const now = ctx.currentTime;

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.linearRampToValueAtTime(profile.gain, now + 0.035);

    const eq = ctx.createBiquadFilter();
    eq.type = profile.filterType;
    eq.frequency.value = profile.filterFreqHz;
    eq.Q.value = profile.filterQ;
    eq.gain.value = profile.filterGainDb;

    const mainPan = ctx.createStereoPanner();
    // همهمهٔ تالار در پایان کات‌سین از سمت راست و در میانه از سمت چپ متمایل می‌شود
    mainPan.pan.value =
      cue.speaker === 'همهمهٔ تالار'
        ? cue.id === 'shadow-warning'
          ? -0.45
          : 0.45
        : profile.basePan;

    const mainSource = ctx.createBufferSource();
    mainSource.buffer = buffer;
    mainSource.playbackRate.value = profile.playbackRate;

    mainSource.connect(eq);
    eq.connect(envelope);
    envelope.connect(mainPan);
    mainPan.connect(output);

    const sources: AudioBufferSourceNode[] = [mainSource];

    // بازتاب کوتاه و تاریک تالار پشت صدای زمزمه مرد سیاه‌پوش («پس گوش کن.»)
    if (cue.speaker === 'مرد سیاه‌پوش' && cue.delivery === 'whisper') {
      const shadowDelay = ctx.createDelay(0.5);
      shadowDelay.delayTime.value = 0.165;
      const shadowFilter = ctx.createBiquadFilter();
      shadowFilter.type = 'lowpass';
      shadowFilter.frequency.value = 900;
      const shadowGain = ctx.createGain();
      shadowGain.gain.value = 0.3;
      const shadowPan = ctx.createStereoPanner();
      shadowPan.pan.value = 0.38;

      envelope.connect(shadowDelay);
      shadowDelay.connect(shadowFilter);
      shadowFilter.connect(shadowGain);
      shadowGain.connect(shadowPan);
      shadowPan.connect(output);
    }

    mainSource.onended = () => {
      if (this.active?.token === token) {
        this.active = null;
        this.onDuckChange?.(1);
      }
    };

    this.active = { cueId: cue.id, token, sources, envelope };
    this.onDuckChange?.(profile.duckLevel);
    mainSource.start(now + 0.005, bufferOffset);

    // لایه هم‌سرایی شبح‌وار برای «همهمهٔ تالار» (دو زمزمه با تأخیر کوتاه در چپ و راست تالار)
    if (profile.chorusVoices === 2) {
      const layers: Array<{ delaySec: number; pan: number; rateMul: number; gain: number }> = [
        { delaySec: 0.042, pan: -0.82, rateMul: 0.97, gain: 0.34 },
        { delaySec: 0.086, pan: 0.82, rateMul: 1.03, gain: 0.28 },
      ];
      for (const layer of layers) {
        const ghostSource = ctx.createBufferSource();
        ghostSource.buffer = buffer;
        ghostSource.playbackRate.value = profile.playbackRate * layer.rateMul;

        const ghostFilter = ctx.createBiquadFilter();
        ghostFilter.type = 'highpass';
        ghostFilter.frequency.value = 460;

        const ghostGain = ctx.createGain();
        ghostGain.gain.value = layer.gain;

        const ghostPan = ctx.createStereoPanner();
        ghostPan.pan.value = layer.pan;

        ghostSource.connect(ghostFilter);
        ghostFilter.connect(ghostGain);
        ghostGain.connect(ghostPan);
        ghostPan.connect(envelope);
        ghostSource.start(now + layer.delaySec, bufferOffset);
        sources.push(ghostSource);
      }
    }

    return true;
  }

  /** توقف فوری دیالوگ در حال پخش با محو کوتاه ۲۰ میلی‌ثانیه‌ای بدون تقه صوتی */
  stopActiveVoice(): void {
    const current = this.active;
    if (!current) return;
    this.active = null;

    const ctx = this.ctx;
    if (ctx) {
      try {
        current.envelope.gain.cancelScheduledValues(ctx.currentTime);
        current.envelope.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.015);
      } catch {
        /* کانتکست بسته شده است */
      }
    }
    const stopAt = ctx ? ctx.currentTime + 0.05 : 0;
    for (const source of current.sources) {
      source.onended = null;
      try {
        source.stop(stopAt);
      } catch {
        /* قبلاً متوقف شده است */
      }
    }
    this.onDuckChange?.(1);
  }

  reset(): void {
    this.stopActiveVoice();
    this.firedCueIds.clear();
    this.lastElapsedMs = null;
  }

  dispose(): void {
    this.disposed = true;
    this.reset();
    this.buffers.clear();
    this.inflight.clear();
    this.ctx = null;
    this.outputBus = null;
  }
}
