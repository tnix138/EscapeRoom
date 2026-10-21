import { describe, expect, it } from 'vitest';
import { validateGuestNames } from '../../src/components/reservation/validation';
import { isCorrectTicketSelection, normalizeDoorCode } from '../../src/components/alley/puzzle';
import { resolveRoomPhase } from '../../src/components/room/resolve-room-phase';

describe('guest reservation validation', () => {
  it('accepts groups of three to eight guests with distinct names', () => {
    expect(validateGuestNames(['توحید', 'امیرعلی', 'علیرضا'])).toBeNull();
    expect(validateGuestNames(['یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت'])).toBeNull();
  });

  it('rejects a group below the minimum or above the maximum', () => {
    expect(validateGuestNames(['یک', 'دو'])).toContain('۳ تا ۸');
    expect(validateGuestNames(Array.from({ length: 9 }, (_, index) => `مهمان ${index}`))).toContain('۳ تا ۸');
  });

  it('requires every name and rejects duplicate names after whitespace normalization', () => {
    expect(validateGuestNames(['یک', '', 'سه'])).toContain('نام همه');
    expect(validateGuestNames(['سارا', ' سارا ', 'امیر'])).toContain('متفاوت');
  });

  it('limits a guest name to 32 characters', () => {
    expect(validateGuestNames(['آ'.repeat(33), 'دو', 'سه'])).toContain('۳۲');
  });
});

describe('invitation room phase routing', () => {
  it('keeps the alley until its puzzle phase is complete', () => {
    expect(resolveRoomPhase('alley_puzzle', 80_000)).toBe('alley_puzzle');
  });

  it('advances from the door chapter to the theater chapter at the contract boundary', () => {
    expect(resolveRoomPhase('door_cutscene', 10_999)).toBe('door_cutscene');
    expect(resolveRoomPhase('door_cutscene', 11_000)).toBe('theater_cutscene');
  });

  it('moves into the auditorium after the complete cutscene, without waiting for another SSE snapshot', () => {
    expect(resolveRoomPhase('door_cutscene', 74_000)).toBe('in_theater');
    expect(resolveRoomPhase('theater_cutscene', 74_000)).toBe('in_theater');
  });
});

describe('alley ticket puzzle helpers', () => {
  it('normalizes Persian and Arabic numerals for the brass door lock', () => {
    expect(normalizeDoorCode('۶۲۹')).toBe('629');
    expect(normalizeDoorCode('٦٢٩')).toBe('629');
    expect(normalizeDoorCode('6-2-9')).toBe('629');
  });

  it('accepts only a ticket with all three correct punches', () => {
    const solution = { emblem: 'rose' as const, actNumber: 2 as const, rowCode: 'III' as const };
    expect(isCorrectTicketSelection(solution, solution)).toBe(true);
    expect(isCorrectTicketSelection({ ...solution, rowCode: 'II' }, solution)).toBe(false);
  });
});
