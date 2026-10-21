// src/engine/view-projector.ts — ساخت نمای امن کلاینت از وضعیت داخلی سرور
// قانون امنیتی موج ۱/۲: پاسخ‌های پانچ‌نشده، کد قفل در و بلیط دست دیگران
// هرگز در ClientRoomView قرار نمی‌گیرند؛ هر بازیکن فقط myHeldTickets خودش را می‌بیند.
import type { ClientRoomView, PlayerSeatPublicView } from '../contracts/types';
import { createDarkAuditoriumState, type InternalRoomState } from './index';
import {
  LEFT_WALL_PLAYBILL,
  PLAY_TITLE,
  RIGHT_WALL_ROW_CHART,
  actSceneTitle,
} from './ticket-puzzle';

const ONLINE_WINDOW_MS = 30_000;

function publicSeatView(state: InternalRoomState, seatIndex: number, now: number): PlayerSeatPublicView {
  const seat = state.seats[seatIndex] as (typeof state.seats)[number];
  const target = state.targets[seatIndex] as (typeof state.targets)[number];
  return {
    seatIndex: seat.seatIndex,
    playerId: seat.playerId,
    playerName: seat.playerName,
    auditoriumRow: seat.auditoriumRow,
    auditoriumCol: seat.auditoriumCol,
    seatLabel: seat.seatLabel,
    joined: seat.joined,
    hasWatchedInvitation: seat.hasWatchedInvitation,
    ticketPunched: seat.ticketPunched,
    // رقم طلایی هر بازیکن فقط پس از پانچ صحیح بلیط خودش آشکار می‌شود
    revealedDoorDigit: seat.ticketPunched ? target.goldenDigit : null,
    isOnline: seat.lastSeenAt !== null && now - seat.lastSeenAt <= ONLINE_WINDOW_MS,
    lastSeenAt: seat.lastSeenAt,
  };
}

export function projectRoomView(
  state: InternalRoomState,
  viewerSeatIndex: number,
  serverNow: number,
): ClientRoomView {
  const me = publicSeatView(state, viewerSeatIndex, serverNow);
  const myTarget = state.targets[viewerSeatIndex] as (typeof state.targets)[number];
  const mySeat = state.seats[viewerSeatIndex] as (typeof state.seats)[number];
  // کوپن مکمل: کلید بلیط نفر بعدی حلقه روی کوپن دست من است
  const nextIndex = (viewerSeatIndex + 1) % state.playerCount;
  const nextTarget = state.targets[nextIndex] as (typeof state.targets)[number];
  const nextSeat = state.seats[nextIndex] as (typeof state.seats)[number];
  const punchedCount = state.seats.filter((s) => s.ticketPunched).length;

  return {
    roomCode: state.code,
    version: state.version,
    phase: state.phase,
    playerCount: state.playerCount,
    maxAuditoriumSeats: 20,
    serverNow,
    cutsceneStartedAt: state.cutsceneStartedAt,
    restartedInTheaterAt: state.restartedInTheaterAt,
    me,
    players: state.seats.map((_, i) => publicSeatView(state, i, serverNow)),
    myHeldTickets: {
      mainTicket: {
        ownerName: mySeat.playerName,
        seatLabel: mySeat.seatLabel,
        playTitle: PLAY_TITLE,
        alleyRowHintName: myTarget.alleyRowHintName,
        selectedPunch: mySeat.ticketPunched
          ? {
              emblem: myTarget.targetEmblem,
              actNumber: myTarget.targetAct,
              rowCode: myTarget.targetRowCode,
            }
          : null,
        isValidated: mySeat.ticketPunched,
        revealedGoldenDigit: mySeat.ticketPunched ? myTarget.goldenDigit : null,
      },
      companionStub: {
        targetTeammateName: nextSeat.playerName,
        targetEmblem: nextTarget.targetEmblem,
        targetActSceneTitle: actSceneTitle(nextTarget.targetAct),
        whisperNote: `این کوپن، کلید بلیط «${nextSeat.playerName}» است؛ نماد و پرده‌اش را برایش بخوان تا بلیطش را پانچ کند.`,
      },
    },
    alley: {
      leftWallPlaybill: LEFT_WALL_PLAYBILL.map((p) => ({ ...p })),
      rightWallRowChart: RIGHT_WALL_ROW_CHART.map((r) => ({ ...r })),
      doorLockState: {
        punchedCount,
        requiredCount: state.playerCount,
        attempts: state.doorAttempts,
        lastAttemptFeedback: state.doorLastFeedback,
      },
    },
    auditorium: state.phase === 'in_theater' ? createDarkAuditoriumState(state) : null,
    messages: [...state.messages],
  };
}
