'use client';

/**
 * AlleyRoomThreeIntegration — اتصال کوچه سه‌بعدی واقعی به داده‌های سرور (علیرضا — موج ۵/۶)
 * - دریافت room از سرور (ClientRoomView)
 * - اسپاون بر اساس seatIndex + ذخیره موقعیت برای reconnect
 * - رندر متن واقعی و باکیفیت مستقیم روی تابلوی اعلانات و جدول گیشه در جهان سه‌بعدی
 *   (بدون نیاز به زدن کلید E برای خواندن متن روی تابلوها؛ ثبت خودکار بازدید سرنخ با نزدیک شدن)
 * - نورپردازی سوسوزن تیرهای چراغ برق، آسمان شب ابری، کف سنگ‌فرش خیس، ساختمان‌ها و جعبه‌ها
 * - گذار در → کات‌سین با فید سیاه
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useThreeEngine } from '@/engine3d/useThreeEngine';
import { usePlayerControls } from '@/engine3d/usePlayerControls';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import { resolveInitialTransform, saveTransform } from '@/engine3d/spawn';
import { type TransitionPhase } from '@/engine3d/transition';
import { RemotePlayerManager } from '@/engine3d/presence/RemotePlayerManager';
import { FearResponsiveFog } from '@/engine3d/horror/fear-fog';
import { HorrorAudio } from '@/audio/horror/horror-audio';
import { horrorLevelIntensity } from '../hud/horror/horror-signal';
import { toPresenceSnapshots } from '@/client-sdk/presence-avatars';
import { ThreeErrorBoundary } from '@/engine3d/ThreeErrorBoundary';
import type { ClientRoomView } from '@/contracts/types';
import type { TheaterEmblemId, PlayActNumber, RowRomanCode, AlleyRoomView } from '@/components/alley/contracts';
import HeldTicketsDrawer from './HeldTicketsDrawer';
import ClueReadingPanel from './ClueReadingPanel';
import TheaterDoorLockModal from './TheaterDoorLockModal';
import { resolveOwnRevealedDigit } from './puzzle-rules';
import WhisperChatPanel from '../hud/WhisperChatPanel';
import TheaterCompanionHud from '../hud/TheaterCompanionHud';
import MovementNotice from '../hud/MovementNotice';
import ExplorationHud from '../hud/ExplorationHud';
import type { ExplorationInput } from '../hud/exploration-hud';
import PresenceHud from '../hud/presence/PresenceHud';
import { usePresenceFeed } from '../hud/presence/use-presence-feed';
import HorrorSignalHud from '../hud/horror/HorrorSignalHud';
import type { HorrorIntensity } from '../hud/horror/horror-signal';

const AlleyThreeSceneCore = dynamic(() => Promise.resolve(ThreeCore), { ssr: false });

interface ThreeCoreProps {
  room: ClientRoomView;
  onPunchTicket: (emblem: TheaterEmblemId, actNumber: PlayActNumber, rowCode: RowRomanCode) => Promise<{ accepted: boolean; message: string }>;
  onUnlockDoor: (code: string) => Promise<{ accepted: boolean; message: string }>;
  onSendWhisper: (text: string, shareStub?: boolean) => Promise<void>;
  onDoorTransition?: () => void;
}

function ThreeCore({ room, onPunchTicket, onUnlockDoor, onSendWhisper, onDoorTransition }: ThreeCoreProps) {
  const { canvasRef, engine, isWebGLAvailable, error } = useThreeEngine();
  const alleyRef = useRef<ReturnType<typeof createAlleyGeometry> | null>(null);
  const [focusedAnchor, setFocusedAnchor] = useState<'playbill' | 'rowChart' | 'theaterDoor' | null>(null);
  const [doorModalOpen, setDoorModalOpen] = useState(false);
  const [ticketFeedback, setTicketFeedback] = useState('');
  const [localPunched, setLocalPunched] = useState(false);
  const [isPunching, setIsPunching] = useState(false);
  const [transition, setTransition] = useState<{ phase: TransitionPhase; progress: number } | null>(null);
  const [showPlaybill, setShowPlaybill] = useState(false);
  const [showRowChart, setShowRowChart] = useState(false);
  const [visitedClues, setVisitedClues] = useState<string[]>([]);
  const [chatOpen, setChatOpen] = useState(false);

  const initialTransform = resolveInitialTransform(room.roomCode, room.me.playerId, room.me.seatIndex);

  const { transform, isPointerLocked, requestPointerLock } = usePlayerControls({
    engine,
    enabled: !doorModalOpen && !showPlaybill && !showRowChart,
    initialTransform,
  });

  // داده‌های سرنخ اتاق از سرور برای رندر واقعی روی تابلوهای سه‌بعدی کوچه
  const playbill = room.alley?.leftWallPlaybill ?? [];
  const rowChart = room.alley?.rightWallRowChart ?? [];
  const isTicketPunched = room.me.ticketPunched || room.myHeldTickets?.mainTicket?.isValidated || localPunched;
  const playersWithLocal = useMemo(
    () =>
      room.players.map((p) =>
        p.playerId === room.me.playerId && isTicketPunched ? { ...p, ticketPunched: true } : p,
      ),
    [room.players, room.me.playerId, isTicketPunched],
  );
  const punchedCount = Math.max(
    room.alley?.doorLockState?.punchedCount ?? 0,
    playersWithLocal.filter((p) => p.ticketPunched).length,
  );

  // حضور هم‌تیمی‌ها — قرارداد #104. در نبود سرویس (فاز ۰۳) بی‌صدا خاموش می‌ماند.
  const presence = usePresenceFeed({
    roomCode: room.roomCode,
    seatToken: null,
    playerId: room.me.playerId,
    transform,
    phase: room.phase,
  });

  // سیگنال ترس فاز ۰۷-ب: در گشودن در (گذار به کات‌سین) «دلواپس»، وگرنه «آرام».
  const horrorLevel = useMemo<HorrorIntensity>(() => {
    if (transition?.phase === 'door_opening') return 'tense';
    if (room.alley.doorLockState.attempts >= 2) return 'tense';
    return 'calm';
  }, [transition?.phase, room.alley.doorLockState.attempts]);

  const presenceNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const player of room.players) map[player.playerId] = player.playerName;
    return map;
  }, [room.players]);

  // ذخیره موقعیت برای reconnect
  useEffect(() => {
    const id = setTimeout(() => {
      saveTransform(room.roomCode, room.me.playerId, transform);
    }, 500);
    return () => clearTimeout(id);
  }, [transform, room.roomCode, room.me.playerId]);

  // تشخیص لنگر نزدیک + ثبت خودکار بازدید سرنخ به محض خواندن مستقیم روی تابلوی سه‌بعدی
  useEffect(() => {
    if (!alleyRef.current) return;
    const anchors = alleyRef.current.anchors;
    const dist = (a: { x: number; z: number }) => Math.hypot(a.x - transform.x, a.z - transform.z);
    const dPlaybill = dist({ x: anchors.playbill.x, z: anchors.playbill.z });
    const dRowChart = dist({ x: anchors.rowChart.x, z: anchors.rowChart.z });
    const dDoor = dist({ x: anchors.theaterDoor.x, z: anchors.theaterDoor.z });

    let nearest: typeof focusedAnchor = null;
    let min = 3.2;
    if (dPlaybill < min) {
      min = dPlaybill;
      nearest = 'playbill';
    }
    if (dRowChart < min) {
      min = dRowChart;
      nearest = 'rowChart';
    }
    if (dDoor < min) {
      min = dDoor;
      nearest = 'theaterDoor';
    }
    if (nearest !== focusedAnchor) setFocusedAnchor(nearest);

    if (nearest === 'playbill' || nearest === 'rowChart') {
      setVisitedClues((previous) => (previous.includes(nearest) ? previous : [...previous, nearest]));
    }
  }, [transform, focusedAnchor]);

  // ساخت صحنهٔ کامل سه‌بعدی کوچه همراه با متن واقعی روی تابلوها
  useEffect(() => {
    if (!engine) return;
    const alley = createAlleyGeometry({
      clues: {
        playbill,
        rowChart,
        punchedCount,
        requiredCount: room.playerCount,
      },
      players: playersWithLocal,
    });
    alleyRef.current = alley;
    engine.scene.environment = alley.environmentMap;
    engine.scene.add(alley.group);
    engine.start();
    return () => {
      engine.stop();
      if (alleyRef.current) {
        engine.scene.remove(alleyRef.current.group);
        engine.scene.environment = null;
        alleyRef.current.dispose();
        alleyRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  // همگام‌سازی زندهٔ متن تابلوهای سه‌بعدی و چراغ‌های بالای در با وضعیت جدید سرور
  useEffect(() => {
    alleyRef.current?.updateClues(
      {
        playbill,
        rowChart,
        punchedCount,
        requiredCount: room.playerCount,
      },
      playersWithLocal,
    );
  }, [playbill, rowChart, punchedCount, room.playerCount, playersWithLocal]);

  // آواتار هم‌تیمی‌ها در صحنه (فاز ۰۴ / قرارداد #104)
  const remotePlayersRef = useRef<RemotePlayerManager | null>(null);
  useEffect(() => {
    const manager = new RemotePlayerManager();
    remotePlayersRef.current = manager;
    return () => {
      manager.dispose();
      remotePlayersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const manager = remotePlayersRef.current;
    if (!engine || !manager) return;
    engine.scene.add(manager);
    return () => {
      engine.scene.remove(manager);
    };
  }, [engine]);

  useEffect(() => {
    const manager = remotePlayersRef.current;
    if (!manager) return;
    manager.sync(toPresenceSnapshots(presence.presences, room.me.playerId), Date.now(), room.me.playerId);
  }, [presence.presences, room.me.playerId]);

  // اتمسفر ترس فاز ۰۷-الف + انیمیشن سوسوزدن تیرهای چراغ برق و آسمان ابری
  const fogRef = useRef<FearResponsiveFog | null>(null);
  useEffect(() => {
    if (!engine) return;
    const fog = new FearResponsiveFog(engine.scene, {
      color: 0x0b101c,
      minDensity: 0.017,
      maxDensity: 0.045,
      initialFear: 0,
    });
    fogRef.current = fog;
    engine.setTick((delta, elapsed) => {
      alleyRef.current?.update(delta, elapsed);
      remotePlayersRef.current?.update(delta);
      fog.update(delta);
    });
    return () => {
      fogRef.current = null;
      engine.setTick(() => {});
      fog.dispose();
    };
  }, [engine]);

  useEffect(() => {
    fogRef.current?.setFearLevel(horrorLevelIntensity(horrorLevel));
  }, [horrorLevel]);

  // صدای محیطی/ضربان قلب فاز ۰۷-الف — فقط بعد از تعامل کاربر (قانون مرورگرها).
  const horrorAudioRef = useRef<HorrorAudio | null>(null);
  useEffect(() => {
    const audio = new HorrorAudio();
    horrorAudioRef.current = audio;
    return () => {
      horrorAudioRef.current = null;
      void audio.dispose();
    };
  }, []);

  const startHorrorAudio = useCallback(async () => {
    const audio = horrorAudioRef.current;
    if (!audio || audio.isInitialized) return;
    const ready = await audio.init();
    if (!ready) return;
    audio.startAmbience();
    audio.startHeartbeat();
    audio.setFearLevel(horrorLevelIntensity(horrorLevel));
  }, [horrorLevel]);

  useEffect(() => {
    horrorAudioRef.current?.setFearLevel(horrorLevelIntensity(horrorLevel));
  }, [horrorLevel]);

  // کلید E فقط برای باز کردن قفل درِ تماشاخانه (تابلوها متن واقعی سه‌بعدی دارند)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) {
        return;
      }
      if (e.code === 'KeyE' && focusedAnchor === 'theaterDoor') {
        setDoorModalOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedAnchor]);

  const handlePunch = useCallback(
    async (emblem: TheaterEmblemId, actNumber: PlayActNumber, rowCode: RowRomanCode) => {
      if (isPunching) return { accepted: false, message: 'در حال بررسی…' };
      setIsPunching(true);
      try {
        const res = await onPunchTicket(emblem, actNumber, rowCode);
        setTicketFeedback(res.message);
        if (res.accepted) setLocalPunched(true);
        return res;
      } finally {
        setIsPunching(false);
      }
    },
    [isPunching, onPunchTicket],
  );

  const handleUnlock = useCallback(
    async (code: string) => {
      const res = await onUnlockDoor(code);
      if (res.accepted) {
        setTransition({ phase: 'door_opening', progress: 0 });
        let p = 0;
        const interval = setInterval(() => {
          p += 0.05;
          if (p >= 1) {
            clearInterval(interval);
            setTransition({ phase: 'fading_to_cutscene', progress: 1 });
            setTimeout(() => onDoorTransition?.(), 800);
          } else {
            setTransition({ phase: 'door_opening', progress: p });
          }
        }, 80);
      }
      return res;
    },
    [onUnlockDoor, onDoorTransition],
  );

  if (!isWebGLAvailable) {
    return (
      <div dir="rtl" style={{ padding: 24, background: '#0a0a12', color: '#e8dcc8' }}>
        WebGL در دسترس نیست — لطفاً از نمای کلاسیک استفاده کنید.
        {error && <div style={{ color: '#ff8a8a', marginTop: 8 }}>{error}</div>}
      </div>
    );
  }

  // رقم فقط از view سرور؛ حدس محلی حذف شد (موج ۶).
  const revealedDigit = resolveOwnRevealedDigit(room.me.revealedDoorDigit, room.myHeldTickets?.mainTicket?.revealedGoldenDigit);

  const mainTicket = room.myHeldTickets?.mainTicket;
  const companionStub = room.myHeldTickets?.companionStub;
  const couponText = companionStub
    ? `کوپن من برای ${companionStub.targetTeammateName}: نماد ${companionStub.targetEmblem}؛ پردهٔ «${companionStub.targetActSceneTitle}». ${companionStub.whisperNote}`
    : '';

  const roomWithLocalState: AlleyRoomView = {
    ...room,
    players: playersWithLocal,
    alley: {
      ...room.alley,
      doorLockState: {
        ...room.alley.doorLockState,
        punchedCount,
      },
    },
  };

  const explorationInput: ExplorationInput = {
    phase: room.phase,
    me: { playerName: room.me.playerName, seatIndex: room.me.seatIndex, ticketPunched: isTicketPunched },
    players: playersWithLocal.map((player) => ({
      playerName: player.playerName,
      seatLabel: player.seatLabel,
      seatIndex: player.seatIndex,
      ticketPunched: player.ticketPunched,
      isOnline: player.isOnline,
    })),
    alley: {
      doorLockState: {
        punchedCount,
        requiredCount: room.playerCount,
      },
    },
    messages: room.messages,
    visitedClues,
    doorUnlocked: room.phase !== 'alley_puzzle',
    positionLabel: focusedAnchor === 'playbill'
      ? 'مقابل تابلوی اعلانات (دیوار چپ)'
      : focusedAnchor === 'rowChart'
        ? 'مقابل گیشهٔ برنجی (دیوار راست)'
        : focusedAnchor === 'theaterDoor'
          ? 'نزدیک درِ تماشاخانه'
          : 'میان کوچهٔ اُرفه‌ئو',
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0b101c' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        tabIndex={0}
        aria-label="کوچه سه‌بعدی — W/A/S/D حرکت، ماوس نگاه، E باز کردن قفل در"
        onClick={() => canvasRef.current?.focus()}
      />

      {/* کراس‌هیر */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 18, height: 18, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(232,220,200,0.7)' }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(232,220,200,0.7)' }} />
      </div>

      <TheaterCompanionHud
        players={playersWithLocal}
        meId={room.me.playerId}
        phase={room.phase}
        punchedCount={punchedCount}
      />

      <MovementNotice
        modalOpen={doorModalOpen || showPlaybill || showRowChart}
        pointerLocked={isPointerLocked}
      />

      <ExplorationHud input={explorationInput} onOpenChat={() => setChatOpen(true)} />

      <HorrorSignalHud level={horrorLevel} showBadge={false} />

      {/* نام و جهت هم‌تیمی‌ها در جهان سه‌بعدی */}
      <PresenceHud
        local={{ position: transform, yawDeg: transform.yawDeg, pitchDeg: transform.pitchDeg }}
        players={presence.presences}
        names={presenceNames}
        localPlayerId={room.me.playerId}
        now={presence.serverNow ?? undefined}
      />

      {/* HUD پایین */}
      <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pointerEvents: 'none', direction: 'rtl' }}>
        <div style={{ background: 'rgba(8,11,18,0.76)', color: '#e8dcc8', padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(201,168,106,0.28)', fontSize: 12, lineHeight: 1.65, pointerEvents: 'auto', fontFamily: 'Vazirmatn' }}>
          <div>🎮 W/A/S/D + Shift — پیاده‌روی و دویدن در کوچه | درگ ماوس — نگاه به اطراف و بالا</div>
          <div>📍 موقعیت: {transform.x.toFixed(1)}, {transform.z.toFixed(1)} — زاویه {transform.yawDeg.toFixed(0)}° {isPointerLocked ? '🔒' : ''}</div>
          {focusedAnchor === 'theaterDoor' && (
            <div style={{ color: '#f0cc84', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🚪 مقابل درِ تماشاخانه — کلید E برای وارد کردن رمز قفل</span>
              <button
                type="button"
                onClick={() => setDoorModalOpen(true)}
                style={{ padding: '2px 10px', borderRadius: 5, border: '1px solid #c9a86a', background: 'rgba(60,34,20,0.85)', color: '#fff3da', cursor: 'pointer', fontSize: 12 }}
              >
                باز کردن قفل
              </button>
            </div>
          )}
          {ticketFeedback && <div style={{ marginTop: 6, color: isTicketPunched ? '#8aff8a' : '#ffd080' }}>{ticketFeedback}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
          <button type="button" onClick={() => { void startHorrorAudio(); requestPointerLock(); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #c9a86a', background: 'rgba(18,22,36,0.92)', color: '#e8dcc8', cursor: 'pointer', fontSize: 12 }}>
            {isPointerLocked ? '🔓 خروج (Esc)' : '🔒 قفل ماوس'}
          </button>
        </div>
      </div>

      {/* پنل دسترس‌پذیری خواندن سرنخ */}
      {showPlaybill && (
        <ClueReadingPanel
          kind="playbill"
          open
          playbill={playbill}
          rowChart={rowChart}
          punchedCount={punchedCount}
          playerCount={room.playerCount}
          onClose={() => setShowPlaybill(false)}
        />
      )}

      {showRowChart && (
        <ClueReadingPanel
          kind="rowChart"
          open
          playbill={playbill}
          rowChart={rowChart}
          punchedCount={punchedCount}
          playerCount={room.playerCount}
          onClose={() => setShowRowChart(false)}
        />
      )}

      {/* بلیط و چت */}
      <div style={{ position: 'absolute', bottom: 84, left: 12, right: 12, display: 'flex', gap: 12, pointerEvents: 'none', direction: 'rtl' }}>
        <div style={{ pointerEvents: 'auto', flex: 1, maxWidth: 380 }}>
          <div style={{ background: 'rgba(8,11,18,0.72)', borderRadius: 8, padding: 8, border: '1px solid rgba(201,168,106,0.22)' }}>
            <div style={{ color: '#e8dcc8', fontSize: 14, marginBottom: 6 }}>
              🎟️ بلیط {room.me.playerName} — {room.me.seatLabel} {isTicketPunched && revealedDigit != null ? `— رقم: ${revealedDigit}` : ''}
            </div>
            <HeldTicketsDrawer
              ownerName={mainTicket?.ownerName || room.me.playerName}
              seatLabel={mainTicket?.seatLabel || room.me.seatLabel}
              playTitle={mainTicket?.playTitle ?? 'اجرای محرمانهٔ امشب'}
              alleyRowHintName={mainTicket?.alleyRowHintName ?? 'ردیف طلاییِ پیشین'}
              companionStub={{
                targetTeammateName: companionStub?.targetTeammateName ?? 'هم‌تیمی',
                targetEmblem: (companionStub?.targetEmblem as TheaterEmblemId) ?? 'mask',
                targetActSceneTitle: companionStub?.targetActSceneTitle ?? 'پرده اول',
                whisperNote: companionStub?.whisperNote ?? '',
              }}
              initialSelection={mainTicket?.selectedPunch ?? null}
              isValidated={isTicketPunched}
              revealedDigit={revealedDigit ?? null}
              isPunching={isPunching}
              onPunch={(sel) => {
                void handlePunch(sel.emblem, sel.actNumber, sel.rowCode);
              }}
              onShareStub={() => {
                void onSendWhisper(couponText, true);
              }}
            />
          </div>
        </div>
        <div style={{ pointerEvents: 'auto', flex: 1, maxWidth: 360 }}>
          <WhisperChatPanel
            messages={room.messages}
            currentPlayerName={room.me.playerName}
            couponText={couponText}
            onSendWhisper={onSendWhisper}
            open={chatOpen}
            onOpenChange={setChatOpen}
          />
        </div>
      </div>

      {/* مودال قفل در */}
      <TheaterDoorLockModal
        room={roomWithLocalState}
        open={doorModalOpen}
        onClose={() => setDoorModalOpen(false)}
        onUnlock={handleUnlock}
      />

      {/* گذار */}
      {transition && (
        <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${transition.progress * 0.92})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e8dcc8', fontSize: 18, direction: 'rtl', transition: 'background 0.2s' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{transition.phase === 'door_opening' ? '🚪' : '🎭'}</div>
            <div>{transition.phase === 'door_opening' ? 'درهای سنگین گشوده می‌شوند…' : 'چراغ‌ها خاموش می‌شوند…'}</div>
            <div style={{ marginTop: 12, width: 200, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden', marginInline: 'auto' }}>
              <div style={{ width: `${transition.progress * 100}%`, height: '100%', background: '#c9a86a', transition: 'width 0.1s' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AlleyRoomThreeIntegration(props: ThreeCoreProps) {
  return (
    <ThreeErrorBoundary>
      <div style={{ width: '100%', height: '100%', minHeight: 600, background: '#0b101c', position: 'relative' }}>
        <AlleyThreeSceneCore {...props} />
      </div>
    </ThreeErrorBoundary>
  );
}
