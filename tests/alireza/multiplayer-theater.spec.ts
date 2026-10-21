/**
 * multiplayer-theater.spec.ts — تست سرتاسری چندنفره علیرضا (Playwright) — موج ۳ بند ۴
 * ---------------------------------------------------------------------------------------------
 * سناریو (دقیقاً طبق TASKS-ALIREZA.md): رزرو اتاق ۳ نفره («توحید»، «امیرعلی»، «علیرضا»)
 * با API واقعی توحید ← ورود همزمان هر سه نفر از لینک دعوت واقعی امیرعلی و تماشای
 * ویدیوی دعوت‌نامه در سه کانتکست مرورگر مستقل ← رسیدن به کوچه ← حل مشارکتی معمای
 * حلقوی بلیط‌ها (از روی کوپن نفر قبلی حلقه + تابلوهای کوچه) و باز کردن قفل در از
 * طریق اکشن‌های سرور ← ورود همزمان هر سه مرورگر به کات‌سین اول‌شخص ← اثبات قفل
 * بودن اکشن‌ها در کات‌سین (409 CUTSCENE_LOCKED) ← Refresh وسط کات‌سین بدون از دست
 * رفتن وضعیت ← رسیدن همزمان هر سه مرورگر به سالن تاریک (in_theater) ← همگام‌سازی
 * بررسی نقاط داغ و نجوا بین مرورگرها.
 *
 * پانچ بلیط و باز کردن در در این اسپک با همان اکشن‌های سروری انجام می‌شود که
 * صحنه کوچه امیرعلی صدا می‌زند (تست‌های رابط بصری کوچه در tests/amirali هستند)؛
 * تمرکز این فایل روی همگام‌سازی کات‌سین و سالن تاریک علیرضاست.
 *
 * اجرا: npx playwright install chromium && npm run test:e2e:alireza
 * (سرور تست و دیتابیس موقت توسط playwright.config.ts خودکار بالا می‌آید.)
 *
 * نکته محیطی ثبت‌شده: در سندباکس ابری تیم، کتابخانه‌های سیستمی مرورگر و CDN نصب
 * Playwright در دسترس نیستند؛ این اسپک روی ماشین توسعه/CI استاندارد اجرا می‌شود.
 * منطق حل معما و سفر کامل API آن جداگانه در محیط توسعه صحت‌سنجی شده است.
 */

import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import type { GameActionPayload } from '../../src/contracts/actions';
import type {
  ClientRoomView,
  HostReservationResult,
  PlayActNumber,
  RowRomanCode,
  TheaterEmblemId,
} from '../../src/contracts/types';

/** بدنه پاسخ موفق اکشن بازی (مطابق API-CONTRACT.md) */
interface GameActionResult {
  accepted: boolean;
  message: string;
  roomView: ClientRoomView;
}

const PLAYER_NAMES = ['توحید', 'امیرعلی', 'علیرضا'] as const;
const CUTSCENE_STAGE = 'section[aria-label="کات‌سین اول‌شخص تماشاخانه اُرفه‌ئو"]';
const ALLEY_SCENE = 'section[aria-label="نمای اول‌شخص از کوچه؛ برای چرخاندن دوربین بکشید"]';

interface ApiOk<T> {
  ok: true;
  data: T;
}
interface ApiErr {
  ok: false;
  error: { code: string; message: string };
}

async function getRoomView(
  api: APIRequestContext,
  roomCode: string,
  seatToken: string,
): Promise<ClientRoomView> {
  const res = await api.get(`/api/rooms/${encodeURIComponent(roomCode)}`, {
    headers: { 'X-Seat-Token': seatToken },
  });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as ApiOk<{ roomView: ClientRoomView }> | ApiErr;
  if (!body.ok) throw new Error(body.error.message);
  return body.data.roomView;
}

async function performAction(
  api: APIRequestContext,
  roomCode: string,
  seatToken: string,
  action: GameActionPayload,
): Promise<GameActionResult> {
  const res = await api.post(`/api/rooms/${encodeURIComponent(roomCode)}/action`, {
    headers: { 'X-Seat-Token': seatToken },
    data: action,
  });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as ApiOk<GameActionResult> | ApiErr;
  if (!body.ok) throw new Error(body.error.message);
  return body.data;
}

/**
 * حل ریاضی معمای حلقوی برای هر بازیکن، دقیقاً مثل بازیکنان واقعی:
 * نماد و عنوان پرده از کوپن نفر قبلی حلقه + شماره پرده از پوستر چپ + کد ردیف از جدول راست.
 */
function solvePunchFor(
  seatIndex: number,
  views: ClientRoomView[],
): { emblem: TheaterEmblemId; actNumber: PlayActNumber; rowCode: RowRomanCode } {
  const mine = views[seatIndex];
  const previous = views[(seatIndex + views.length - 1) % views.length];
  const stub = previous.myHeldTickets.companionStub;
  const act = mine.alley.leftWallPlaybill.find(
    (item) => item.sceneTitle === stub.targetActSceneTitle,
  );
  const row = mine.alley.rightWallRowChart.find(
    (item) => item.rowTitle === mine.myHeldTickets.mainTicket.alleyRowHintName,
  );
  if (!act || !row) throw new Error(`سرنخ‌های کوچه برای صندلی ${seatIndex} کامل نیست`);
  return { emblem: stub.targetEmblem, actNumber: act.actNumber, rowCode: row.romanCode };
}

/** ورود یک بازیکن از لینک دعوت واقعی: تماشای ویدیوی ۱۶ ثانیه‌ای و رسیدن به کوچه. */
async function enterViaInvitation(page: Page, invitePath: string): Promise<void> {
  await page.goto(invitePath);
  const continueButton = page.getByRole('button', { name: /ورود به کوچهٔ تماشاخانه/ });
  await expect(continueButton).toBeEnabled({ timeout: 30_000 });
  await continueButton.click();
  await page.waitForURL(/\/room\/[^/]+$/, { timeout: 20_000 });
  await expect(page.locator(ALLEY_SCENE)).toBeVisible({ timeout: 25_000 });
}

test.describe('سفر کامل سه‌نفره فصل اول — از رزرو تا سالن تاریک', () => {
  test('سه مرورگر همزمان: دعوت، معمای بلیط، کات‌سین همگام، Refresh و سالن تاریک', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(300_000);
    if (!baseURL) throw new Error('baseURL پیکربندی Playwright لازم است');

    const api = await playwrightRequest.newContext({ baseURL });

    /* ۱) رزرو اتاق سه‌نفره با API واقعی */
    const reserveRes = await api.post('/api/rooms', {
      data: { playerCount: 3, playerNames: [...PLAYER_NAMES] },
    });
    expect(reserveRes.status()).toBe(201);
    const reserveBody = (await reserveRes.json()) as ApiOk<HostReservationResult> | ApiErr;
    if (!reserveBody.ok) throw new Error(reserveBody.error.message);
    const reservation = reserveBody.data;
    const roomCode = reservation.roomCode;
    expect(reservation.invites).toHaveLength(3);

    /* ۲) ورود هر سه بازیکن از لینک دعوت اختصاصی خودشان (موازی؛ هرکدام ویدیو را می‌بینند) */
    const pages: Page[] = [];
    for (const invite of reservation.invites) {
      const context = await browser.newContext({ baseURL, locale: 'fa-IR' });
      pages.push(await context.newPage());
      void invite;
    }
    await Promise.all(
      reservation.invites.map((invite, index) =>
        enterViaInvitation(pages[index], invite.invitePath),
      ),
    );

    /* ۳) حل حلقوی معما و پانچ بلیط هر سه نفر با اکشن سرور */
    const viewsBeforePunch = await Promise.all(
      reservation.invites.map((invite) =>
        getRoomView(api, roomCode, invite.seatToken),
      ),
    );
    const goldenDigits: string[] = [];
    for (let seatIndex = 0; seatIndex < 3; seatIndex++) {
      const punch = solvePunchFor(seatIndex, viewsBeforePunch);
      const result = await performAction(
        api,
        roomCode,
        reservation.invites[seatIndex].seatToken,
        { type: 'PUNCH_MY_TICKET', ...punch },
      );
      expect(result.accepted).toBe(true);
      const digit = result.roomView.myHeldTickets.mainTicket.revealedGoldenDigit;
      if (digit == null) throw new Error('رقم طلایی یکی از بلیط‌ها آشکار نشده است');
      goldenDigits.push(String(digit));
    }

    /* ۴) رمز طلایی در به ترتیب صندلی‌ها و باز کردن قفل توسط نفر اول */
    const unlock = await performAction(
      api,
      roomCode,
      reservation.invites[0].seatToken,
      { type: 'UNLOCK_THEATER_DOOR', code: goldenDigits.join('') },
    );
    expect(unlock.accepted).toBe(true);

    /* ۵) هر سه مرورگر همزمان (از طریق SSE) وارد کات‌سین می‌شوند */
    for (const page of pages) {
      await expect(page.locator(CUTSCENE_STAGE)).toBeVisible({ timeout: 25_000 });
    }

    /* ۶) در طول کات‌سین هر اکشن بازی با 409 CUTSCENE_LOCKED رد می‌شود */
    const lockedRes = await api.post(
      `/api/rooms/${encodeURIComponent(roomCode)}/action`,
      {
        headers: { 'X-Seat-Token': reservation.invites[0].seatToken },
        data: { type: 'PUNCH_MY_TICKET', emblem: 'mask', actNumber: 1, rowCode: 'I' },
      },
    );
    expect(lockedRes.status()).toBe(409);
    const lockedBody = (await lockedRes.json()) as ApiErr;
    expect(lockedBody.error.code).toBe('CUTSCENE_LOCKED');

    /* ۷) Refresh وسط کات‌سین وضعیت را از دست نمی‌دهد */
    await pages[1].waitForTimeout(3_000);
    await pages[1].reload();
    await expect(pages[1].locator(CUTSCENE_STAGE)).toBeVisible({ timeout: 25_000 });

    /* ۸) پس از پایان ۷۴ ثانیه هر سه مرورگر به سالن تاریک می‌رسند */
    for (const page of pages) {
      await expect(page.getByTestId('dark-auditorium-scene')).toBeVisible({
        timeout: 150_000,
      });
    }

    /* ۹) بررسی نقطه داغ در یک مرورگر برای بقیه هم همگام می‌شود */
    await pages[0].getByTestId('hotspot-shattered-chandelier').click();
    await pages[0].getByTestId('inspect-button').click();
    await pages[2].getByTestId('hotspot-shattered-chandelier').click();
    await expect(pages[2].getByTestId('hotspot-card')).toContainText(PLAYER_NAMES[0], {
      timeout: 15_000,
    });

    /* ۱۰) نجوای تیمی در سالن تاریک بین مرورگرها می‌رسد */
    const whisperText = 'لوستر وسط سالن شکسته؛ همه سمت من بیاید!';
    await pages[0].getByTestId('whisper-input').fill(whisperText);
    await pages[0].getByTestId('whisper-send').click();
    await expect(pages[1].getByTestId('dark-auditorium-scene')).toContainText(
      whisperText,
      { timeout: 15_000 },
    );

    await api.dispose();
  });

  test('دود صفحات پیش‌نمایش علیرضا (سینما و سالن تاریک)', async ({ page }) => {
    await page.goto('/preview/cinema');
    await expect(page.locator(CUTSCENE_STAGE)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /مرد سیاه‌پوش در سایه/ }).click();
    await expect(page.getByText(/بیت جاری:/)).toBeVisible();

    await page.goto('/preview/auditorium');
    await expect(page.getByTestId('dark-auditorium-scene')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('hotspot-three-dark-stages').click();
    await expect(page.getByTestId('hotspot-card')).toContainText('سه سِن تاریک');
  });
});
