'use client';

import { KeyboardEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import HeldTicketsDrawer from './HeldTicketsDrawer';
import TheaterDoorLockModal from './TheaterDoorLockModal';
import WhisperChatPanel from '../hud/WhisperChatPanel';
import TheaterCompanionHud from '../hud/TheaterCompanionHud';
import MovementNotice from '../hud/MovementNotice';
import ExplorationHud from '../hud/ExplorationHud';
import type { ExplorationInput } from '../hud/exploration-hud';
import ClueReadingPanel from './ClueReadingPanel';
import SideDrawer, { type SideDrawerItem } from '../hud/SideDrawer';
import { inspectHint, type ClueKind } from './clue-reading-data';
import {
  clampPanoramaYaw,
  panoramaView,
  panoramaYawFromDrag,
  panoramaYawFromKey,
} from './panorama-look';
import { resolveOwnRevealedDigit } from './puzzle-rules';
import { AlleyRoomView, PlayActNumber, RowRomanCode, THEATER_EMBLEMS, TheaterEmblemId, TicketPunchSelection } from './contracts';

export interface AlleyFirstPersonSceneProps {
  room: AlleyRoomView;
  onPunchTicket: (emblem: TheaterEmblemId, actNumber: PlayActNumber, rowCode: RowRomanCode) => Promise<{ accepted: boolean; message: string }>;
  onUnlockDoor: (code: string) => Promise<{ accepted: boolean; message: string }>;
  onSendWhisper: (text: string, shareStub?: boolean) => Promise<void>;
  onReplayInvitation: () => void;
}

export default function AlleyFirstPersonScene({ room, onPunchTicket, onUnlockDoor, onSendWhisper, onReplayInvitation }: AlleyFirstPersonSceneProps) {
  const [yaw, setYaw] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [isPunching, setIsPunching] = useState(false);
  const [localPunched, setLocalPunched] = useState(false);
  const [ticketFeedback, setTicketFeedback] = useState('');
  const [doorUnlocked, setDoorUnlocked] = useState(false);
  const [openClue, setOpenClue] = useState<ClueKind | null>(null);
  const [visitedClues, setVisitedClues] = useState<string[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const pointerX = useRef<number | null>(null);
  const activeView = panoramaView(yaw);
  const currentEmblem = THEATER_EMBLEMS.find((item) => item.id === room.myHeldTickets.companionStub.targetEmblem);
  const mainTicket = room.myHeldTickets.mainTicket;
  const isTicketPunched = room.me.ticketPunched || mainTicket.isValidated || localPunched;
  // رقم فقط از view سرور؛ هیچ حدس یا محاسبهٔ محلی مجاز نیست.
  const revealedDigit = resolveOwnRevealedDigit(room.me.revealedDoorDigit, mainTicket.revealedGoldenDigit);
  const players = room.players.map((player) => player.playerId === room.me.playerId && isTicketPunched
    ? { ...player, ticketPunched: true }
    : player);
  const roomWithLocalState: AlleyRoomView = {
    ...room,
    players,
    alley: {
      ...room.alley,
      doorLockState: { ...room.alley.doorLockState, punchedCount: Math.max(room.alley.doorLockState.punchedCount, players.filter((player) => player.ticketPunched).length) },
    },
  };
  const explorationInput = useMemo<ExplorationInput>(() => ({
    phase: room.phase,
    me: { playerName: room.me.playerName, seatIndex: room.me.seatIndex, ticketPunched: isTicketPunched },
    players: roomWithLocalState.players.map((player) => ({
      playerName: player.playerName,
      seatLabel: player.seatLabel,
      seatIndex: player.seatIndex,
      ticketPunched: player.ticketPunched,
      isOnline: player.isOnline,
    })),
    alley: {
      doorLockState: {
        punchedCount: roomWithLocalState.alley.doorLockState.punchedCount,
        requiredCount: room.playerCount,
      },
    },
    messages: room.messages,
    visitedClues,
    doorUnlocked: doorUnlocked || room.phase !== 'alley_puzzle',
    positionLabel: activeView === 'left'
      ? 'سمت چپ · تابلوی اعلانات'
      : activeView === 'right'
        ? 'سمت راست · گیشهٔ برنجی'
        : 'روبه‌رو · درِ تماشاخانه',
  }), [room.phase, room.me.playerName, room.me.seatIndex, isTicketPunched, roomWithLocalState.players, roomWithLocalState.alley.doorLockState.punchedCount, room.playerCount, room.messages, visitedClues, doorUnlocked, activeView]);

  function openCluePanel(kind: ClueKind) {
    setOpenClue(kind);
    setVisitedClues((previous) => (previous.includes(kind) ? previous : [...previous, kind]));
  }

  const couponText = useMemo(() => `کوپن من برای ${room.myHeldTickets.companionStub.targetTeammateName}: نماد ${currentEmblem?.label ?? 'نامشخص'}؛ پردهٔ «${room.myHeldTickets.companionStub.targetActSceneTitle}». ${room.myHeldTickets.companionStub.whisperNote}`, [room.myHeldTickets.companionStub, currentEmblem?.label]);

  useEffect(() => {
    setLocalPunched(false);
    setTicketFeedback('');
    setIsPunching(false);
    setDoorUnlocked(false);
  }, [room.me.playerId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent | globalThis.KeyboardEvent) {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(event.target.tagName)) return;
      // وقتی مودال قفل یا پنل سرنخ باز است، دوربین نباید زیر آن بچرخد.
      if (doorOpen || openClue) return;
      /* یک قرارداد برای همه: ← / A = نمای چپ، → / D = نمای راست */
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { event.preventDefault(); setYaw((value) => panoramaYawFromKey(value, 'ArrowLeft')); }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { event.preventDefault(); setYaw((value) => panoramaYawFromKey(value, 'ArrowRight')); }
      if (event.key.toLowerCase() === 'e' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target: ClueKind | null = activeView === 'left' ? 'playbill' : activeView === 'right' ? 'rowChart' : null;
        if (!target) return;
        event.preventDefault();
        openCluePanel(target);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeView, doorOpen, openClue]);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('.pan-ignore')) return;
    pointerX.current = event.clientX;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (pointerX.current === null) return;
    const delta = event.clientX - pointerX.current;
    pointerX.current = event.clientX;
    // کشیدن به راست = نگاه به راست (هم‌جهت با کلید ← → و اسلایدر «جهت نگاه»)
    setYaw((value) => panoramaYawFromDrag(value, delta));
  }
  function onPointerEnd() { pointerX.current = null; setIsDragging(false); }

  async function punch(selection: TicketPunchSelection) {
    if (isTicketPunched || isPunching) return;
    setIsPunching(true);
    setTicketFeedback('');
    try {
      const result = await onPunchTicket(selection.emblem, selection.actNumber, selection.rowCode);
      setTicketFeedback(result.message);
      if (result.accepted) setLocalPunched(true);
    } catch (cause) {
      setTicketFeedback(cause instanceof Error ? cause.message : 'پانچ‌گر از کار افتاد؛ دوباره امتحان کنید.');
    } finally {
      setIsPunching(false);
    }
  }

  // منوی کشویی لبهٔ راست — در نمای کلاسیک هم همهٔ کارها از یک‌جا در دسترس‌اند.
  const drawerItems: SideDrawerItem[] = [
    {
      id: 'playbill',
      icon: '📜',
      label: 'تابلوی اعلانات',
      hint: 'سرنخ‌های پوستر نمایش‌نامه',
      onSelect: () => openCluePanel('playbill'),
    },
    {
      id: 'rowChart',
      icon: '🗺️',
      label: 'جدول ردیف‌ها',
      hint: 'سرنخ‌های گیشهٔ برنجی',
      onSelect: () => openCluePanel('rowChart'),
    },
    {
      id: 'door',
      icon: '🚪',
      label: 'قفل درِ تماشاخانه',
      hint: 'وارد کردن رمز ورود',
      onSelect: () => setDoorOpen(true),
    },
    {
      id: 'chat',
      icon: '💬',
      label: 'نجوای هم‌تیمی‌ها',
      hint: 'گفت‌وگوی گروهی',
      onSelect: () => setChatOpen(true),
    },
    {
      id: 'invitation',
      icon: '✉️',
      label: 'بازپخش دعوت‌نامه',
      hint: 'دیدن دوبارهٔ دعوت ابتدای بازی',
      onSelect: () => onReplayInvitation(),
    },
  ];

  return (
    <main className="alley-game-shell">
      <header className="alley-topbar">
        <a className="alley-brand" href="/"><span>✳</span><span><strong>پردهٔ سرخ</strong><small>کوچهٔ تماشاخانه</small></span></a>
        <div className="alley-room-badge"><span className="room-live-dot" /> اتاق <strong dir="ltr">{room.roomCode}</strong><i /> {room.playerCount.toLocaleString('fa')} هم‌سفر</div>
        <div className="alley-top-actions"><button className="alley-head-button" type="button" onClick={onReplayInvitation}>بازپخش دعوت‌نامه</button><span className="alley-phase-label">فصل اول · بیرونِ تماشاخانه</span></div>
      </header>

      <TheaterCompanionHud
        players={room.players}
        meId={room.me.playerId}
        phase={room.phase}
        punchedCount={players.filter((player) => player.ticketPunched).length}
      />

      <MovementNotice modalOpen={doorOpen || openClue !== null} />

      <ExplorationHud input={explorationInput} onOpenChat={() => setChatOpen(true)} />

      <section className={`alley-panorama view-${activeView} ${isDragging ? 'is-dragging' : ''}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} aria-label="نمای اول‌شخص از کوچه؛ برای چرخاندن دوربین بکشید">
        <div className="alley-sky" />
        <div className="alley-building alley-building-left"><div className="building-window" /><div className="building-lamp">✦</div><span className="building-vine vine-one">❧</span></div>
        <div className="alley-building alley-building-right"><div className="building-window" /><div className="building-lamp">✦</div><span className="building-vine vine-two">❧</span></div>
        <div className="alley-ground"><div className="cobble-row cobble-one" /><div className="cobble-row cobble-two" /><div className="cobble-row cobble-three" /><span className="ground-glow" /></div>
        <div className="alley-fog fog-one" /><div className="alley-fog fog-two" />

        <article className={`panorama-target target-left ${activeView === 'left' ? 'target-active' : ''}`}>
          <div className="target-heading"><span>تابلوی اعلانات محله</span><i>◈</i></div>
          <div className="playbill-board"><div className="playbill-screws"><i /><i /><i /><i /></div><div className="playbill-paper"><small>STAGIONE 1924 · TEATRO ORFEO</small><h2>امشب<br /><em>سه پرده</em></h2><span className="playbill-mask">🎭</span><div className="playbill-rule" />
            {room.alley.leftWallPlaybill.map((act) => <div className="playbill-entry" key={act.actNumber}><b>{act.actNumber.toLocaleString('fa')}</b><span><strong>{act.sceneTitle}</strong><small>{act.description}</small></span><i>✦</i></div>)}
            <footer>یک اجرا · یک شب · یک راز</footer>
          </div></div>
          <p>سرنخ نمایش‌نامهٔ امشب</p>
          <button className="clue-inspect-button pan-ignore" type="button" onClick={() => openCluePanel('playbill')}>
            <span aria-hidden="true">🎭</span>
            <span>{inspectHint('playbill')}</span>
            <kbd>E</kbd>
          </button>
        </article>

        <article className={`panorama-target target-center ${activeView === 'center' ? 'target-active' : ''}`}>
          <div className="theater-facade">
            <div className="facade-cornice"><span>✣</span> TEATRO ORFEO <span>✣</span></div>
            <div className="facade-stone"><span className="facade-lamp lamp-left">♧</span><span className="facade-lamp lamp-right">♧</span><span className="facade-balcony">❧ <i>✦</i> ❧</span>
              <div className="door-arch"><span className="arch-inscription">ORFEO</span><button className={`theater-door ${doorUnlocked ? 'theater-door-open' : ''} pan-ignore`} type="button" onClick={() => setDoorOpen(true)} aria-label="بررسی قفل درِ ورودی تماشاخانه"><span className="door-panel door-panel-left" /><span className="door-panel door-panel-right" /><span className="door-knob">✦</span><span className="door-lock-gem">{doorUnlocked ? '✧' : '✣'}</span></button><span className="door-sconce sconce-left">✧</span><span className="door-sconce sconce-right">✧</span></div>
              <div className="door-player-lights">{roomWithLocalState.players.map((player) => <div className={`door-player-light ${player.ticketPunched ? 'player-light-ready' : ''}`} key={player.playerId} title={player.playerName}><i /><small>{player.playerName}</small></div>)}</div>
            </div>
            <div className="facade-bottom"><span>درِ ورودی</span><span>تماشاخانهٔ اُرفه‌ئو</span><span>{roomWithLocalState.alley.doorLockState.punchedCount.toLocaleString('fa')} / {room.playerCount.toLocaleString('fa')} بلیط</span></div>
          </div>
          <p>درِ سنگینِ تماشاخانه</p>
        </article>

        <article className={`panorama-target target-right ${activeView === 'right' ? 'target-active' : ''}`}>
          <div className="target-heading"><span>گیشهٔ مکانیکی برنجی</span><i>⌘</i></div>
          <div className="row-chart-window"><div className="chart-header"><span>ردیف صندلی</span><span>کد ورود</span></div>
            {room.alley.rightWallRowChart.map((row, index) => <div className="chart-row" key={row.romanCode}><span>{row.rowTitle}</span><strong>{row.romanCode}</strong><i>{['✦','✧','❖','✣'][index]}</i></div>)}
            <div className="chart-foot">ردیف خود را از روی بلیط پیدا کنید</div>
          </div>
          <div className="brass-counter"><span>بلیط‌های آماده</span><strong>{room.alley.doorLockState.punchedCount.toLocaleString('fa')}<i>/</i>{room.playerCount.toLocaleString('fa')}</strong></div>
          <p>جدول تبدیل ردیف‌ها</p>
          <button className="clue-inspect-button pan-ignore" type="button" onClick={() => openCluePanel('rowChart')}>
            <span aria-hidden="true">⌘</span>
            <span>{inspectHint('rowChart')}</span>
            <kbd>E</kbd>
          </button>
        </article>

        <div className="alley-vignette" />
        <div className="scene-dust dust-a" /><div className="scene-dust dust-b" />
        <div className="panorama-hint"><span className="drag-symbol">↔</span><span>برای چرخاندن دید، بکشید <small>یا از کلیدهای ← → استفاده کنید</small></span></div>
        <div className="scene-crosshair" aria-hidden="true"><i /></div>
        <div className="pan-ignore camera-controls">
          <button type="button" aria-label="چرخش به چپ" onClick={() => setYaw((value) => clampPanoramaYaw(value - 12))}>‹</button>
          <input type="range" min={-42} max={42} value={yaw} onChange={(event) => setYaw(clampPanoramaYaw(Number(event.target.value)))} aria-label="جهت نگاه" />
          <button type="button" aria-label="چرخش به راست" onClick={() => setYaw((value) => clampPanoramaYaw(value + 12))}>›</button>
        </div>
        <div className="panorama-view-tag"><span>{activeView === 'left' ? 'سمت چپ · پوستر' : activeView === 'right' ? 'سمت راست · گیشه' : 'روبه‌رو · ورودی'}</span><i /></div>
      </section>

      <div className="alley-bottom-hud">
        <HeldTicketsDrawer key={room.me.playerId} ownerName={room.myHeldTickets.mainTicket.ownerName || room.me.playerName} seatLabel={room.myHeldTickets.mainTicket.seatLabel || room.me.seatLabel} playTitle={room.myHeldTickets.mainTicket.playTitle} alleyRowHintName={room.myHeldTickets.mainTicket.alleyRowHintName} companionStub={room.myHeldTickets.companionStub} initialSelection={room.myHeldTickets.mainTicket.selectedPunch} isValidated={isTicketPunched} revealedDigit={revealedDigit} isPunching={isPunching} onPunch={(selection) => { void punch(selection); }} onShareStub={() => { void onSendWhisper(couponText, true); }} />
        <div className="ticket-feedback" aria-live="polite">{ticketFeedback && <span className={isTicketPunched ? 'ticket-success-text' : ''}>{isTicketPunched ? '✦ ' : '◇ '}{ticketFeedback}</span>}</div>
      </div>

      <WhisperChatPanel
        messages={room.messages}
        currentPlayerName={room.me.playerName}
        couponText={couponText}
        onSendWhisper={onSendWhisper}
        open={chatOpen}
        onOpenChange={setChatOpen}
      />
      <TheaterDoorLockModal room={roomWithLocalState} open={doorOpen} onClose={() => setDoorOpen(false)} onUnlock={async (code) => { const result = await onUnlockDoor(code); if (result.accepted) setDoorUnlocked(true); return result; }} />
      {openClue && (
        <ClueReadingPanel
          kind={openClue}
          open
          playbill={room.alley.leftWallPlaybill}
          rowChart={room.alley.rightWallRowChart}
          punchedCount={roomWithLocalState.alley.doorLockState.punchedCount}
          playerCount={room.playerCount}
          onClose={() => setOpenClue(null)}
        />
      )}
      <div className="alley-screen-reader" aria-live="polite">{activeView === 'left' ? 'اکنون به پوستر نمایش‌نامه نگاه می‌کنید.' : activeView === 'right' ? 'اکنون به جدول تبدیل ردیف صندلی‌ها نگاه می‌کنید.' : 'اکنون به درِ ورودی تماشاخانه نگاه می‌کنید.'}</div>
      <SideDrawer items={drawerItems} />
    </main>
  );
}
