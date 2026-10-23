/**
 * invitation-prelude-audio.ts — موسیقی معمایی و سینمایی صفحهٔ دعوت‌نامه (تماشاخانهٔ اُرفه‌ئو)
 * -----------------------------------------------------------------------------------------
 * جایگزین نوسان‌سازهای ثابت قبلی (۱۱۰/۱۶۴/۲۲۰ هرتز که صدای وزوز/نویز یکنواخت می‌دادند).
 *
 * معماری صوتی (۱۰۰٪ Web Audio API، بدون فایل خارجی و بدون هیچ مولد نویز سفید/صورتی):
 *  ۱. پخش خودکار و نرم از لحظهٔ ورود به صفحه با Fade-In مخملی ۱٫۴ ثانیه‌ای + بازگشایی خودکار
 *     AudioContext با اولین تعامل کاربر در مرورگرهایی که Autoplay سرد را معلق نگه می‌دارند
 *  ۲. تراز صدای نرمال و ملایم (پیش‌فرض ۴۵٪ با سقف بهرهٔ کنترل‌شده) تا گوش را خسته یا اذیت نکند
 *  ۳. پیانوی نمدی تاریک (Felt Piano Arpeggio) در گام ر مینور هارمونیک — حس رازآلود Escape Room
 *  ۴. ملودی ظریف سلستا / جعبهٔ موسیقی عتیقه (Antique Celesta Counter-Melody) در اکتاو بالا
 *  ۵. باس گرم و نرم ویولنسل (Warm Bowed Cello) در ابتدای هر میزان با فیلتر پایین‌گذر عمیق
 *  ۶. پژواک استریوی تالار اپرا (Warm Stereo Hall Echo) + زنگ لطیف باز شدن پاکت و بلیط‌ها
 */

export type InvitationAudioScene = 'envelope' | 'card' | 'tickets';

export interface InvitationBarSpec {
  /** نت باس ویولنسل (MIDI) */
  bassMidi: number;
  /** ۸ نت چنگ آرپژ پیانوی نمدی در هر میزان (MIDI) */
  arpeggioMidi: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  /** نت‌های ملودی سلستا روی ضرب‌های منتخب میزان: [ضرب ۰..۷، نت MIDI] */
  celestaHits: readonly (readonly [number, number])[];
}

/** طول هر نت چنگ (ثانیه) — حدود ۷۹ ضرب در دقیقه، سنگین و معمایی */
export const INVITATION_EIGHTH_SEC = 0.38;
export const INVITATION_STEPS_PER_BAR = 8;

/** بلندی پیش‌فرض نرمال و ملایم در بدو ورود خودکار به صفحهٔ دعوت‌نامه */
export const INVITATION_DEFAULT_VOLUME = 0.45;

/** زمان ورود تدریجی صدا (ثانیه) تا شروع خودکار کاملاً نرم و بدون شوک صوتی باشد */
export const INVITATION_FADE_IN_SEC = 1.4;

/** ضریب سقف خروجی مستر برای حفظ صدای پس‌زمینه در محدودهٔ آرام و غیرخسته‌کننده */
export const INVITATION_MAX_MASTER_GAIN = 0.34;

const AUTOPLAY_UNLOCK_EVENTS = [
  'pointerdown',
  'touchstart',
  'touchend',
  'mousedown',
  'keydown',
  'click',
] as const;

/**
 * پارتیتور ۸ میزانی در ر مینور هارمونیک (Dmadd9 → BbMaj7#11 → Gm6 → A7b9 → Dm9 → Fmaj7/C → Edim7/Bb → A7sus4→A7)
 * طراحی‌شده اختصاصی برای فضای معمایی و گوتیک اتاق فرار «تماشاخانهٔ اُرفه‌ئو».
 */
export const INVITATION_SCORE_BARS: readonly InvitationBarSpec[] = [
  {
    // ۱. Dm(add9)
    bassMidi: 38,
    arpeggioMidi: [50, 57, 62, 64, 65, 64, 62, 57],
    celestaHits: [
      [4, 74],
      [6, 76],
      [7, 77],
    ],
  },
  {
    // ۲. BbMaj7(#11)
    bassMidi: 34,
    arpeggioMidi: [46, 53, 58, 62, 65, 64, 62, 58],
    celestaHits: [
      [0, 81],
      [4, 79],
      [6, 77],
    ],
  },
  {
    // ۳. Gm6 (فاصلهٔ معمایی می بکار روی سل مینور)
    bassMidi: 31,
    arpeggioMidi: [43, 50, 55, 58, 64, 62, 58, 55],
    celestaHits: [
      [0, 76],
      [4, 74],
      [6, 70],
    ],
  },
  {
    // ۴. A7(b9) — تعلیق مینور هارمونیک
    bassMidi: 33,
    arpeggioMidi: [45, 52, 57, 61, 67, 65, 64, 61],
    celestaHits: [
      [0, 73],
      [4, 76],
      [6, 73],
    ],
  },
  {
    // ۵. Dm9 — اوج لطیف ملودی جعبهٔ موسیقی
    bassMidi: 38,
    arpeggioMidi: [50, 57, 65, 69, 67, 65, 64, 57],
    celestaHits: [
      [0, 74],
      [3, 81],
      [6, 79],
    ],
  },
  {
    // ۶. Fmaj7/C
    bassMidi: 36,
    arpeggioMidi: [48, 53, 57, 60, 64, 60, 57, 53],
    celestaHits: [
      [0, 77],
      [4, 76],
      [6, 72],
    ],
  },
  {
    // ۷. Edim7/Bb — تعلیق کاستهٔ کلاسیک اتاق فرار
    bassMidi: 34,
    arpeggioMidi: [46, 52, 55, 61, 64, 61, 55, 52],
    celestaHits: [
      [0, 76],
      [4, 73],
      [6, 70],
    ],
  },
  {
    // ۸. A7sus4 → A7 — فرود به ابتدای چرخه
    bassMidi: 33,
    arpeggioMidi: [45, 52, 57, 62, 61, 57, 52, 49],
    celestaHits: [
      [0, 74],
      [4, 73],
    ],
  },
] as const;

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function clampUnitVolume(volume: number): number {
  if (!Number.isFinite(volume)) return INVITATION_DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, volume));
}

/**
 * بلندی صدای اولیهٔ دعوت‌نامه با سقف ملایم برای پخش خودکار:
 * اگر کاربر قبلاً صدا را کمتر از حد نرمال تنظیم کرده باشد همان حفظ می‌شود،
 * اما مقادیر بلندِ ذخیره‌شدهٔ قبلی در شروع خودکار به حد نرمال محدود می‌شوند.
 */
export function resolveInitialInvitationVolume(savedVolume?: number | null): number {
  if (typeof savedVolume !== 'number' || !Number.isFinite(savedVolume) || savedVolume <= 0) {
    return INVITATION_DEFAULT_VOLUME;
  }
  return Math.min(clampUnitVolume(savedVolume), INVITATION_DEFAULT_VOLUME);
}

/** تراز خروجی ملایم و نرمال‌شده بر حسب ولوم کاربر (بدون بلندی آزاردهنده یا اعوجاج) */
export function computeInvitationMasterGain(volume: number): number {
  return clampUnitVolume(volume) * INVITATION_MAX_MASTER_GAIN;
}

export class InvitationPreludeAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private mixBus: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private detachUnlockListeners: (() => void) | null = null;
  private nextNoteTime = 0;
  private fadeInEndTime = 0;
  private currentStep = 0;
  private volume: number;
  private disposed = false;

  constructor(initialVolume = INVITATION_DEFAULT_VOLUME) {
    this.volume = clampUnitVolume(initialVolume);
  }

  start(audioContextCtor?: typeof AudioContext): boolean {
    if (this.disposed || this.ctx) return Boolean(this.ctx);

    const Ctor =
      audioContextCtor ??
      (typeof window !== 'undefined'
        ? window.AudioContext ??
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined);
    if (!Ctor) return false;

    const ctx = new Ctor();
    this.ctx = ctx;

    const now = ctx.currentTime;
    this.fadeInEndTime = now + INVITATION_FADE_IN_SEC;

    const master = ctx.createGain();
    const targetGain = computeInvitationMasterGain(this.volume);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(Math.max(0.0001, targetGain), this.fadeInEndTime);
    master.connect(ctx.destination);
    this.masterGain = master;

    // فیلتر پایین‌گذر گرم روی ۲۵۰۰ هرتز برای نرمی کامل صدا و جلوگیری از هرگونه تیزی گوش‌خراش
    const warmMasterFilter = ctx.createBiquadFilter();
    warmMasterFilter.type = 'lowpass';
    warmMasterFilter.frequency.value = 2500;
    warmMasterFilter.Q.value = 0.5;
    warmMasterFilter.connect(master);

    const mixBus = ctx.createGain();
    mixBus.gain.value = 0.85;
    this.mixBus = mixBus;

    // مسیر مستقیم (Dry)
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.74;
    mixBus.connect(dryGain);
    dryGain.connect(warmMasterFilter);

    // پژواک استریوی تالار بدون نویز (دو خط تأخیر گرم چپ/راست با میرایی ملایم)
    this.buildWarmHallEcho(ctx, mixBus, warmMasterFilter);

    this.currentStep = 0;
    this.nextNoteTime = now + 0.08;
    this.scheduleAhead();
    this.timer = setInterval(() => this.scheduleAhead(), 140);

    this.ensureResumed(ctx);
    return true;
  }

  private ensureResumed(ctx: AudioContext): void {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }
    if (ctx.state === 'running' || typeof window === 'undefined' || !window.addEventListener) {
      return;
    }

    const cleanup = () => {
      if (!this.detachUnlockListeners) return;
      this.detachUnlockListeners = null;
      for (const evt of AUTOPLAY_UNLOCK_EVENTS) {
        window.removeEventListener(evt, tryUnlock);
      }
    };

    const tryUnlock = () => {
      if (this.disposed || !this.ctx || this.ctx !== ctx) {
        cleanup();
        return;
      }
      if (ctx.state === 'running') {
        cleanup();
        return;
      }
      ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running') cleanup();
        })
        .catch(() => undefined);
    };

    this.detachUnlockListeners = cleanup;
    for (const evt of AUTOPLAY_UNLOCK_EVENTS) {
      window.addEventListener(evt, tryUnlock, { passive: true });
    }
  }

  private buildWarmHallEcho(
    ctx: AudioContext,
    source: AudioNode,
    destination: AudioNode,
  ): void {
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.26;

    const echoFilter = ctx.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.value = 1350;

    const delayL = ctx.createDelay(1.0);
    delayL.delayTime.value = 0.24;
    const delayR = ctx.createDelay(1.0);
    delayR.delayTime.value = 0.36;

    const fbL = ctx.createGain();
    fbL.gain.value = 0.24;
    const fbR = ctx.createGain();
    fbR.gain.value = 0.22;

    source.connect(echoFilter);
    echoFilter.connect(delayL);
    echoFilter.connect(delayR);

    delayL.connect(fbL);
    fbL.connect(delayR);
    delayR.connect(fbR);
    fbR.connect(delayL);

    if (typeof ctx.createStereoPanner === 'function') {
      const panL = ctx.createStereoPanner();
      panL.pan.value = -0.42;
      const panR = ctx.createStereoPanner();
      panR.pan.value = 0.42;
      delayL.connect(panL);
      delayR.connect(panR);
      panL.connect(wetGain);
      panR.connect(wetGain);
    } else {
      delayL.connect(wetGain);
      delayR.connect(wetGain);
    }

    wetGain.connect(destination);
  }

  setVolume(nextVolume: number): void {
    const clamped = clampUnitVolume(nextVolume);
    const unchanged = Math.abs(clamped - this.volume) < 1e-4;
    this.volume = clamped;
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    // اگر هنوز در پنجرهٔ ورود نرم اولیه هستیم و مقدار تغییر نکرده، شیب ملایم Fade-In را نشکن
    if (unchanged && now < this.fadeInEndTime) return;

    const target = computeInvitationMasterGain(this.volume);
    this.masterGain.gain.cancelScheduledValues(now);
    if (now < this.fadeInEndTime) {
      this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
      this.masterGain.gain.linearRampToValueAtTime(
        Math.max(0.0001, target),
        this.fadeInEndTime,
      );
    } else {
      this.masterGain.gain.setTargetAtTime(target, now, 0.08);
    }
  }

  /**
   * افکت لطیف موسیقایی هم‌زمان با باز شدن پاکت (`card`) و ظاهر شدن بلیط‌ها (`tickets`)
   */
  triggerSceneAccent(scene: InvitationAudioScene): void {
    const ctx = this.ctx;
    if (!ctx || !this.mixBus || this.disposed) return;
    const base = ctx.currentTime + 0.03;

    if (scene === 'card') {
      // گلیساندوی ظریف سلستا هنگام شکستن مُهر و بیرون آمدن دعوت‌نامه
      const notes = [74, 77, 81, 88];
      notes.forEach((midi, idx) => {
        this.playCelestaNote(midiToHz(midi), base + idx * 0.095, 0.042, (idx - 1.5) * 0.15);
      });
    } else if (scene === 'tickets') {
      // آکورد زنگ‌دار نرم هنگام باز شدن دو بلیط تئاتر
      const notes = [69, 74, 77, 81];
      notes.forEach((midi, idx) => {
        this.playCelestaNote(midiToHz(midi), base + idx * 0.11, 0.04, (idx - 1.5) * 0.13);
      });
    }
  }

  private scheduleAhead(): void {
    const ctx = this.ctx;
    if (!ctx || this.disposed) return;

    while (this.nextNoteTime < ctx.currentTime + 0.45) {
      this.scheduleStep(this.currentStep, this.nextNoteTime);
      this.nextNoteTime += INVITATION_EIGHTH_SEC;
      this.currentStep += 1;
    }
  }

  private scheduleStep(step: number, time: number): void {
    const barIdx =
      Math.floor(step / INVITATION_STEPS_PER_BAR) % INVITATION_SCORE_BARS.length;
    const stepInBar = step % INVITATION_STEPS_PER_BAR;
    const bar = INVITATION_SCORE_BARS[barIdx];

    // ۱) باس گرم ویولنسل در ابتدای هر میزان
    if (stepInBar === 0) {
      const barDuration = INVITATION_EIGHTH_SEC * INVITATION_STEPS_PER_BAR;
      this.playWarmCello(midiToHz(bar.bassMidi), time, barDuration * 0.94);
    }

    // ۲) آرپژ پیانوی نمدی با تاکید طبیعی و ملایم روی ضرب‌های ۱ و ۵
    const arpMidi = bar.arpeggioMidi[stepInBar];
    const isStrongBeat = stepInBar === 0 || stepInBar === 4;
    const peakGain = isStrongBeat ? 0.125 : 0.092;
    const stereoPan = ((stepInBar % 4) - 1.5) * 0.14;
    this.playFeltPianoNote(midiToHz(arpMidi), time, peakGain, stereoPan);

    // ۳) ملودی سلستا / جعبهٔ موسیقی روی ضرب‌های تعیین‌شده (ملایم‌شده در اکتاو بالا)
    for (const [beat, celestaMidi] of bar.celestaHits) {
      if (beat === stepInBar) {
        this.playCelestaNote(midiToHz(celestaMidi), time, 0.056, 0.16);
      }
    }
  }

  private connectWithPan(node: AudioNode, pan: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.mixBus) return;
    if (typeof ctx.createStereoPanner === 'function' && pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(panner);
      panner.connect(this.mixBus);
    } else {
      node.connect(this.mixBus);
    }
  }

  private playFeltPianoNote(
    freq: number,
    time: number,
    peakGain: number,
    pan: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.mixBus) return;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peakGain, time + 0.018);
    env.gain.exponentialRampToValueAtTime(peakGain * 0.34, time + 0.28);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 1.65);

    const feltFilter = ctx.createBiquadFilter();
    feltFilter.type = 'lowpass';
    feltFilter.frequency.setValueAtTime(Math.min(1850, freq * 4.0), time);
    feltFilter.frequency.exponentialRampToValueAtTime(Math.max(240, freq * 1.7), time + 1.4);
    feltFilter.Q.value = 0.55;

    env.connect(feltFilter);
    this.connectWithPan(feltFilter, pan);

    const bodyOsc = ctx.createOscillator();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.value = freq;
    bodyOsc.connect(env);

    const overtoneOsc = ctx.createOscillator();
    overtoneOsc.type = 'sine';
    overtoneOsc.frequency.value = freq * 2;
    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.18, time);
    overtoneGain.gain.exponentialRampToValueAtTime(0.01, time + 0.32);
    overtoneOsc.connect(overtoneGain);
    overtoneGain.connect(env);

    bodyOsc.start(time);
    overtoneOsc.start(time);
    bodyOsc.stop(time + 1.7);
    overtoneOsc.stop(time + 1.7);
  }

  private playCelestaNote(
    freq: number,
    time: number,
    peakGain: number,
    pan: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.mixBus) return;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peakGain, time + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 1.3);
    this.connectWithPan(env, pan);

    const pureOsc = ctx.createOscillator();
    pureOsc.type = 'sine';
    pureOsc.frequency.value = freq;
    pureOsc.connect(env);

    // هارمونیک زنگ نقره‌ای بسیار ظریف با میرایی سریع
    const chimeOsc = ctx.createOscillator();
    chimeOsc.type = 'sine';
    chimeOsc.frequency.value = freq * 3;
    const chimeGain = ctx.createGain();
    chimeGain.gain.setValueAtTime(0.05, time);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    chimeOsc.connect(chimeGain);
    chimeGain.connect(env);

    pureOsc.start(time);
    chimeOsc.start(time);
    pureOsc.stop(time + 1.36);
    chimeOsc.stop(time + 1.36);
  }

  private playWarmCello(freq: number, time: number, durationSec: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.mixBus) return;

    const attack = Math.min(0.75, durationSec * 0.3);
    const releaseStart = Math.max(attack + 0.05, durationSec - 0.65);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(0.095, time + attack);
    env.gain.setValueAtTime(0.088, time + releaseStart);
    env.gain.exponentialRampToValueAtTime(0.0001, time + durationSec);

    // فیلتر پایین‌گذر گرم برای حذف کامل هرگونه صدای وزوز/هارمونیک تیز در رژیستر بم
    const celloFilter = ctx.createBiquadFilter();
    celloFilter.type = 'lowpass';
    celloFilter.frequency.value = 290;
    celloFilter.Q.value = 0.7;

    env.connect(celloFilter);
    this.connectWithPan(celloFilter, -0.1);

    const warmOsc = ctx.createOscillator();
    warmOsc.type = 'triangle';
    warmOsc.frequency.value = freq;

    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = freq;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.55;

    // ویبراتوی ملایم آرشهٔ ویولنسل
    const vibrato = ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.value = 4.5;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.setValueAtTime(0, time);
    vibratoDepth.gain.linearRampToValueAtTime(4.0, time + Math.min(0.9, durationSec * 0.5));
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(warmOsc.detune);

    warmOsc.connect(env);
    subOsc.connect(subGain);
    subGain.connect(env);

    const stopAt = time + durationSec + 0.06;
    warmOsc.start(time);
    subOsc.start(time);
    vibrato.start(time);
    warmOsc.stop(stopAt);
    subOsc.stop(stopAt);
    vibrato.stop(stopAt);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.detachUnlockListeners) {
      this.detachUnlockListeners();
      this.detachUnlockListeners = null;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const ctx = this.ctx;
    const master = this.masterGain;
    this.ctx = null;
    this.masterGain = null;
    this.mixBus = null;

    if (ctx && master) {
      try {
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      } catch {
        // نادیده‌گیری در صورت بسته بودن زمینهٔ صوتی
      }
      setTimeout(() => {
        ctx.close().catch(() => undefined);
      }, 100);
    } else if (ctx) {
      ctx.close().catch(() => undefined);
    }
  }
}
