// src/contracts/actions.ts — قرارداد اکشن‌های بازیکن (API-CONTRACT.md بخش ۲)
import type {
  AuditoriumHotspotId,
  PlayActNumber,
  RowRomanCode,
  TheaterEmblemId,
} from './types';

export type GameActionPayload =
  | { type: 'COMPLETE_INVITATION_VIDEO' }
  | {
      type: 'PUNCH_MY_TICKET';
      emblem: TheaterEmblemId;
      actNumber: PlayActNumber;
      rowCode: RowRomanCode;
    }
  | {
      type: 'UNLOCK_THEATER_DOOR';
      code: string; // رشته N رقمی (پشتیبانی از ارقام فارسی و انگلیسی)
    }
  | {
      type: 'INSPECT_AUDITORIUM_HOTSPOT';
      hotspotId: AuditoriumHotspotId;
    };
