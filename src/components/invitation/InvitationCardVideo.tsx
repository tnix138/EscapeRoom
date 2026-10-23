'use client';

import { useEffect, useRef, useState } from 'react';
import NarrationLayer from '../hud/NarrationLayer';
import { INVITATION_CUES, INVITATION_DURATION_MS } from '../hud/narration/narration-track';
import { readPreferences, writePreferences } from '../hud/narration/audio-preferences';

export interface InvitationCardVideoProps {
  playerName: string;
  seatLabel: string;
  onComplete: () => void;
}

const DURATION_MS = INVITATION_DURATION_MS;

export default function InvitationCardVideo({ playerName, seatLabel, onComplete }: InvitationCardVideoProps) {
  const [elapsed, setElapsed] = useState(0);
  const [musicOn, setMusicOn] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const audioRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const progress = Math.min(elapsed / DURATION_MS, 1);
  const scene = elapsed < 4_000 ? 'envelope' : elapsed < 11_000 ? 'card' : 'tickets';

  useEffect(() => {
    const startedAt = performance.now();
    const timer = window.setInterval(() => setElapsed(performance.now() - startedAt), 80);
    return () => window.clearInterval(timer);
  }, []);

  // بلندی صدای انتخاب‌شده بعد از mount از مرورگر خوانده می‌شود (بدون اختلاف hydration).
  useEffect(() => {
    setVolume(readPreferences(window.localStorage).volume);
  }, []);

  useEffect(() => {
    if (!musicOn) return;
    writePreferences(window.localStorage, { ...readPreferences(window.localStorage), muted: false, volume });
  }, [musicOn, volume]);

  useEffect(() => {
    if (!musicOn) {
      audioRef.current?.close().catch(() => undefined);
      audioRef.current = null;
      return;
    }
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    audioRef.current = context;
    const master = context.createGain();
    master.gain.value = 0.018 * volume;
    masterRef.current = master;
    master.connect(context.destination);
    [110, 164.81, 220].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = index === 0 ? 0.5 : 0.24;
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();
    });
    return () => {
      context.close().catch(() => undefined);
      if (audioRef.current === context) audioRef.current = null;
      if (masterRef.current === master) masterRef.current = null;
    };
    // ساخت موتور فقط با روشن/خاموش شدن موسیقی؛ تغییر بلندی جداگانه اعمال می‌شود.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicOn]);

  useEffect(() => {
    if (masterRef.current) masterRef.current.gain.value = 0.018 * volume;
  }, [volume]);

  const secondsLeft = Math.max(0, Math.ceil((DURATION_MS - elapsed) / 1000));
  const phaseLabel = scene === 'envelope' ? 'پاکتی از جنس مخمل' : scene === 'card' ? 'اجرای امشب در اُرفه‌ئو' : 'بلیط‌های شما آماده‌اند';

  return (
    <main className={`invitation-video scene-${scene}`}>
      <div className="invitation-vignette" aria-hidden="true" />
      <header className="invitation-topline">
        <a className="invitation-brand" href="/" aria-label="بازگشت به صفحهٔ اصلی"><span>✳</span> پردهٔ سرخ</a>
        <div className="invitation-sequence"><span>پیش‌درآمد</span><i /> <span>تماشاخانهٔ اُرفه‌ئو</span></div>
        <button className={`sound-toggle ${musicOn ? 'sound-on' : ''}`} type="button" onClick={() => setMusicOn((value) => !value)} aria-pressed={musicOn}>
          <span aria-hidden="true">{musicOn ? '♫' : '♪'}</span>{musicOn ? 'موسیقی روشن' : 'فعال‌سازی موسیقی'}
        </button>
      </header>

      <section className="invitation-canvas" aria-label="ویدیوی گرافیکی کارت دعوت">
        <div className="rain-layer" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
        <div className="invitation-copy">
          <p className="invitation-kicker"><span /> یک دعوت‌نامهٔ محرمانه</p>
          <h1>{scene === 'envelope' ? 'برای چشمانِ شما.' : scene === 'card' ? 'امشب، فقط یک اجرا.' : 'صندلی‌تان منتظر است.'}</h1>
          <p>{scene === 'envelope' ? 'مُهر را بشکنید؛ پرده منتظر نمی‌ماند.' : scene === 'card' ? 'در تماشاخانهٔ اُرفه‌ئو، نمایشی بی‌همتا در انتظار شماست.' : 'این بلیط را نگه دارید. به زودی به آن نیاز پیدا می‌کنید.'}</p>
        </div>

        <div className="invitation-object" aria-hidden="true">
          <div className="envelope-shadow" />
          <div className={`velvet-envelope ${scene !== 'envelope' ? 'envelope-open' : ''}`}>
            <div className="envelope-back" />
            <div className="envelope-flap" />
            <div className="envelope-letter">
              <div className="letter-border"><span className="letter-corner top-left">❧</span><span className="letter-corner top-right">❧</span><span className="letter-corner bottom-left">❧</span><span className="letter-corner bottom-right">❧</span>
                <p className="letter-overline">TEATRO ORFEO · 1924</p>
                <h2>دعوت‌نامه</h2>
                <span className="letter-divider">✦</span>
                <div className="mini-stage"><span className="mini-curtain left" /><span className="mini-curtain right" /><span className="mini-spotlight" /><span className="mini-singer">♫</span><span className="mini-dancer">♟</span><span className="mini-violin">♬</span></div>
                <p className="letter-guest">ویژهٔ <strong>{playerName || 'مهمان تماشاخانه'}</strong></p>
                <p className="letter-seat">{seatLabel || 'مهمان ویژه'} · امشب، ساعت ۹</p>
                <p className="letter-footer">نمایش امشب؛ تنها یک‌بار اجرا می‌شود.</p>
              </div>
            </div>
            <div className="envelope-front"><div className="envelope-fold" /><div className="wax-seal"><span>O</span><i>✳</i></div><div className="envelope-name"><small>دعوت‌نامهٔ اختصاصی برای</small><strong>{playerName || 'مهمان تماشاخانه'}</strong></div></div>
            <span className="envelope-hand hand-left" /><span className="envelope-hand hand-right" />
          </div>
          <div className={`paper-ticket ticket-one ${scene === 'tickets' ? 'ticket-visible' : ''}`}><span>ORFEO</span><strong>۰۱</strong><small>{playerName || 'مهمان'}</small><i>✦</i></div>
          <div className={`paper-ticket ticket-two ${scene === 'tickets' ? 'ticket-visible' : ''}`}><span>IL SIPARIO ROSSO</span><strong>امشب</strong><small>{seatLabel || 'صندلی شما'}</small><i>✦</i></div>
        </div>
        <div className="invitation-floor" aria-hidden="true" />
      </section>

      <NarrationLayer
        elapsedMs={elapsed}
        track={INVITATION_CUES}
        durationMs={DURATION_MS}
        muted={!musicOn}
        onToggleMute={() => setMusicOn((value) => !value)}
        volume={volume}
        onVolumeChange={setVolume}
        persistPreferences={false}
        className="invitation-narration"
      />

      <footer className="invitation-controls">
        <div className="sequence-status"><span className="sequence-number">۰{scene === 'envelope' ? '۱' : scene === 'card' ? '۲' : '۳'}</span><span><strong>{phaseLabel}</strong><small>{elapsed >= DURATION_MS ? 'پیش‌درآمد به پایان رسید' : `ادامهٔ پیش‌درآمد تا ${secondsLeft} ثانیهٔ دیگر`}</small></span></div>
        <div className="sequence-progress" role="progressbar" aria-label="پیشرفت دعوت‌نامه" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ transform: `scaleX(${progress})` }} /></div>
        <button className="invitation-continue" type="button" onClick={onComplete} disabled={elapsed < DURATION_MS}>
          <span>{elapsed < DURATION_MS ? 'در حال گشوده شدن' : 'ورود به کوچهٔ تماشاخانه'}</span><span className="continue-arrow">←</span>
        </button>
      </footer>
    </main>
  );
}
