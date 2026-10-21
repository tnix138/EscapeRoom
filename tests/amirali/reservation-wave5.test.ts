import { describe, expect, it } from 'vitest';
import {
  MAX_NAME_LENGTH,
  buildInviteShareText,
  describeCopyFailure,
  guestCountLabel,
  guestDisplayName,
  isAllowedPlayerCount,
  normalizeGuestName,
  resolveInviteUrl,
  seatLabelForIndex,
  toPersianDigits,
  validateGuestNames,
  validateReservation,
} from '../../src/components/reservation/reservation-rules';
import { copyText, type CopyEnvironment } from '../../src/components/reservation/clipboard';
import {
  findStoredSeatToken,
  gateKey,
  rememberSeatToken,
  seatKey,
  type StorageLike,
} from '../../src/components/invitation/seat-storage';

const INVITES = [
  { playerName: 'توحید', invitePath: '/invite/ABC123/tok1' },
  { playerName: 'امیرعلی', invitePath: '/invite/ABC123/tok2' },
  { playerName: 'علیرضا', invitePath: '/invite/ABC123/tok3' },
];

describe('wave 5 — reservation rules', () => {
  it('converts latin digits to Persian digits without ICU', () => {
    expect(toPersianDigits(0)).toBe('۰');
    expect(toPersianDigits(1403)).toBe('۱۴۰۳');
    expect(toPersianDigits('۰۵')).toBe('۰۵');
  });

  it('normalizes Arabic letters, zero-width characters and extra spacing', () => {
    expect(normalizeGuestName('  سارا ')).toBe('سارا');
    expect(normalizeGuestName('علي‌رضا')).toBe('علیرضا');
    expect(normalizeGuestName('علي‌رضا')).toBe('علیرضا');
    expect(normalizeGuestName('امير   كريم')).toBe('امیر کریم');
    expect(normalizeGuestName('')).toBe('');
  });

  it('builds Persian seat labels and guest labels', () => {
    expect(seatLabelForIndex(0)).toBe('صندلی ۰۱');
    expect(seatLabelForIndex(7)).toBe('صندلی ۰۸');
    expect(seatLabelForIndex(-3)).toBe('صندلی ۰۱');
    expect(guestDisplayName('  ', 2)).toBe('مهمان ۳');
    expect(guestCountLabel(5)).toBe('۵ مهمان');
  });

  it('accepts only 3–8 guests', () => {
    expect(isAllowedPlayerCount(2)).toBe(false);
    expect(isAllowedPlayerCount(3)).toBe(true);
    expect(isAllowedPlayerCount(8)).toBe(true);
    expect(isAllowedPlayerCount(9)).toBe(false);
    expect(isAllowedPlayerCount(3.5)).toBe(false);
  });

  it('returns a per-field error for every empty guest name', () => {
    const result = validateReservation(['یک', '  ', 'سه', '']);
    expect(result.ok).toBe(false);
    expect(result.countError).toBeNull();
    expect(result.fieldErrors).toEqual([
      null,
      'نام این مهمان را وارد کنید.',
      null,
      'نام این مهمان را وارد کنید.',
    ]);
    expect(result.firstInvalidField).toBe(1);
    expect(result.message).toContain('نام همه');
    // سازگاری با API قدیمی
    expect(validateGuestNames(['یک', '  ', 'سه', ''])).toContain('نام همه');
  });

  it('flags only the duplicate seat, not the first occurrence', () => {
    const result = validateReservation(['سارا', ' سارا ', 'امیر']);
    expect(result.fieldErrors[0]).toBeNull();
    expect(result.fieldErrors[1]).toContain('صندلی ۰۱');
    expect(result.fieldErrors[1]).toContain('متفاوت');
    expect(result.fieldErrors[2]).toBeNull();
    expect(result.firstInvalidField).toBe(1);
    expect(result.message).toContain('متفاوت');
  });

  it('treats Arabic yeh/kaf and zero-width characters as the same person', () => {
    const result = validateReservation(['علي', 'علی', 'امیر']);
    expect(result.ok).toBe(false);
    expect(result.fieldErrors[1]).toContain('یکسان');
  });

  it('rejects a name longer than the contract limit', () => {
    const result = validateReservation(['آ'.repeat(MAX_NAME_LENGTH + 1), 'دو', 'سه']);
    expect(result.ok).toBe(false);
    expect(result.fieldErrors[0]).toContain('۳۲');
    expect(result.fieldErrors[1]).toBeNull();
  });

  it('reports the group-size error separately from field errors', () => {
    const small = validateReservation(['یک', 'دو']);
    expect(small.countError).toContain('۳ تا ۸');
    expect(small.firstInvalidField).toBeNull();
    expect(small.fieldErrors).toEqual([null, null]);

    const large = validateReservation(Array.from({ length: 9 }, (_, index) => `مهمان ${index}`));
    expect(large.countError).toContain('۳ تا ۸');
  });

  it('keeps the room code and Persian numbering in the share text', () => {
    const text = buildInviteShareText('ABC123', INVITES, 'https://orféo.example');
    expect(text).toContain('ABC123');
    expect(text.split('\n')[0]).toContain('کد اتاق');
    expect(text).toContain('۱. توحید: https://orféo.example/invite/ABC123/tok1');
    expect(text).toContain('۳. علیرضا: https://orféo.example/invite/ABC123/tok3');
  });

  it('keeps invite paths relative before mount', () => {
    expect(resolveInviteUrl('/invite/ABC123/tok1', null)).toBe('/invite/ABC123/tok1');
    expect(resolveInviteUrl('/invite/ABC123/tok1', 'https://orféo.example')).toBe(
      'https://orféo.example/invite/ABC123/tok1',
    );
    expect(resolveInviteUrl('/invite/ABC123/tok1', 'not a url')).toBe('/invite/ABC123/tok1');
  });

  it('explains copy failures in Persian', () => {
    expect(describeCopyFailure('unsupported')).toContain('پشتیبانی نمی‌کند');
    expect(describeCopyFailure('blocked')).toContain('اجازه');
  });
});

/** کلیپ‌بورد جعلی برای تست رفتار بدون مرورگر. */
function fakeEnvironment(options: {
  writeText?: (text: string) => Promise<void>;
  execCommand?: (command: string) => boolean;
}): CopyEnvironment & { written: string[]; commands: string[] } {
  const written: string[] = [];
  const commands: string[] = [];
  const element = {
    value: '',
    style: {} as Record<string, string>,
    setAttribute() {},
    select() {},
    setSelectionRange() {},
    remove() {},
  };
  const doc = {
    body: { appendChild() {}, removeChild() {} },
    createElement: () => element,
    execCommand: (command: string) => {
      commands.push(command);
      return options.execCommand?.(command) ?? false;
    },
  };
  return {
    written,
    commands,
    clipboard: options.writeText
      ? { writeText: async (text: string) => { await options.writeText?.(text); written.push(text); } }
      : null,
    document: doc as unknown as Document,
  };
}

describe('wave 5 — clipboard fallback', () => {
  it('uses the async Clipboard API when it is available', async () => {
    const environment = fakeEnvironment({ writeText: async () => {} });
    await expect(copyText('hello', environment)).resolves.toEqual({ ok: true });
    expect(environment.written).toEqual(['hello']);
    expect(environment.commands).toEqual([]);
  });

  it('falls back to execCommand when the Clipboard API is missing', async () => {
    const environment = fakeEnvironment({ execCommand: () => true });
    await expect(copyText('hello', environment)).resolves.toEqual({ ok: true });
    expect(environment.commands).toEqual(['copy']);
  });

  it('falls back to execCommand when the Clipboard API rejects', async () => {
    const environment = fakeEnvironment({
      writeText: async () => { throw new Error('denied'); },
      execCommand: () => true,
    });
    await expect(copyText('hello', environment)).resolves.toEqual({ ok: true });
    expect(environment.commands).toEqual(['copy']);
  });

  it('returns a reason when every strategy fails', async () => {
    await expect(copyText('hello', fakeEnvironment({}))).resolves.toEqual({
      ok: false,
      reason: 'unsupported',
    });
    const blocked = fakeEnvironment({
      writeText: async () => { throw new Error('denied'); },
      execCommand: () => false,
    });
    await expect(copyText('hello', blocked)).resolves.toEqual({ ok: false, reason: 'blocked' });
  });
});

/** storage جعلی برای تست قرارداد توکن صندلی. */
function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    get length() { return Object.keys(data).length; },
    key: (index: number) => Object.keys(data)[index] ?? null,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => { data[key] = value; },
  };
}

describe('wave 5 — invite to room seat contract', () => {
  it('writes both storage keys the room route reads', () => {
    const session = fakeStorage();
    const local = fakeStorage();
    rememberSeatToken('ABC123', 'tok1', [session, local]);

    expect(session.data[seatKey('ABC123')]).toBe('tok1');
    expect(session.data[gateKey('ABC123', 'tok1')]).toBe('tok1');
    expect(local.data[gateKey('ABC123', 'tok1')]).toBe('tok1');
    expect(seatKey('ABC123')).toBe('seat:ABC123');
    expect(gateKey('ABC123', 'tok1')).toBe('orfeo:ABC123:tok1');
  });

  it('survives an unavailable storage target', () => {
    const throwing: StorageLike = {
      length: 0,
      key: () => null,
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    const healthy = fakeStorage();
    expect(() => rememberSeatToken('ABC123', 'tok1', [throwing, healthy])).not.toThrow();
    expect(healthy.data[seatKey('ABC123')]).toBe('tok1');
  });

  it('finds the seat token in the same order as the room page', () => {
    const session = fakeStorage({ [seatKey('ABC123')]: 'tok2' });
    expect(findStoredSeatToken('ABC123', 'ABC123', [session])).toBe('tok2');

    const gated = fakeStorage({ [gateKey('ABC123', 'tok3')]: 'tok3' });
    expect(findStoredSeatToken('ABC123', null, [gated])).toBe('tok3');

    // ورودی صریح (query) اولویت دارد.
    expect(findStoredSeatToken('ABC123', 'tok9', [session, gated])).toBe('tok9');
    // آدرس بدون توکن و storage خالی → هیچ صندلی‌ای پیدا نمی‌شود.
    expect(findStoredSeatToken('ABC123', 'ABC123', [fakeStorage()])).toBeNull();
  });
});
