/**
 * theater-audio-engine.ts — موتور صدای فضایی رویه‌ای «تماشاخانه اُرفه‌ئو» (Procedural Web Audio Engine)
 * --------------------------------------------------------------------------------------------------------
 * مالک: علیرضا (Alireza) — موج ۱ — منبع: TASKS-ALIREZA.md §۳ (موج ۱) + ARCHITECTURE.md §۱ و §۳.۳
 *
 * تمام صداها به‌صورت زنده با Web Audio API تولید می‌شوند (بدون حتی یک فایل صوتی خارجی):
 *   قطعه ۱ | موسیقی کلاسیک ملایم ایتالیایی (آرپژ پیانو + پد زهی گرم)
 *   قطعه ۲ | آواز سوپرانوی کلاسیک زن روی صحنه (با ویبراتو)
 *   افکت ۳ | دست زدن آرام، سنگین و اکودار مرد سیاه‌پوش پایین سِن
 *   افکت ۴ | پس زدن دست + دیستورت موسیقی به زهی جیغ‌مانند و بیس لرزان
 *   افکت ۵ | موج شوک عقب راندن پلیرها روی صندلی‌ها
 *   افکت ۶ | کوبیده شدن به در / دیوار چپ / دیوار راست / زمین / سقف + شکستن لوستر کریستال
 *   قطعه ۷ | آهنگ ترسناک ماندگار در تاریکی (درونِ بم + ویولنسل وهم‌آلود) — ادامه‌دار تا فاز in_theater
 *
 * صدای فضایی: کل خروجی صحنه از یک StereoPannerNode مرکزی («پن سر بازیکن») عبور می‌کند؛
 * با چرخاندن سر (usePovHeadPan)، جهت استریوی صدای سِن نسبت به گوش بازیکن جابه‌جا می‌شود:
 * سر به راست (yaw>0) ⇒ صدای سِن روبه‌رو به سمت گوش چپ می‌رود (pan منفی).
 *
 * همگام‌سازی با کات‌سین: متد applyBeat() / syncToElapsedMs() روی تایمینگ منجمد قرارداد
 * (src/contracts/types.ts — CutsceneBeatId) سوار است تا در موج ۲، کامپوننت
 * FirstPersonCutsceneStage فقط «زمان سپری‌شده سرور» را بدهد و صدا خودش هم‌فاز شود.
 *
 * قانون مرورگرها: AudioContext فقط پس از تعامل کاربر ساخته/بیدار می‌شود؛
 * پس init() باید از دل یک ژست کاربر صدا زده شود (در بازی واقعی: کلیک پانچ بلیط/باز کردن قفل در).
 * تا قبل از init() همه متدها بی‌صدا و امن (no-op) هستند و در محیط SSR/تست Node هیچ خطایی نمی‌دهند.
 */

import {
  TOTAL_CUTSCENE_DURATION_MS,
  type CutsceneBeatId,
} from '../contracts/types';

/* =====================================================================================
 * بخش خالص (Pure) — بدون وابستگی به AudioContext؛ قابل تست واحد در Node
 * ===================================================================================== */

/** بازه زمانی هر بیت کات‌سین روی تایملاین ۷۴ ثانیه‌ای قرارداد (API-CONTRACT.md) */
export interface CutsceneBeatWindow {
  beat: CutsceneBeatId;
  /** شروع بیت (میلی‌ثانیه از آغاز کات‌سین در) */
  startMs: number;
  /** پایان بیت (میلی‌ثانیه) — بازه هر بیت [startMs, endMs) است */
  endMs: number;
  /** عنوان فارسی برای HUD و پنل‌های Preview */
  labelFa: string;
}

export const CUTSCENE_BEAT_WINDOWS: readonly CutsceneBeatWindow[] = [
  { beat: 'door_usher_collects_tickets',   startMs: 0,      endMs: 11_000, labelFa: 'تحویل بلیط به دربان دم در و باز شدن در' },
  { beat: 'enter_20_seat_tiered_salon',    startMs: 11_000, endMs: 21_000, labelFa: 'ورود به سالن ۲۰ نفره و نشستن پلیرها' },
  { beat: 'classical_music_curtain_dance', startMs: 21_000, endMs: 31_000, labelFa: 'موسیقی کلاسیک، باز شدن پرده و رقص بانوی ایتالیایی' },
  { beat: 'tall_dark_man_left_shadow',     startMs: 31_000, endMs: 40_000, labelFa: 'مرد سیاه‌پوش بلندقد در سایه سمت چپ صحنه' },
  { beat: 'man_walks_claps_extends_hand',  startMs: 40_000, endMs: 46_000, labelFa: 'نزدیک شدن مرد، دست زدن و دراز کردن دست' },
  { beat: 'woman_sings_rejects_hand',      startMs: 46_000, endMs: 50_000, labelFa: 'آواز زن و پس زدن دست مرد' },
  { beat: 'red_filthy_inversion_terror',   startMs: 50_000, endMs: 53_000, labelFa: 'واژگونی: نور قرمز، صحنه کثیف و ترس زن' },
  { beat: 'man_glares_pushes_players',     startMs: 53_000, endMs: 56_000, labelFa: 'نگاه مرد به پلیرها و عقب راندن همه روی صندلی' },
  { beat: 'choke_slams_shake_chandelier',  startMs: 56_000, endMs: 67_000, labelFa: 'گرفتن گلو از دور، کوبیدن، لرزش سالن و سقوط لوستر' },
  { beat: 'vanish_dark_music_remains',     startMs: 67_000, endMs: TOTAL_CUTSCENE_DURATION_MS, labelFa: 'غیب شدن هر دو — ماندن تاریکی و آهنگ ترسناک' },
] as const;

/**
 * تبدیل زمان سپری‌شده کات‌سین (میلی‌ثانیه، بر مبنای ساعت سرور توحید) به بیت جاری.
 * مقادیر خارج از بازه به اولین/آخرین بیت کلمپ می‌شوند تا Refresh وسط کات‌سین همیشه امن باشد.
 */
export function beatFromElapsedMs(elapsedMs: number): CutsceneBeatId {
  const clamped = Number.isFinite(elapsedMs)
    ? Math.min(Math.max(elapsedMs, 0), TOTAL_CUTSCENE_DURATION_MS - 1)
    : 0;
  const window = CUTSCENE_BEAT_WINDOWS.find(
    (w) => clamped >= w.startMs && clamped < w.endMs,
  );
  // آخرین بیت به‌عنوان Fallback (پوشش لبه انتهایی تایملاین)
  return (window ?? CUTSCENE_BEAT_WINDOWS[CUTSCENE_BEAT_WINDOWS.length - 1]).beat;
}

/** حداکثر زاویه چرخش سر — هم‌مقدار با POV_YAW_MAX_DEG در usePovHeadPan (بدون وابستگی به React) */
export const AUDIO_HEAD_YAW_MAX_DEG = 42;
/** حداکثر پن استریو برای صدای روبه‌رو هنگام چرخش کامل سر */
export const AUDIO_HEAD_PAN_MAX = 0.85;

/**
 * تبدیل زاویه سر بازیکن به پن استریوی صدای صحنه.
 * سر به راست (yaw مثبت) ⇒ سِن روبه‌رو نسبت به سر در سمت چپ قرار می‌گیرد ⇒ pan منفی.
 */
export function yawToStereoPan(yawDeg: number): number {
  if (!Number.isFinite(yawDeg)) return 0;
  const clamped = Math.min(
    AUDIO_HEAD_YAW_MAX_DEG,
    Math.max(-AUDIO_HEAD_YAW_MAX_DEG, yawDeg),
  );
  const pan = -(clamped / AUDIO_HEAD_YAW_MAX_DEG) * AUDIO_HEAD_PAN_MAX;
  return pan === 0 ? 0 : pan; // نرمال‌سازی -0 به 0 (مرکز دقیق استریو)
}

/** سطوحی که زن در اوج وحشت به آن‌ها کوبیده می‌شود (PROJECT.md گام ۵) */
export type SlamSurface = 'door' | 'left-wall' | 'right-wall' | 'floor' | 'ceiling';

/** پن استریوی پایه هر سطح نسبت به بازیکن نشسته (قبل از اعمال پن چرخش سر) */
export const SLAM_SURFACE_PAN: Readonly<Record<SlamSurface, number>> = {
  door: 0,          // درِ صحنه — روبه‌رو
  'left-wall': -0.9,
  'right-wall': 0.9,
  floor: 0,         // زمین — زیر پا (بم‌ترین ضربه)
  ceiling: 0,       // سقف — بالای سر (همراه ریزش خرده‌ریز)
};

/** وضعیت موسیقایی جاری موتور صدا */
export type TheaterMusicState =
  | 'silent'             // قبل از شروع نمایش (بیت‌های در و ورود)
  | 'classical'          // قطعه ۱: کلاسیک ملایم ایتالیایی
  | 'classical_soprano'  // قطعه ۱ + ۲: کلاسیک همراه آواز سوپرانو
  | 'distorted'          // افکت ۴: لحظه واژگونی (جیغ زهی + بیس لرزان)
  | 'horror';            // قطعه ۷: درون ترسناک ماندگار در تاریکی

/* =====================================================================================
 * داده‌های آهنگسازی رویه‌ای (۱۰۰٪ اورجینال — ساخته‌شده برای همین بازی)
 * ===================================================================================== */

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// قطعه ۱ — پیش‌روی آکوردی کلاسیک ملایم در گام ر ماژور: I – V – vi – IV  (هر آکورد = یک میزان)
const CLASSICAL_CHORDS_MIDI: readonly (readonly number[])[] = [
  [50, 54, 57, 62], // D   (ر، فا#، لا، ر)
  [45, 52, 57, 61], // A   (لا، می، لا، دو#)
  [47, 50, 54, 59], // Bm  (سی، ر، فا#، سی)
  [43, 50, 55, 59], // G   (سل، ر، سل، سی)
];
const CLASSICAL_EIGHTH_SEC = 0.44;             // طول یک نت چنگ
const CLASSICAL_STEPS_PER_CHORD = 8;           // ۸ چنگ در هر میزان
const CLASSICAL_ARP_PATTERN = [0, 1, 2, 3, 2, 1, 2, 3] as const; // الگوی آرپژ پیانو

// قطعه ۲ — خط ملودی سوپرانو (اورجینال): [نت میدی، مدت ثانیه] — 0 یعنی سکوت
const SOPRANO_PHRASE: readonly (readonly [number, number])[] = [
  [69, 0.9], [71, 0.9], [73, 1.3], [74, 1.8],
  [78, 1.3], [76, 0.9], [74, 0.9], [73, 1.3],
  [71, 0.9], [69, 1.8], [0, 1.2],
];

// قطعه ۷ — موتیف ویولنسل وهم‌آلود (نیم‌پرده‌های ناآرام در رژیستر بم)
const HORROR_CELLO_MOTIF_MIDI = [48, 49, 48, 43, 46, 41, 48, 36] as const;

/* =====================================================================================
 * موتور صدا
 * ===================================================================================== */

export interface TheaterAudioEngineOptions {
  /** حجم صدای اصلی در بازه [0, 1] — پیش‌فرض 0.8 */
  masterVolume?: number;
}

interface LoopScheduler {
  timer: ReturnType<typeof setInterval> | null;
  nextTime: number;
  step: number;
}

export class TheaterAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private headPanner: StereoPannerNode | null = null;
  private musicBus: GainNode | null = null;
  private sopranoBus: GainNode | null = null;
  private horrorBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private readonly masterVolume: number;
  private muted = false;
  private headYawDeg = 0;

  private classical: LoopScheduler = { timer: null, nextTime: 0, step: 0 };
  private soprano: LoopScheduler = { timer: null, nextTime: 0, step: 0 };
  private horror: LoopScheduler = { timer: null, nextTime: 0, step: 0 };
  private horrorDroneNodes: OscillatorNode[] = [];
  private rumbleNodes: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  private currentBeat: CutsceneBeatId | null = null;
  private musicStateValue: TheaterMusicState = 'silent';
  private inversionTriggered = false;

  constructor(options: TheaterAudioEngineOptions = {}) {
    this.masterVolume = Math.min(1, Math.max(0, options.masterVolume ?? 0.8));
  }

  /* ------------------------------- چرخه حیات ------------------------------- */

  get isInitialized(): boolean {
    return this.ctx !== null;
  }

  get musicState(): TheaterMusicState {
    return this.musicStateValue;
  }

  get beat(): CutsceneBeatId | null {
    return this.currentBeat;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /**
   * ساخت/بیدار کردن AudioContext و گراف صوتی.
   * ⚠️ باید از دل ژست کاربر (کلیک/لمس) صدا زده شود. در محیط بدون مرورگر false برمی‌گرداند.
   */
  async init(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextCtor) return false;
      this.ctx = new AudioContextCtor();
      this.buildGraph();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return true;
  }

  /** توقف کامل همه صداها و بستن کانتکست (خروج از اتاق بازی) */
  async dispose(): Promise<void> {
    this.stopAll();
    if (this.ctx) {
      await this.ctx.close().catch(() => undefined);
      this.ctx = null;
      this.masterGain = null;
      this.headPanner = null;
      this.musicBus = null;
      this.sopranoBus = null;
      this.horrorBus = null;
      this.sfxBus = null;
      this.noiseBuffer = null;
      this.currentBeat = null;
      this.musicStateValue = 'silent';
    }
  }

  private buildGraph(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    // خروجی نهایی: مستر ← کمپرسور (ضد کلیپینگ) ← اسپیکر
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 6;
    compressor.connect(ctx.destination);

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    this.masterGain.connect(compressor);

    // پن مرکزی «سر بازیکن» — همه صدای صحنه از اینجا رد می‌شود
    this.headPanner = ctx.createStereoPanner();
    this.headPanner.pan.value = yawToStereoPan(this.headYawDeg);
    this.headPanner.connect(this.masterGain);

    // ریورب سالن تماشاخانه (Impulse Response مصنوعی) — مسیر Wet موازی
    const reverb = ctx.createConvolver();
    reverb.buffer = this.createImpulseResponse(2.8, 2.2);
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.32;
    this.headPanner.connect(wetGain);
    wetGain.connect(reverb);
    reverb.connect(this.masterGain);

    // باس‌های مجزا برای کنترل مستقل هر لایه
    const makeBus = (initialGain: number): GainNode => {
      const bus = ctx.createGain();
      bus.gain.value = initialGain;
      bus.connect(this.headPanner as StereoPannerNode);
      return bus;
    };
    this.musicBus = makeBus(0);
    this.sopranoBus = makeBus(0);
    this.horrorBus = makeBus(0);
    this.sfxBus = makeBus(1);
  }

  private createImpulseResponse(durationSec: number, decay: number): AudioBuffer {
    const ctx = this.ctx as AudioContext;
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const buffer = ctx.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  private getNoiseBuffer(): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    if (!this.noiseBuffer) {
      const length = ctx.sampleRate * 2;
      this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer;
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private ready(): boolean {
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return true;
  }

  private rampGain(param: AudioParam, value: number, durationSec: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    param.setTargetAtTime(value, ctx.currentTime, Math.max(0.02, durationSec / 3));
  }

  /* ------------------------- کنترل عمومی: صدا و سر ------------------------- */

  /** بی‌صدا/باصدا کردن کل موتور (متصل به onToggleMute کامپوننت‌های علیرضا) */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.rampGain(this.masterGain.gain, muted ? 0 : this.masterVolume, 0.25);
    }
  }

  /**
   * اتصال چرخش سر بازیکن به جهت استریوی صدای صحنه.
   * مصرف: usePovHeadPan({ onYawChange: (yaw) => engine.setHeadYaw(yaw) })
   */
  setHeadYaw(yawDeg: number): void {
    this.headYawDeg = yawDeg;
    if (this.headPanner && this.ctx) {
      this.headPanner.pan.setTargetAtTime(
        yawToStereoPan(yawDeg),
        this.ctx.currentTime,
        0.08,
      );
    }
  }

  /** ساخت یک پن نسبی برای منبع صدای خاص صحنه (مثلاً مرد در سمت چپ) روی باس افکت */
  private panToSfx(pan: number): AudioNode | null {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return null;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.min(1, Math.max(-1, pan));
    panner.connect(this.sfxBus);
    return panner;
  }

  /* =======================================================================
   * قطعه ۱ — موسیقی کلاسیک ملایم ایتالیایی (آرپژ پیانو + پد زهی گرم)
   * ======================================================================= */

  startClassical(): void {
    if (!this.ready() || !this.musicBus || this.classical.timer) return;
    this.inversionTriggered = false;
    this.rampGain(this.musicBus.gain, 0.9, 1.6);
    this.classical.nextTime = this.now() + 0.12;
    this.classical.step = 0;
    this.classical.timer = setInterval(() => this.scheduleClassical(), 180);
    if (!this.soprano.timer) this.musicStateValue = 'classical';
    this.scheduleClassical();
  }

  stopClassical(fadeSec = 1.2): void {
    if (this.musicBus) this.rampGain(this.musicBus.gain, 0, fadeSec);
    if (this.classical.timer) {
      clearInterval(this.classical.timer);
      this.classical.timer = null;
    }
    if (this.musicStateValue === 'classical' || this.musicStateValue === 'classical_soprano') {
      this.musicStateValue = this.soprano.timer ? 'classical_soprano' : 'silent';
    }
  }

  private scheduleClassical(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.classical.nextTime < ctx.currentTime + 0.55) {
      this.scheduleClassicalStep(this.classical.step, this.classical.nextTime);
      this.classical.nextTime += CLASSICAL_EIGHTH_SEC;
      this.classical.step += 1;
    }
  }

  private scheduleClassicalStep(step: number, time: number): void {
    const chordIndex =
      Math.floor(step / CLASSICAL_STEPS_PER_CHORD) % CLASSICAL_CHORDS_MIDI.length;
    const chord = CLASSICAL_CHORDS_MIDI[chordIndex];
    const stepInChord = step % CLASSICAL_STEPS_PER_CHORD;

    // پد زهی گرم در ابتدای هر میزان
    if (stepInChord === 0) {
      const barDuration = CLASSICAL_EIGHTH_SEC * CLASSICAL_STEPS_PER_CHORD;
      chord.forEach((midi) => this.playStringPad(midiToFreq(midi), time, barDuration));
    }
    // آرپژ پیانو در هر چنگ (یک اکتاو بالاتر از پد)
    const arpMidi = chord[CLASSICAL_ARP_PATTERN[stepInChord]] + 12;
    this.playPianoNote(midiToFreq(arpMidi), time);
  }

  private playPianoNote(freq: number, time: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.16, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.25);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2600;
    gain.connect(filter);
    filter.connect(this.musicBus);

    const fundamental = ctx.createOscillator();
    fundamental.type = 'triangle';
    fundamental.frequency.value = freq;
    const harmonic = ctx.createOscillator();
    harmonic.type = 'sine';
    harmonic.frequency.value = freq * 2;
    const harmonicGain = ctx.createGain();
    harmonicGain.gain.value = 0.35;
    fundamental.connect(gain);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(gain);
    fundamental.start(time);
    harmonic.start(time);
    fundamental.stop(time + 1.3);
    harmonic.stop(time + 1.3);
  }

  private playStringPad(freq: number, time: number, durationSec: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.045, time + durationSec * 0.35);
    gain.gain.setValueAtTime(0.045, time + durationSec * 0.7);
    gain.gain.linearRampToValueAtTime(0, time + durationSec + 0.25);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 950;
    gain.connect(filter);
    filter.connect(this.musicBus);

    [-5, 5].forEach((detuneCents) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detuneCents;
      osc.connect(gain);
      osc.start(time);
      osc.stop(time + durationSec + 0.3);
    });
  }

  /* =======================================================================
   * قطعه ۲ — آواز سوپرانوی زن روی صحنه
   * ======================================================================= */

  startSoprano(): void {
    if (!this.ready() || !this.sopranoBus || this.soprano.timer) return;
    this.rampGain(this.sopranoBus.gain, 0.85, 0.8);
    this.soprano.nextTime = this.now() + 0.15;
    this.soprano.step = 0;
    this.soprano.timer = setInterval(() => this.scheduleSoprano(), 220);
    if (this.classical.timer) this.musicStateValue = 'classical_soprano';
    this.scheduleSoprano();
  }

  stopSoprano(fadeSec = 0.6): void {
    if (this.sopranoBus) this.rampGain(this.sopranoBus.gain, 0, fadeSec);
    if (this.soprano.timer) {
      clearInterval(this.soprano.timer);
      this.soprano.timer = null;
    }
    if (this.musicStateValue === 'classical_soprano') {
      this.musicStateValue = this.classical.timer ? 'classical' : 'silent';
    }
  }

  private scheduleSoprano(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.soprano.nextTime < ctx.currentTime + 0.7) {
      const [midi, durationSec] =
        SOPRANO_PHRASE[this.soprano.step % SOPRANO_PHRASE.length];
      if (midi > 0) {
        this.playSopranoNote(midiToFreq(midi), this.soprano.nextTime, durationSec);
      }
      this.soprano.nextTime += durationSec;
      this.soprano.step += 1;
    }
  }

  private playSopranoNote(freq: number, time: number, durationSec: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sopranoBus) return;
    const gain = ctx.createGain();
    const attack = Math.min(0.18, durationSec * 0.3);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.13, time + attack);
    gain.gain.setValueAtTime(0.13, time + Math.max(attack, durationSec - 0.22));
    gain.gain.linearRampToValueAtTime(0, time + durationSec);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3200;
    gain.connect(filter);
    filter.connect(this.sopranoBus);

    const voice = ctx.createOscillator();
    voice.type = 'sine';
    voice.frequency.value = freq;
    // ویبراتوی آواز اپرایی (۵.۵ هرتز — عمق ±۷ سنت، با تأخیر شروع)
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5.5;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.setValueAtTime(0, time);
    vibratoDepth.gain.linearRampToValueAtTime(7, time + Math.min(0.6, durationSec));
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(voice.detune);
    voice.connect(gain);

    const breath = ctx.createOscillator();
    breath.type = 'triangle';
    breath.frequency.value = freq * 2;
    const breathGain = ctx.createGain();
    breathGain.gain.value = 0.18;
    breath.connect(breathGain);
    breathGain.connect(gain);

    voice.start(time);
    vibrato.start(time);
    breath.start(time);
    voice.stop(time + durationSec + 0.05);
    vibrato.stop(time + durationSec + 0.05);
    breath.stop(time + durationSec + 0.05);
  }

  /* =======================================================================
   * افکت ۳ — دست زدن آرام و اکودار مرد سیاه‌پوش
   * ======================================================================= */

  /** @param count تعداد دست زدن‌ها @param intervalSec فاصله آرام و سنگین بین هر دست */
  playSlowClaps(count = 4, intervalSec = 0.9): void {
    if (!this.ready()) return;
    const start = this.now() + 0.05;
    for (let i = 0; i < count; i++) {
      this.playSingleClap(start + i * intervalSec);
    }
  }

  private playSingleClap(time: number): void {
    const ctx = this.ctx;
    const noise = this.getNoiseBuffer();
    const destination = this.panToSfx(-0.35); // مرد پایین سن، متمایل به چپ صحنه
    if (!ctx || !noise || !destination) return;

    // اکوی سالن برای حس سنگینی و تعلیق
    const echo = ctx.createDelay(1);
    echo.delayTime.value = 0.27;
    const echoFeedback = ctx.createGain();
    echoFeedback.gain.value = 0.32;
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.45;
    echo.connect(echoFeedback);
    echoFeedback.connect(echo);
    echo.connect(echoOut);
    echoOut.connect(destination);

    // هر «دست» از سه ضربه مینیاتوری نزدیک به هم ساخته می‌شود
    [0, 0.014, 0.032].forEach((offset, index) => {
      const source = ctx.createBufferSource();
      source.buffer = noise;
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1700 - index * 180;
      bandpass.Q.value = 1.1;
      const gain = ctx.createGain();
      const peak = 0.5 - index * 0.13;
      gain.gain.setValueAtTime(peak, time + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, time + offset + 0.09);
      source.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(destination);
      gain.connect(echo);
      source.start(time + offset);
      source.stop(time + offset + 0.12);
    });
  }

  /* =======================================================================
   * افکت ۴ — پس زدن دست + دیستورت به جیغ زهی و بیس لرزان (لحظه واژگونی)
   * ======================================================================= */

  /**
   * لحظه دقیق پس زدن دست مرد توسط زن (پایان بیت woman_sings_rejects_hand).
   * کامپوننت تصویری موج ۳ این متد را در فریم دقیق انیمیشن پس زدن دست صدا می‌زند؛
   * اگر صدا زده نشود، applyBeat بیت بعدی (red_filthy_inversion_terror) خودش آن را اجرا می‌کند.
   */
  playHandRejection(): void {
    if (!this.ready()) return;
    const time = this.now() + 0.03;
    this.playSlap(time);
    this.triggerInversionDistortion();
  }

  private playSlap(time: number): void {
    const ctx = this.ctx;
    const noise = this.getNoiseBuffer();
    const destination = this.panToSfx(-0.15);
    if (!ctx || !noise || !destination) return;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 750;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.65, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    source.connect(highpass);
    highpass.connect(gain);
    gain.connect(destination);
    source.start(time);
    source.stop(time + 0.2);

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(190, time);
    thump.frequency.exponentialRampToValueAtTime(65, time + 0.18);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.35, time);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    thump.connect(thumpGain);
    thumpGain.connect(destination);
    thump.start(time);
    thump.stop(time + 0.22);
  }

  /** قطع ناگهانی موسیقی شاد و انفجار صوتی واژگونی (فقط یک‌بار در هر چرخه اجرا) */
  private triggerInversionDistortion(): void {
    if (this.inversionTriggered) return;
    this.inversionTriggered = true;
    this.stopSoprano(0.12);
    this.stopClassical(0.25);
    this.playScreechStrings(2.8);
    this.playTremblingBass(4.5);
    this.musicStateValue = 'distorted';
  }

  /** زهی جیغ‌مانند: خوشه نت‌های زیر با گلیساندوی نزولی نیم‌پرده‌ای */
  playScreechStrings(durationSec = 2.5): void {
    const ctx = this.ctx;
    const destination = this.panToSfx(0);
    if (!this.ready() || !ctx || !destination) return;
    const time = this.now() + 0.05;
    [88, 91, 93, 95, 96].forEach((midi, index) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(midiToFreq(midi), time);
      osc.frequency.exponentialRampToValueAtTime(
        midiToFreq(midi - 1),
        time + durationSec,
      );
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 2800 + index * 350;
      bandpass.Q.value = 2.4;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.055, time + 0.35);
      gain.gain.setValueAtTime(0.055, time + durationSec - 0.5);
      gain.gain.linearRampToValueAtTime(0, time + durationSec);
      osc.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(destination);
      osc.start(time);
      osc.stop(time + durationSec + 0.05);
    });
  }

  /** بیس لرزان زیر واژگونی: دو موج بم نزدیک به هم (پدیده ضربان) + ترمولو */
  playTremblingBass(durationSec = 4): void {
    const ctx = this.ctx;
    const destination = this.panToSfx(0);
    if (!this.ready() || !ctx || !destination) return;
    const time = this.now() + 0.05;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.4);
    gain.gain.setValueAtTime(0.3, time + durationSec - 0.6);
    gain.gain.linearRampToValueAtTime(0, time + durationSec);
    const tremolo = ctx.createOscillator();
    tremolo.frequency.value = 8.5;
    const tremoloDepth = ctx.createGain();
    tremoloDepth.gain.value = 0.11;
    tremolo.connect(tremoloDepth);
    tremoloDepth.connect(gain.gain);
    gain.connect(destination);
    [41.2, 43.65].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(time);
      osc.stop(time + durationSec + 0.05);
    });
    tremolo.start(time);
    tremolo.stop(time + durationSec + 0.05);
  }

  /* =======================================================================
   * افکت ۵ — موج شوک عقب راندن پلیرها روی صندلی
   * ======================================================================= */

  playSeatShockwave(): void {
    const ctx = this.ctx;
    const noise = this.getNoiseBuffer();
    const destination = this.panToSfx(0);
    if (!this.ready() || !ctx || !noise || !destination) return;
    const time = this.now() + 0.03;

    // فرود بم سینوسی (ضربه به قفسه سینه پلیرها!)
    const drop = ctx.createOscillator();
    drop.type = 'sine';
    drop.frequency.setValueAtTime(115, time);
    drop.frequency.exponentialRampToValueAtTime(27, time + 0.75);
    const dropGain = ctx.createGain();
    dropGain.gain.setValueAtTime(0.85, time);
    dropGain.gain.exponentialRampToValueAtTime(0.001, time + 0.85);
    drop.connect(dropGain);
    dropGain.connect(destination);
    drop.start(time);
    drop.stop(time + 0.9);

    // وزش هوای موج شوک
    const whoosh = ctx.createBufferSource();
    whoosh.buffer = noise;
    whoosh.loop = true;
    const sweep = ctx.createBiquadFilter();
    sweep.type = 'lowpass';
    sweep.frequency.setValueAtTime(3200, time);
    sweep.frequency.exponentialRampToValueAtTime(160, time + 0.7);
    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0, time);
    whooshGain.gain.linearRampToValueAtTime(0.5, time + 0.09);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, time + 0.75);
    whoosh.connect(sweep);
    sweep.connect(whooshGain);
    whooshGain.connect(destination);
    whoosh.start(time);
    whoosh.stop(time + 0.8);

    // جیرجیر کوتاه صندلی چوبی زیر فشار عقب‌نشینی
    const creak = ctx.createOscillator();
    creak.type = 'sawtooth';
    creak.frequency.setValueAtTime(88, time + 0.06);
    creak.frequency.linearRampToValueAtTime(64, time + 0.4);
    const creakFilter = ctx.createBiquadFilter();
    creakFilter.type = 'bandpass';
    creakFilter.frequency.value = 420;
    creakFilter.Q.value = 5;
    const creakGain = ctx.createGain();
    creakGain.gain.setValueAtTime(0, time + 0.06);
    creakGain.gain.linearRampToValueAtTime(0.09, time + 0.16);
    creakGain.gain.linearRampToValueAtTime(0, time + 0.42);
    creak.connect(creakFilter);
    creakFilter.connect(creakGain);
    creakGain.connect(destination);
    creak.start(time + 0.06);
    creak.stop(time + 0.45);
  }

  /* =======================================================================
   * افکت ۶ — کوبیده شدن به سطوح سالن + غرش لرزش سالن + سقوط لوستر
   * ======================================================================= */

  /** @param delaySec تأخیر زمان‌بندی دقیق نسبت به لحظه فراخوانی (همگام با انیمیشن تصویری موج ۳) */
  playBodySlam(surface: SlamSurface, delaySec = 0): void {
    const ctx = this.ctx;
    const noise = this.getNoiseBuffer();
    const destination = this.panToSfx(SLAM_SURFACE_PAN[surface]);
    if (!this.ready() || !ctx || !noise || !destination) return;
    const time = this.now() + 0.03 + Math.max(0, delaySec);

    const baseFreq =
      surface === 'floor' ? 46 : surface === 'ceiling' ? 82 : surface === 'door' ? 68 : 58;
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(baseFreq * 1.9, time);
    thud.frequency.exponentialRampToValueAtTime(baseFreq * 0.55, time + 0.42);
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.9, time);
    thudGain.gain.exponentialRampToValueAtTime(0.001, time + 0.55);
    thud.connect(thudGain);
    thudGain.connect(destination);
    thud.start(time);
    thud.stop(time + 0.6);

    const crash = ctx.createBufferSource();
    crash.buffer = noise;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = surface === 'ceiling' ? 1400 : 650;
    const crashGain = ctx.createGain();
    crashGain.gain.setValueAtTime(0.55, time);
    crashGain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);
    crash.connect(lowpass);
    lowpass.connect(crashGain);
    crashGain.connect(destination);
    crash.start(time);
    crash.stop(time + 0.42);

    // ریزش خرده‌ریز گچ فقط بعد از برخورد با سقف
    if (surface === 'ceiling') {
      for (let i = 0; i < 7; i++) {
        this.playDebrisTick(time + 0.18 + Math.random() * 0.55);
      }
    }
  }

  private playDebrisTick(time: number): void {
    const ctx = this.ctx;
    const noise = this.getNoiseBuffer();
    const destination = this.panToSfx((Math.random() * 2 - 1) * 0.5);
    if (!ctx || !noise || !destination) return;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 900 + Math.random() * 1600;
    bandpass.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(destination);
    source.start(time);
    source.stop(time + 0.08);
  }

  /**
   * توالی پیش‌فرض کوبش‌ها در بیت choke_slams_shake_chandelier (۱۱ ثانیه):
   * در ← دیوار چپ ← دیوار راست ← زمین ← سقف ← زمین ← سقوط لوستر.
   * در موج ۳ اگر انیمیشن تصویری زمان‌بندی خودش را داشته باشد، به‌جای این متد
   * از playBodySlam(surface, delaySec) به‌صورت تکی استفاده می‌شود.
   */
  playSlamSequence(): void {
    if (!this.ready()) return;
    const sequence: Array<[SlamSurface, number]> = [
      ['door', 0.2],
      ['left-wall', 1.5],
      ['right-wall', 2.8],
      ['floor', 4.1],
      ['ceiling', 5.4],
      ['floor', 6.7],
    ];
    sequence.forEach(([surface, delay]) => this.playBodySlam(surface, delay));
    this.playChandelierFall(8.1);
  }

  /** غرش بم و پیوسته لرزش کل سالن (Screen Shake صوتی) */
  startRoomRumble(): void {
    const ctx = this.ctx;
    const noise = this.getNoiseBuffer();
    const destination = this.panToSfx(0);
    if (!this.ready() || !ctx || !noise || !destination || this.rumbleNodes) return;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 110;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.5, ctx.currentTime, 0.5);
    source.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(destination);
    source.start();
    this.rumbleNodes = { source, gain };
  }

  stopRoomRumble(): void {
    const ctx = this.ctx;
    if (!ctx || !this.rumbleNodes) return;
    const { source, gain } = this.rumbleNodes;
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    setTimeout(() => {
      try {
        source.stop();
      } catch {
        /* قبلاً متوقف شده است */
      }
    }, 900);
    this.rumbleNodes = null;
  }

  /** سقوط و خرد شدن لوستر کریستال وسط سالن — @param delaySec تأخیر زمان‌بندی */
  playChandelierFall(delaySec = 0): void {
    const ctx = this.ctx;
    const noise = this.getNoiseBuffer();
    if (!this.ready() || !ctx || !noise) return;
    const start = this.now() + 0.03 + Math.max(0, delaySec);
    const destination = this.panToSfx(0);
    if (!destination) return;

    // ۱) جیرجیر زنجیر و کنده شدن از سقف
    const creak = ctx.createOscillator();
    creak.type = 'square';
    creak.frequency.setValueAtTime(640, start);
    creak.frequency.exponentialRampToValueAtTime(210, start + 0.35);
    const creakFilter = ctx.createBiquadFilter();
    creakFilter.type = 'bandpass';
    creakFilter.frequency.value = 1500;
    creakFilter.Q.value = 6;
    const creakGain = ctx.createGain();
    creakGain.gain.setValueAtTime(0.07, start);
    creakGain.gain.linearRampToValueAtTime(0, start + 0.38);
    creak.connect(creakFilter);
    creakFilter.connect(creakGain);
    creakGain.connect(destination);
    creak.start(start);
    creak.stop(start + 0.4);

    // ۲) سوت سقوط
    const whistle = ctx.createOscillator();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(2300, start + 0.1);
    whistle.frequency.exponentialRampToValueAtTime(820, start + 0.6);
    const whistleGain = ctx.createGain();
    whistleGain.gain.setValueAtTime(0, start + 0.1);
    whistleGain.gain.linearRampToValueAtTime(0.05, start + 0.35);
    whistleGain.gain.linearRampToValueAtTime(0, start + 0.62);
    whistle.connect(whistleGain);
    whistleGain.connect(destination);
    whistle.start(start + 0.1);
    whistle.stop(start + 0.65);

    // ۳) برخورد با زمین + انفجار کریستال
    const crashTime = start + 0.62;
    const crash = ctx.createBufferSource();
    crash.buffer = noise;
    const crashGain = ctx.createGain();
    crashGain.gain.setValueAtTime(0.85, crashTime);
    crashGain.gain.exponentialRampToValueAtTime(0.001, crashTime + 0.7);
    crash.connect(crashGain);
    crashGain.connect(destination);
    crash.start(crashTime);
    crash.stop(crashTime + 0.75);

    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(120, crashTime);
    thud.frequency.exponentialRampToValueAtTime(38, crashTime + 0.5);
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.8, crashTime);
    thudGain.gain.exponentialRampToValueAtTime(0.001, crashTime + 0.6);
    thud.connect(thudGain);
    thudGain.connect(destination);
    thud.start(crashTime);
    thud.stop(crashTime + 0.65);

    // ۴) باران تکه‌کریستال‌ها (جرنگ‌های زیر تصادفی در فضای استریو)
    for (let i = 0; i < 26; i++) {
      this.playCrystalPing(
        crashTime + Math.random() * 1.7,
        (Math.random() * 2 - 1) * 0.75,
      );
    }
  }

  private playCrystalPing(time: number, pan: number): void {
    const ctx = this.ctx;
    const destination = this.panToSfx(pan);
    if (!ctx || !destination) return;
    const ping = ctx.createOscillator();
    ping.type = 'sine';
    ping.frequency.value = 3100 + Math.random() * 3800;
    const gain = ctx.createGain();
    const peak = 0.05 + Math.random() * 0.1;
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.28 + Math.random() * 0.3);
    ping.connect(gain);
    gain.connect(destination);
    ping.start(time);
    ping.stop(time + 0.65);
  }

  /* =======================================================================
   * قطعه ۷ — آهنگ ترسناک ماندگار: درون بم + ویولنسل وهم‌آلود
   * ======================================================================= */

  /**
   * شروع امبینت ترسناک ماندگار. در بیت vanish_dark_music_remains آغاز می‌شود و
   * در تمام فاز in_theater (صحنه DarkAuditoriumScene موج ۳) بدون وقفه ادامه دارد.
   * @param level شدت در بازه [0,1] — در لحظه واژگونی نیمه، پس از غیب شدن کامل
   */
  startHorrorAmbience(level = 1): void {
    const ctx = this.ctx;
    if (!this.ready() || !ctx || !this.horrorBus) return;
    const clampedLevel = Math.min(1, Math.max(0, level));
    this.rampGain(this.horrorBus.gain, 0.85 * clampedLevel, 2.2);

    if (this.horrorDroneNodes.length === 0) {
      // درون: موج پایه لا۱ + نیم‌پرده ناسازگار (ضربان ناآرام) + ساب زیرپوستی
      const droneGain = ctx.createGain();
      droneGain.gain.value = 0.16;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 320;
      droneGain.connect(lowpass);
      lowpass.connect(this.horrorBus);
      [55, 58.27, 27.5].forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(droneGain);
        osc.start();
        this.horrorDroneNodes.push(osc);
      });
    }
    if (!this.horror.timer) {
      this.horror.nextTime = this.now() + 1.2;
      this.horror.step = 0;
      this.horror.timer = setInterval(() => this.scheduleHorrorCello(), 400);
    }
    this.musicStateValue = 'horror';
  }

  stopHorrorAmbience(fadeSec = 1.5): void {
    if (this.horrorBus) this.rampGain(this.horrorBus.gain, 0, fadeSec);
    if (this.horror.timer) {
      clearInterval(this.horror.timer);
      this.horror.timer = null;
    }
    const nodes = this.horrorDroneNodes;
    this.horrorDroneNodes = [];
    setTimeout(() => {
      nodes.forEach((osc) => {
        try {
          osc.stop();
        } catch {
          /* قبلاً متوقف شده است */
        }
      });
    }, Math.ceil(fadeSec * 1000) + 200);
    if (this.musicStateValue === 'horror') this.musicStateValue = 'silent';
  }

  private scheduleHorrorCello(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.horror.nextTime < ctx.currentTime + 1.2) {
      const midi = HORROR_CELLO_MOTIF_MIDI[this.horror.step % HORROR_CELLO_MOTIF_MIDI.length];
      const duration = 3.4 + (this.horror.step % 3) * 0.9; // مکث‌های نامنظم و ناآرام
      this.playCelloNote(midiToFreq(midi), this.horror.nextTime, duration - 0.7);
      this.horror.nextTime += duration;
      this.horror.step += 1;
    }
  }

  private playCelloNote(freq: number, time: number, durationSec: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.horrorBus) return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.11, time + durationSec * 0.45); // کشش آرشه
    gain.gain.linearRampToValueAtTime(0, time + durationSec);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 780;
    gain.connect(lowpass);
    lowpass.connect(this.horrorBus);

    const bow = ctx.createOscillator();
    bow.type = 'sawtooth';
    bow.frequency.value = freq;
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 4.2;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.value = 5;
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(bow.detune);
    bow.connect(gain);
    bow.start(time);
    vibrato.start(time);
    bow.stop(time + durationSec + 0.05);
    vibrato.stop(time + durationSec + 0.05);
  }

  /* =======================================================================
   * همگام‌سازی خودکار صدا با بیت‌های کات‌سین (قلب اتصال به موج ۲)
   * ======================================================================= */

  /** ورود بیت جدید را اعلام می‌کند؛ لایه صوتی لازم را idempotent روشن/خاموش می‌کند */
  applyBeat(beat: CutsceneBeatId): void {
    if (beat === this.currentBeat) return;
    this.currentBeat = beat;
    if (!this.ctx) return; // بیت ثبت شده؛ به‌محض init() از همین‌جا ادامه می‌دهد

    switch (beat) {
      case 'door_usher_collects_tickets':
      case 'enter_20_seat_tiered_salon':
        this.stopClassical();
        this.stopSoprano();
        this.stopRoomRumble();
        if (this.musicStateValue !== 'horror') this.musicStateValue = 'silent';
        break;

      case 'classical_music_curtain_dance':
        this.startClassical();
        break;

      case 'tall_dark_man_left_shadow':
        this.startClassical();
        this.playShadowUndertone();
        break;

      case 'man_walks_claps_extends_hand':
        this.startClassical();
        this.playSlowClaps(4, 0.95);
        break;

      case 'woman_sings_rejects_hand':
        this.startClassical();
        this.startSoprano();
        break;

      case 'red_filthy_inversion_terror':
        // اگر صحنه در فریم دقیق «پس زدن دست» playHandRejection نزده بود، اینجا جبران می‌شود
        this.triggerInversionDistortion();
        this.startHorrorAmbience(0.45);
        break;

      case 'man_glares_pushes_players':
        this.startHorrorAmbience(0.6);
        this.playSeatShockwave();
        break;

      case 'choke_slams_shake_chandelier':
        this.startHorrorAmbience(0.75);
        this.startRoomRumble();
        // کوبش‌ها و سقوط لوستر را لایه تصویر (موج ۳) با playBodySlam/playSlamSequence
        // دقیقاً روی فریم برخورد زمان‌بندی می‌کند تا صدا و تصویر میلی‌ثانیه‌ای قفل شوند.
        break;

      case 'vanish_dark_music_remains':
        this.stopRoomRumble();
        this.startHorrorAmbience(1); // ← بدون وقفه وارد فاز in_theater می‌شود
        break;
    }
  }

  /** میانبر موج ۲: فقط elapsedMs سرور را بده؛ بیت و صدا خودکار هم‌فاز می‌شوند */
  syncToElapsedMs(elapsedMs: number): CutsceneBeatId {
    const beat = beatFromElapsedMs(elapsedMs);
    this.applyBeat(beat);
    return beat;
  }

  /** زمزمه بم و خفه زیر موسیقی شاد لحظه‌ای که مرد سیاه‌پوش در سایه چپ دیده می‌شود */
  private playShadowUndertone(): void {
    const ctx = this.ctx;
    const destination = this.panToSfx(-0.65); // از سمت چپ تاریک صحنه
    if (!this.ready() || !ctx || !destination) return;
    const time = this.now() + 0.1;
    const duration = 7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.07, time + 2.5);
    gain.gain.linearRampToValueAtTime(0, time + duration);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 260;
    gain.connect(lowpass);
    lowpass.connect(destination);
    [49, 52].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(time);
      osc.stop(time + duration + 0.05);
    });
  }

  /* ------------------------------- توقف کلی ------------------------------- */

  /** خاموش کردن همه لایه‌های موسیقی و افکت‌های حلقه‌ای (افکت‌های یک‌باره خودشان تمام می‌شوند) */
  stopAll(): void {
    this.stopClassical(0.4);
    this.stopSoprano(0.4);
    this.stopHorrorAmbience(0.6);
    this.stopRoomRumble();
    this.inversionTriggered = false;
    this.musicStateValue = 'silent';
    this.currentBeat = null;
  }
}
