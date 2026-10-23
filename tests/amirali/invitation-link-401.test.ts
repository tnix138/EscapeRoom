// لینک دعوت نامعتبر: بازیکن باید همان اول بفهمد، نه بعد از تماشای دعوت‌نامه
// (رفع ۴۰۱ «توکن صندلی معتبر نیست» هنگام ورود به کوچه)
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

const GATE = '../../src/components/invitation/InvitationGate.tsx';

describe('لینک دعوت آلوده پیش از ورود به کوچه پاک‌سازی می‌شود', () => {
  it('صفحهٔ دعوت توکن و کد اتاق را از آدرس نرمال می‌گیرد', () => {
    const page = read('../../src/app/invite/[code]/[seatToken]/page.tsx');
    expect(page).toContain("normalizeSeatToken(route.seatToken)");
    expect(page).toContain("normalizeSeatToken(route.code).toUpperCase()");
  });

  it('SDK نشست، توکن storage و ?token= را نرمال می‌کند', () => {
    const sdk = read('../../src/client-sdk/index.ts');
    expect(sdk).toContain('normalizeSeatToken(rawSeatToken)');
    expect(sdk).toContain("const token = normalizeSeatToken(seatToken);");
    const room = read('../../src/app/room/[code]/page.tsx');
    expect(room).toContain('normalizeSeatToken(queryToken ?? stored.token)');
  });

  it('گیت دعوت‌نامه نسخهٔ نرمال‌شده را در storage می‌نویسد', () => {
    const gate = read(GATE);
    expect(gate).toContain('rememberSeatToken(code, token, [window.sessionStorage, window.localStorage])');
    expect(gate).toContain("headers: { 'X-Seat-Token': token }");
  });
});

describe('۴۰۱ در گیت دعوت‌نامه به صفحهٔ راهنما می‌رسد', () => {
  it('هم GET نشست و هم POST ورود به کوچه روی ۴۰۱ وضعیت invalid-link می‌گیرند', () => {
    const gate = read(GATE);
    expect(gate).toContain("'invalid-link'");
    expect(gate.match(/response\.status === 401/g)?.length).toBe(2);
    expect(gate).toContain("setState('invalid-link')");
  });

  it('صفحهٔ راهنما پیام سرور، کد اتاق و راه خروج را نشان می‌دهد', () => {
    const gate = read(GATE);
    expect(gate).toContain('<p role="alert">{seatError || FALLBACK_SEAT_ERROR}</p>');
    expect(gate).toContain('کد اتاق:');
    expect(gate).toContain('رزرو اتاق تازه');
    expect(gate).toContain('aria-busy="true"');
    expect(gate).toContain('isWellFormedSeatToken(token)');
  });

  it('تلاش دوباره نشست را از سر می‌خواند و فوکوس کیبورد دارد', () => {
    const gate = read(GATE);
    expect(gate).toContain('onClick={() => { void loadSeat(); }}');
    expect(gate).toContain('retryActionRef');
    expect(gate).toContain('target.current?.focus({ preventScroll: true })');
  });
});
