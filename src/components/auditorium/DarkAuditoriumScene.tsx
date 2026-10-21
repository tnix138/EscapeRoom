'use client';

/**
 * DarkAuditoriumScene — شروع مجدد بازی دقیقاً داخل همان سالن تاریک (فاز in_theater) — موج ۳ علیرضا
 * --------------------------------------------------------------------------------------------------
 * قرارداد رسمی: API-CONTRACT.md بخش ۴.۳ — امضای پراپ‌ها دقیقاً طبق سند است.
 * منبع: TASKS-ALIREZA.md موج ۳ بند ۳ + PROJECT.md گام ۶ (ایستگاه پایانی فصل اول).
 * کات‌سین تمام شده و کنترل کامل به بازیکنان برگشته است: چرخش سر آزاد اول‌شخص،
 * بررسی تعاملی چهار نقطه داغ سالن ویران (لوستر شکسته روی زمین، تابلوهای کج، سه سِن
 * تاریک و درهای خروجی قفل‌شده) و پنل نجوای تیمی — در حالی که قطعه ۷ موتور صدا
 * (درون ترسناک و ویولنسل وهم‌آلود) بدون وقفه از انتهای کات‌سین ادامه دارد.
 * وضعیت بررسی هر نقطه از room.auditorium خوانده می‌شود و با اکشن قرارداد
 * INSPECT_AUDITORIUM_HOTSPOT روی سرور ثبت و برای همه اعضا همگام می‌شود.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  AuditoriumHotspotId,
  ClientRoomView,
} from '../../contracts/types';
import { TheaterAudioEngine } from '../../audio/theater-audio-engine';
import { getPovCameraStyle, usePovHeadPan } from '../cinema/usePovHeadPan';
import styles from './DarkAuditoriumScene.module.css';

export interface DarkAuditoriumSceneProps {
  room: ClientRoomView;
  muted: boolean;
  onToggleMute: () => void;
  onInspectHotspot: (hotspotId: AuditoriumHotspotId) => Promise<void>;
  onSendWhisper: (text: string) => Promise<void>;
}

interface HotspotMeta {
  id: AuditoriumHotspotId;
  icon: string;
  title: string;
  description: string;
}

const HOTSPOTS: readonly HotspotMeta[] = [
  {
    id: 'shattered-chandelier',
    icon: '💎',
    title: 'لوستر کریستالی شکسته',
    description:
      'لوستر بزرگ سالن وسط زمین خرد شده است. میان خرده‌کریستال‌ها هنوز برق سردی می‌زند؛ زنجیر پاره‌اش از سقف آویزان مانده و آرام تاب می‌خورد، انگار همین چند ثانیه پیش سقوط کرده باشد.',
  },
  {
    id: 'crooked-paintings',
    icon: '🖼️',
    title: 'تابلوهای کج‌شده دیوارها',
    description:
      'هر چهار تابلوی قاب‌طلایی دیوارهای چپ و راست از ضربه‌ها کج شده‌اند. پشت قاب «نقاب سرخ» ردّ پنج انگشت دوده‌گرفته دیده می‌شود… یا شاید فقط خیال چشمان خسته توست.',
  },
  {
    id: 'three-dark-stages',
    icon: '🎭',
    title: 'سه سِن تاریک با پرده‌های دریده',
    description:
      'پرده‌های سرخ هر سه سِن پوسیده و از پایین دریده شده‌اند و پشت آن‌ها فقط تاریکی مطلق است. نه بانوی خواننده‌ای مانده، نه مرد سیاه‌پوش؛ فقط بوی پارچه کهنه و خاکستر سرد.',
  },
  {
    id: 'locked-exit-doors',
    icon: '🔒',
    title: 'درهای خروجی قفل‌شده',
    description:
      'هر دو درِ خروجی سالن از بیرون قفل و زنجیر شده‌اند و هرچه تکانشان می‌دهی، جز صدای فلز سرد پاسخی نمی‌گیری. راه فرار — هرچه که باشد — از همین سالن تاریک می‌گذرد.',
  },
];

export default function DarkAuditoriumScene({
  room,
  muted,
  onToggleMute,
  onInspectHotspot,
  onSendWhisper,
}: DarkAuditoriumSceneProps) {
  const engineRef = useRef<TheaterAudioEngine | null>(null);
  const [audioRunning, setAudioRunning] = useState(false);
  const [selected, setSelected] = useState<AuditoriumHotspotId | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [whisperDraft, setWhisperDraft] = useState('');
  const [sending, setSending] = useState(false);

  const { yaw, handlers } = usePovHeadPan({
    onYawChange: (nextYaw) => engineRef.current?.setHeadYaw(nextYaw),
  });

  const getEngine = (): TheaterAudioEngine => {
    engineRef.current ??= new TheaterAudioEngine();
    return engineRef.current;
  };

  const startHorrorAudio = async () => {
    const engine = getEngine();
    await engine.init();
    engine.setMuted(muted);
    engine.setHeadYaw(yaw);
    engine.startHorrorAmbience(1); // قطعه ۷ — ادامه بی‌وقفه آهنگ ترسناک کات‌سین
    setAudioRunning(engine.contextState === 'running');
  };

  /* ادامه آهنگ ترسناک از لحظه ورود به سالن تاریک */
  useEffect(() => {
    let cancelled = false;
    const engine = getEngine();
    void engine.init().then(() => {
      if (cancelled) return;
      engine.startHorrorAmbience(1);
      setAudioRunning(engine.contextState === 'running');
    });
    const watcher = setInterval(() => {
      setAudioRunning(engine.contextState === 'running');
    }, 900);
    return () => {
      cancelled = true;
      clearInterval(watcher);
      void engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setMuted(muted);
  }, [muted]);

  const auditorium = room.auditorium;
  const selectedMeta = HOTSPOTS.find((h) => h.id === selected) ?? null;
  const inspectedByMe = selected
    ? (auditorium?.inspectedHotspots[selected] ?? []).includes(room.me.playerName)
    : false;

  const handleInspect = async () => {
    if (!selected || inspecting) return;
    setInspecting(true);
    try {
      await onInspectHotspot(selected);
    } finally {
      setInspecting(false);
    }
  };

  const handleSendWhisper = async (event: FormEvent) => {
    event.preventDefault();
    const text = whisperDraft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await onSendWhisper(text);
      setWhisperDraft('');
    } finally {
      setSending(false);
    }
  };

  const pov = getPovCameraStyle(yaw, 16);

  const hotspotButton = (
    meta: HotspotMeta,
    positionClass: string,
    label: string,
  ) => {
    const inspectedCount = auditorium?.inspectedHotspots[meta.id]?.length ?? 0;
    return (
      <button
        type="button"
        data-testid={`hotspot-${meta.id}`}
        className={`${styles.hotspot} ${positionClass} ${selected === meta.id ? styles.hotspotActive : ''}`}
        onClick={() => setSelected(meta.id)}
        aria-label={`${label}${inspectedCount > 0 ? ` — بررسی‌شده توسط ${inspectedCount} نفر` : ''}`}
      >
        <span className={styles.hotspotIcon}>{meta.icon}</span>
        <span className={styles.hotspotLabel}>{label}</span>
        {inspectedCount > 0 && <span className={styles.hotspotBadge}>✓</span>}
      </button>
    );
  };

  return (
    <section
      className={styles.sceneRoot}
      data-testid="dark-auditorium-scene"
      aria-label="سالن تاریک تماشاخانه پس از کات‌سین — شروع مجدد بازی"
      {...handlers}
    >
      {/* دنیای سالن ویران (پانورامای اول‌شخص) */}
      <div className={styles.world} style={pov}>
        <div className={`${styles.wall} ${styles.wallSide}`}>
          <div className={styles.paintingCrooked} style={{ transform: 'rotate(-17deg)' }}>
            <span>🎭</span><small dir="rtl">نقاب سرخ</small>
          </div>
          <div className={styles.paintingCrooked} style={{ transform: 'rotate(11deg)' }}>
            <span>🦢</span><small dir="rtl">قوی دریاچه</small>
          </div>
          <div className={styles.exitDoor}>
            <span>🚪</span><small dir="rtl">خروجی چپ — قفل 🔒</small>
          </div>
        </div>

        <div className={styles.stageDark}>
          <div className={styles.tornCurtain} />
          <div className={styles.stageMouth}>سِن چپ</div>
        </div>
        <div className={`${styles.stageDark} ${styles.stageDarkMain}`}>
          <div className={styles.tornCurtain} />
          <div className={styles.stageMouth}>سِن اصلی — خاموش و خالی</div>
        </div>
        <div className={styles.stageDark}>
          <div className={styles.tornCurtain} />
          <div className={styles.stageMouth}>سِن راست</div>
        </div>

        <div className={`${styles.wall} ${styles.wallSide}`}>
          <div className={styles.paintingCrooked} style={{ transform: 'rotate(15deg)' }}>
            <span>🎻</span><small dir="rtl">ویولن طلایی</small>
          </div>
          <div className={styles.paintingCrooked} style={{ transform: 'rotate(-9deg)' }}>
            <span>🌹</span><small dir="rtl">رز مخملی</small>
          </div>
          <div className={styles.exitDoor}>
            <span>🚪</span><small dir="rtl">خروجی راست — قفل 🔒</small>
          </div>
        </div>

        {/* زنجیر پاره لوستر و پیکر خردشده‌اش روی زمین */}
        <div className={styles.brokenChain} aria-hidden="true" />
        <div className={styles.shatteredChandelier} aria-hidden="true">
          <span className={styles.shards}>✦ ✧ ◆ ✦ 💎 ✧ ◆ ✦</span>
          <span className={styles.shatteredLabel}>لوستر شکسته وسط سالن</span>
        </div>

        {/* نقاط داغ تعاملی سالن */}
        {hotspotButton(HOTSPOTS[0], styles.hotspotChandelier, 'بررسی لوستر شکسته')}
        {hotspotButton(HOTSPOTS[1], styles.hotspotPaintingsLeft, 'بررسی تابلوهای کج')}
        {hotspotButton(HOTSPOTS[1], styles.hotspotPaintingsRight, 'بررسی تابلوهای کج')}
        {hotspotButton(HOTSPOTS[2], styles.hotspotStages, 'بررسی سه سِن تاریک')}
        {hotspotButton(HOTSPOTS[3], styles.hotspotDoorsLeft, 'بررسی درهای قفل‌شده')}
        {hotspotButton(HOTSPOTS[3], styles.hotspotDoorsRight, 'بررسی درهای قفل‌شده')}
      </div>

      {/* سوسوی نور سرد و وینیت تاریکی ماندگار */}
      <div className={styles.flicker} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />

      {/* بنر وضعیت فصل + حضور تیم */}
      <div className={styles.topBar}>
        <div className={styles.banner}>
          🌑 {auditorium?.chapterStatusBanner ?? 'بازی در سالن تاریک از سر گرفته شد؛ زن و مرد غیب شده‌اند اما آهنگ ترسناک ادامه دارد…'}
        </div>
        <button
          type="button"
          className={styles.muteButton}
          onClick={() => {
            if (!audioRunning) void startHorrorAudio();
            onToggleMute();
          }}
          aria-label={muted ? 'باصدا کردن' : 'بی‌صدا کردن'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      <div className={styles.presenceBar}>
        {room.players.map((player) => (
          <span
            key={player.playerId}
            className={`${styles.presenceChip} ${player.playerId === room.me.playerId ? styles.presenceMe : ''}`}
          >
            <span className={player.isOnline ? styles.onlineDot : styles.offlineDot} />
            {player.playerName}
            {player.playerId === room.me.playerId ? ' (تو)' : ''}
          </span>
        ))}
        <span className={styles.presenceHint}>↔ سرت را بچرخان و روی نشانه‌های سالن کلیک کن</span>
      </div>

      {!audioRunning && (
        <button type="button" className={styles.unlockButton} onClick={() => void startHorrorAudio()}>
          🔊 فعال‌کردن آهنگ ترسناک سالن
        </button>
      )}

      {/* کارت جزئیات نقطه انتخاب‌شده */}
      {selectedMeta && (
        <aside className={styles.infoCard} data-testid="hotspot-card">
          <button
            type="button"
            className={styles.closeCard}
            onClick={() => setSelected(null)}
            aria-label="بستن کارت"
          >
            ✕
          </button>
          <h3>
            {selectedMeta.icon} {selectedMeta.title}
          </h3>
          <p>{selectedMeta.description}</p>
          <div className={styles.inspectedRow}>
            <span>بررسی‌شده توسط:</span>
            {(auditorium?.inspectedHotspots[selectedMeta.id] ?? []).length > 0 ? (
              (auditorium?.inspectedHotspots[selectedMeta.id] ?? []).map((name) => (
                <span key={name} className={styles.inspectedChip}>👁 {name}</span>
              ))
            ) : (
              <span className={styles.notInspected}>هنوز هیچ‌کس از نزدیک بررسی نکرده است</span>
            )}
          </div>
          <button
            type="button"
            data-testid="inspect-button"
            className={styles.inspectButton}
            disabled={inspecting || inspectedByMe}
            onClick={() => void handleInspect()}
          >
            {inspectedByMe ? '✓ تو این بخش را بررسی کرده‌ای' : inspecting ? 'در حال ثبت…' : '🔍 بررسی این بخش از نزدیک'}
          </button>
        </aside>
      )}

      {/* پنل نجوای تیمی */}
      <div className={styles.whisperPanel}>
        <div className={styles.messages}>
          {room.messages.length === 0 ? (
            <p className={styles.noMessages}>🤫 هنوز نجوایی نیست… اولین حرف را تو بزن.</p>
          ) : (
            room.messages.slice(-30).map((message) => (
              <p key={message.id} className={styles.messageLine}>
                <strong>{message.senderName}:</strong> {message.text}
              </p>
            ))
          )}
        </div>
        <form className={styles.whisperForm} onSubmit={(e) => void handleSendWhisper(e)}>
          <input
            data-testid="whisper-input"
            className={styles.whisperInput}
            value={whisperDraft}
            onChange={(event) => setWhisperDraft(event.target.value)}
            placeholder="نجوا به هم‌تیمی‌ها در تاریکی…"
            maxLength={300}
            aria-label="متن نجوای تیمی"
          />
          <button
            type="submit"
            data-testid="whisper-send"
            className={styles.whisperSend}
            disabled={sending || !whisperDraft.trim()}
          >
            ارسال 🤫
          </button>
        </form>
      </div>
    </section>
  );
}
