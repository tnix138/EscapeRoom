import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ACT_LABELS,
  KEYPAD_KEYS,
  describeDigitProgress,
  describePunchSelection,
  describeTeamReadiness,
  doorCodeProgress,
  isDigit,
  isPunchSelectionComplete,
  keypadKeyLabel,
  resolveOwnRevealedDigit,
  sanitizeDoorCode,
  teamTicketSummary,
  toLatinDigits,
  toPersianNumber,
} from '../../src/components/alley/puzzle-rules';
import {
  WHISPER_MAX_LENGTH,
  describeSendState,
  unseenMessageCount,
  whisperDraft,
  whisperTypeLabel,
} from '../../src/components/hud/chat-rules';

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

describe('wave 6 — door lock input', () => {
  it('accepts Persian and Arabic digits and strips separators', () => {
    expect(toLatinDigits('۶۲۹')).toBe('629');
    expect(toLatinDigits('٤٥٦')).toBe('456');
    expect(sanitizeDoorCode('۶-۲ ۹', 3)).toBe('629');
    expect(sanitizeDoorCode('12a34', 8)).toBe('1234');
  });

  it('never exceeds the required length', () => {
    expect(sanitizeDoorCode('1234567', 3)).toBe('123');
    expect(sanitizeDoorCode('123', 0)).toBe('');
  });

  it('reports filled and empty slots', () => {
    const progress = doorCodeProgress('۴۲', 5);
    expect(progress.code).toBe('42');
    expect(progress.filled).toBe(2);
    expect(progress.required).toBe(5);
    expect(progress.complete).toBe(false);
    expect(progress.slots).toEqual([true, true, false, false, false]);
  });

  it('marks a full code as ready and explains progress in Persian', () => {
    const partial = doorCodeProgress('12', 3);
    expect(describeDigitProgress(partial)).toContain('۲');
    expect(describeDigitProgress(partial)).toContain('۳');

    const full = doorCodeProgress('123', 3);
    expect(full.complete).toBe(true);
    expect(describeDigitProgress(full)).toContain('همهٔ ارقام');
  });

  it('labels every keypad key for screen readers', () => {
    expect(keypadKeyLabel('7')).toBe('رقم ۷');
    expect(keypadKeyLabel('clear')).toContain('پاک');
    expect(keypadKeyLabel('delete')).toContain('حذف');
    expect(KEYPAD_KEYS).toHaveLength(12);
    expect(KEYPAD_KEYS[0]).toBe('1');
  });
});

describe('wave 6 — team ticket status', () => {
  it('counts punched tickets for groups of three to eight', () => {
    for (let size = 3; size <= 8; size += 1) {
      const players = Array.from({ length: size }, (_, index) => ({ ticketPunched: index < 2 }));
      const summary = teamTicketSummary(players);
      expect(summary.total).toBe(size);
      expect(summary.punched).toBe(2);
      expect(summary.remaining).toBe(size - 2);
      expect(summary.allReady).toBe(size <= 2);
    }
  });

  it('describes readiness without relying on color', () => {
    const waiting = describeTeamReadiness(teamTicketSummary([{ ticketPunched: true }, { ticketPunched: false }]));
    expect(waiting).toContain('پانچ نشده');

    const ready = describeTeamReadiness(teamTicketSummary([{ ticketPunched: true }, { ticketPunched: true }]));
    expect(ready).toContain('همهٔ');
    expect(ready).toContain('قفل');
  });

  it('falls back to the room player count when the list is empty', () => {
    const summary = teamTicketSummary([], 5);
    expect(summary.total).toBe(5);
    expect(summary.allReady).toBe(false);
  });
});

describe('wave 6 — punch selection', () => {
  it('requires all three marks before enabling the punch', () => {
    expect(isPunchSelectionComplete({ emblem: 'rose', actNumber: 2, rowCode: 'III' })).toBe(true);
    expect(isPunchSelectionComplete({ emblem: 'rose', actNumber: 5 as never, rowCode: 'III' })).toBe(false);
    expect(isPunchSelectionComplete({ emblem: undefined, actNumber: 2, rowCode: 'III' })).toBe(false);
  });

  it('summarizes the current selection with Persian act and row labels', () => {
    const summary = describePunchSelection({ emblem: 'rose', actNumber: 2, rowCode: 'III' }, 'رز سرخ');
    expect(summary).toContain('رز سرخ');
    expect(summary).toContain(ACT_LABELS[2]);
    expect(summary).toContain('ردیف سوم');
  });
});

describe('wave 6 — no hidden answer is guessed', () => {
  it('accepts only an integer digit from zero to nine', () => {
    expect(isDigit(0)).toBe(true);
    expect(isDigit(9)).toBe(true);
    expect(isDigit(10)).toBe(false);
    expect(isDigit(-1)).toBe(false);
    expect(isDigit(3.5)).toBe(false);
    expect(isDigit('3')).toBe(false);
    expect(isDigit(null)).toBe(false);
  });

  it('returns the server digit and never computes one', () => {
    expect(resolveOwnRevealedDigit(7, null)).toBe(7);
    expect(resolveOwnRevealedDigit(null, 4)).toBe(4);
    expect(resolveOwnRevealedDigit(undefined, undefined)).toBeNull();
    expect(resolveOwnRevealedDigit('8', 100)).toBeNull();
    expect(resolveOwnRevealedDigit(null, null)).toBeNull();
  });

  it('keeps guessing out of the alley scenes', () => {
    const scene = read('../../src/components/alley/AlleyFirstPersonScene.tsx');
    const three = read('../../src/components/alley/AlleyRoomThreeIntegration.tsx');
    for (const source of [scene, three]) {
      expect(source).not.toContain('Math.random');
      expect(source).toContain('resolveOwnRevealedDigit');
    }
  });
});

describe('wave 6 — whisper composer', () => {
  it('trims the draft and blocks empty messages', () => {
    const empty = whisperDraft('   ');
    expect(empty.canSend).toBe(false);
    expect(empty.trimmed).toBe('');

    const ready = whisperDraft('  سلام  ');
    expect(ready.trimmed).toBe('سلام');
    expect(ready.canSend).toBe(true);
    expect(ready.remaining).toBe(WHISPER_MAX_LENGTH - 4);
  });

  it('flags text past the limit', () => {
    const long = whisperDraft('ا'.repeat(WHISPER_MAX_LENGTH + 1));
    expect(long.tooLong).toBe(true);
    expect(long.canSend).toBe(false);
    expect(long.remaining).toBe(0);
  });

  it('counts only unseen messages', () => {
    expect(unseenMessageCount(5, 2)).toBe(3);
    expect(unseenMessageCount(2, 5)).toBe(0);
    expect(unseenMessageCount(-3, 1)).toBe(0);
  });

  it('labels message types and send states', () => {
    expect(whisperTypeLabel('ticket_share')).toBe('کوپن');
    expect(whisperTypeLabel('system')).toBe('سیستم');
    expect(whisperTypeLabel('whisper')).toBe('نجوا');
    expect(describeSendState('sent')).toContain('رسید');
    expect(describeSendState('error')).toContain('دوباره');
    expect(describeSendState('idle')).toBe('');
  });
});

describe('wave 6 — accessible UI guards', () => {
  it('replaces dropdowns with native radio groups for punch controls', () => {
    const drawer = read('../../src/components/alley/HeldTicketsDrawer.tsx');
    expect(drawer).toContain('type="radio"');
    expect(drawer).toContain('name="ticket-emblem"');
    expect(drawer).toContain('name="ticket-act"');
    expect(drawer).toContain('name="ticket-row"');
    expect(drawer).not.toContain('<select');
    expect(drawer).toContain('aria-expanded={showCouponBack}');
    expect(drawer).toContain('DIGIT_PENDING_MESSAGE');
  });

  it('keeps the lock modal keyboard safe and announced', () => {
    const modal = read('../../src/components/alley/TheaterDoorLockModal.tsx');
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain("event.key === 'Escape'");
    expect(modal).toContain("event.key !== 'Tab'");
    expect(modal).toContain('aria-live="polite"');
    expect(modal).toContain('aria-invalid');
    expect(modal).toContain('aria-label={`کد');
  });

  it('keeps the whisper log live and labeled', () => {
    const panel = read('../../src/components/hud/WhisperChatPanel.tsx');
    expect(panel).toContain('role="log"');
    expect(panel).toContain('aria-live="polite"');
    expect(panel).toContain('htmlFor="whisper-input"');
    expect(panel).toContain('aria-expanded={isOpen}');
    expect(panel).toContain('aria-controls="whisper-body"');
  });

  it('keeps touch targets and readable type in the new styles', () => {
    const css = read('../../src/app/globals.css');
    const sizes = [...css.matchAll(/font-size:\s*([0-9.]+)px/g)].map((match) => Number(match[1]));
    expect(sizes.filter((size) => size < 12)).toHaveLength(0);
    expect(css).toContain('.emblem-option');
    expect(css).toMatch(/\.emblem-option\s*\{[^}]*min-height:\s*52px/);
    expect(css).toMatch(/\.brass-keypad button\s*\{[^}]*min-height:\s*46px/);
    expect(css).toMatch(/\.lock-slot\s*\{/);
    expect(css).toContain('.punch-radio');
  });
});
