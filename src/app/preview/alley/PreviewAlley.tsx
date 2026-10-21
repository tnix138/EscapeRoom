'use client';

import { useMemo, useState } from 'react';
import AlleyFirstPersonScene from '@/components/alley/AlleyFirstPersonScene';
import { AlleyRoomView, PlayActNumber, RowRomanCode, TicketPunchSelection, TheaterEmblemId } from '@/components/alley/contracts';
import { isCorrectTicketSelection } from '@/components/alley/puzzle';

const rowChart = [
  { rowTitle: 'ردیف سرخ', romanCode: 'I' as RowRomanCode },
  { rowTitle: 'ردیف مخملی', romanCode: 'II' as RowRomanCode },
  { rowTitle: 'ردیف آینه', romanCode: 'III' as RowRomanCode },
  { rowTitle: 'ردیف خاموش', romanCode: 'IV' as RowRomanCode },
];
const playbill = [
  { actNumber: 1 as PlayActNumber, sceneTitle: 'ویولنِ شیشه‌ای', description: 'آریای نخست در مه' },
  { actNumber: 2 as PlayActNumber, sceneTitle: 'رزِ سرخ', description: 'رقص زیرِ ماهِ خاموش' },
  { actNumber: 3 as PlayActNumber, sceneTitle: 'آینهٔ شکسته', description: 'پردهٔ سومِ بی‌تماشاگر' },
  { actNumber: 4 as PlayActNumber, sceneTitle: 'زنگِ آخر', description: 'پایانِ یک آواز' },
];
const solutions: TicketPunchSelection[] = [
  { emblem: 'rose', actNumber: 2, rowCode: 'III' },
  { emblem: 'violin', actNumber: 1, rowCode: 'II' },
  { emblem: 'bell', actNumber: 4, rowCode: 'IV' },
];
const digits = [6, 2, 9];

function makeNames(name: string, selectedSeat: number) {
  const names = ['توحید', 'سارا', 'مانی'];
  names[selectedSeat] = name || 'امیرعلی';
  const result: string[] = [];
  for (const suggestion of names) {
    let candidate = suggestion;
    let suffix = 2;
    while (result.includes(candidate)) candidate = `${suggestion} ${suffix++}`;
    result.push(candidate);
  }
  return result;
}

export default function PreviewAlley({ name, seatLabel, initialSeatIndex }: { name: string; seatLabel: string; initialSeatIndex?: number }) {
  const westernSeat = seatLabel.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  const seatNumbers = westernSeat.match(/\d+/g) ?? [];
  const requestedSeat = Number(seatNumbers[seatNumbers.length - 1] ?? 1);
  const selectedSeat = Math.max(0, Math.min(2, initialSeatIndex ?? requestedSeat - 1));
  const names = useMemo(() => makeNames(name, selectedSeat), [name, selectedSeat]);
  const [activeSeat, setActiveSeat] = useState(selectedSeat);
  const [punchedSeats, setPunchedSeats] = useState<boolean[]>([false, false, false]);
  const [attempts, setAttempts] = useState(0);
  const [messages, setMessages] = useState<AlleyRoomView['messages']>([]);
  const [doorUnlocked, setDoorUnlocked] = useState(false);

  const room: AlleyRoomView = useMemo(() => {
    const players = names.map((playerName, seatIndex) => ({
      seatIndex,
      playerId: `preview-seat-${seatIndex}`,
      playerName,
      auditoriumRow: 1 as const,
      auditoriumCol: (seatIndex + 1) as 1 | 2 | 3 | 4 | 5,
      seatLabel: `صندلی ${String(seatIndex + 1).padStart(2, '۰')}`,
      joined: true,
      hasWatchedInvitation: true,
      ticketPunched: punchedSeats[seatIndex],
      revealedDoorDigit: punchedSeats[seatIndex] ? digits[seatIndex] : null,
      isOnline: true,
      lastSeenAt: Date.now(),
    }));
    const solution = solutions[activeSeat];
    const actInfo = playbill[solution.actNumber - 1];
    const rowInfo = rowChart.find((row) => row.romanCode === solution.rowCode)!;
    const targetSeat = (activeSeat + 1) % names.length;
    const targetSolution = solutions[targetSeat];
    const targetAct = playbill[targetSolution.actNumber - 1];
    const targetEmblemLabels: Record<TheaterEmblemId, string> = { mask: 'نقاب', violin: 'ویولن', dancer: 'رقصنده', candelabra: 'شمعدان', rose: 'رز سرخ', swan: 'قو', hourglass: 'ساعت شنی', bell: 'زنگ پرده' };
    const isPunched = punchedSeats[activeSeat];
    return {
      roomCode: 'DEMO24',
      version: punchedSeats.filter(Boolean).length + messages.length + attempts,
      phase: 'alley_puzzle',
      playerCount: names.length,
      maxAuditoriumSeats: 20,
      serverNow: Date.now(),
      cutsceneStartedAt: null,
      restartedInTheaterAt: null,
      players,
      me: players[activeSeat],
      myHeldTickets: {
        mainTicket: {
          ownerName: names[activeSeat],
          seatLabel: players[activeSeat].seatLabel,
          playTitle: 'اجرای محرمانهٔ امشب',
          alleyRowHintName: rowInfo.rowTitle,
          selectedPunch: isPunched ? solution : null,
          isValidated: isPunched,
          revealedGoldenDigit: isPunched ? digits[activeSeat] : null,
        },
        companionStub: {
          targetTeammateName: names[targetSeat],
          targetEmblem: targetSolution.emblem,
          targetActSceneTitle: targetAct.sceneTitle,
          whisperNote: `برای ${names[targetSeat]}؛ بلیطش را با ${targetEmblemLabels[targetSolution.emblem]} و پردهٔ «${targetAct.sceneTitle}» پیدا کنید.`,
        },
      },
      alley: {
        leftWallPlaybill: playbill,
        rightWallRowChart: rowChart,
        doorLockState: { punchedCount: punchedSeats.filter(Boolean).length, requiredCount: names.length, attempts, lastAttemptFeedback: null },
      },
      messages,
      auditorium: null,
    };
  }, [activeSeat, attempts, messages, names, punchedSeats]);

  async function punchTicket(emblem: TheaterEmblemId, actNumber: PlayActNumber, rowCode: RowRomanCode) {
    const correct = solutions[activeSeat];
    if (!isCorrectTicketSelection({ emblem, actNumber, rowCode }, correct)) {
      setAttempts((value) => value + 1);
      return { accepted: false, message: 'صدای پانچ‌گر خطا می‌دهد. یکی از نشانه‌ها درست نیست.' };
    }
    setPunchedSeats((previous) => previous.map((value, index) => index === activeSeat ? true : value));
    return { accepted: true, message: `بلیط ${names[activeSeat]} تأیید شد؛ رقم طلایی آشکار شد.` };
  }

  async function unlockDoor(code: string) {
    if (punchedSeats.some((punched) => !punched)) return { accepted: false, message: 'قفل هنوز منتظر پانچ شدن بلیط همهٔ هم‌تیمی‌هاست.' };
    if (code !== digits.join('')) {
      setAttempts((value) => value + 1);
      return { accepted: false, message: 'ترتیب ارقام درست نیست. بلیط‌ها را به ترتیب شمارهٔ صندلی بخوانید.' };
    }
    setDoorUnlocked(true);
    return { accepted: true, message: 'رمز پذیرفته شد؛ چفتِ برنجی آزاد شد.' };
  }

  async function sendWhisper(text: string, shareStub = false) {
    const cleanText = text.trim();
    if (!cleanText) return;
    setMessages((previous) => [...previous, { id: `preview-message-${Date.now()}-${previous.length}`, senderName: names[activeSeat], type: shareStub ? 'ticket_share' : 'whisper', text: cleanText, createdAt: Date.now() }]);
  }

  return <div className="alley-preview-wrap">
    <section className="preview-seat-switcher" aria-label="تغییر بازیکن پیش‌نمایش">
      <div className="preview-switcher-copy"><span className="preview-demo-tag">پیش‌نمایش تعاملی</span><strong>برای آزمودن معمای گروهی، میان صندلی‌ها جابه‌جا شوید.</strong><small>راه‌حل نمایشی: گل سرخ ← صندلی ۱ · ویولن ← صندلی ۲ · زنگ ← صندلی ۳</small></div>
      <div className="preview-seat-buttons">{names.map((playerName, index) => <button type="button" key={playerName} onClick={() => setActiveSeat(index)} className={`${activeSeat === index ? 'active-preview-seat' : ''} ${punchedSeats[index] ? 'completed-preview-seat' : ''}`}><span>{punchedSeats[index] ? '✓' : String(index + 1).padStart(2, '۰')}</span>{playerName}</button>)}</div>
    </section>
    {doorUnlocked && <div className="preview-unlock-banner"><span>✧</span> درِ تماشاخانه گشوده شد. آماده‌اید پرده را بالا ببرید؟</div>}
    <AlleyFirstPersonScene room={room} onPunchTicket={punchTicket} onUnlockDoor={unlockDoor} onSendWhisper={sendWhisper} onReplayInvitation={() => { window.location.href = `/preview/invitation?name=${encodeURIComponent(names[activeSeat])}&seat=${encodeURIComponent(room.me.seatLabel)}`; }} />
  </div>;
}
