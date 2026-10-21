import type {
  AlleyEnvironmentView,
  ChatMessageView,
  ClientRoomView,
  HeldTicketsInHandView,
  PlayerSeatPublicView,
  PlayActNumber,
  RowRomanCode,
  TheaterEmblemId,
} from '@/contracts/types';

export type { PlayActNumber, RowRomanCode, TheaterEmblemId } from '@/contracts/types';
export type AlleyRoomView = ClientRoomView;
export type AlleyPlayer = PlayerSeatPublicView;
export type HeldAlleyTickets = HeldTicketsInHandView;
export type AlleyChatMessage = ChatMessageView;
export type AlleyEnvironment = AlleyEnvironmentView;

export const THEATER_EMBLEMS: Array<{ id: TheaterEmblemId; symbol: string; label: string }> = [
  { id: 'mask', symbol: '🎭', label: 'نقاب' },
  { id: 'violin', symbol: '🎻', label: 'ویولن' },
  { id: 'dancer', symbol: '🩰', label: 'رقصنده' },
  { id: 'candelabra', symbol: '🕯️', label: 'شمعدان' },
  { id: 'rose', symbol: '🌹', label: 'رز سرخ' },
  { id: 'swan', symbol: '🦢', label: 'قو' },
  { id: 'hourglass', symbol: '⏳', label: 'ساعت شنی' },
  { id: 'bell', symbol: '🔔', label: 'زنگ پرده' },
];

export interface TicketPunchSelection {
  emblem: TheaterEmblemId;
  actNumber: PlayActNumber;
  rowCode: RowRomanCode;
}
