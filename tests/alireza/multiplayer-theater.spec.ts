/**
 * multiplayer-theater.spec.ts — تست سرتاسری چندنفره علیرضا (Playwright) — موج ۳ بند ۴
 * ---------------------------------------------------------------------------------------------
 * سناریو (دقیقاً طبق TASKS-ALIREZA.md): رزرو اتاق ۳ نفره («توحید»، «امیرعلی»، «علیرضا»)
 * با API واقعی توحید ← ورود همزمان هر سه نفر با لینک/توکن اختصاصی در سه کانتکست مرورگر
 * مستقل ← حل مشارکتی معمای حلقوی بلیط‌ها از روی کوپن‌ها و تابلوهای کوچه ← باز کردن قفل
 * در ← اثبات قفل بودن اکشن‌ها در کات‌سین (409 CUTSCENE_LOCKED) ← Refresh وسط کات‌سین
 * بدون از دست رفتن وضعیت ← رسیدن همزمان هر سه مرورگر به سالن تاریک (in_theater)
 * ← همگام‌سازی بررسی نقاط داغ و نجوا بین مرورگرها.
 *
 * اجرا: npx playwright install chromium && npm run test:e2e:alireza
 * (سرور تست و دیتابیس موقت توسط playwright.config.ts خودکار بالا می‌آید.)
 *
 * نکته محیطی ثبت‌شده: در سندباکس ابری تیم، کتابخانه‌های سیستمی مرورگر و CDN نصب
 * Playwright در دسترس نیستند؛ این اسپک روی ماشین توسعه/CI استاندارد اجرا می‌شود.
 */

import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Browser,
  type Page,
} from '@playwright/test';
import type {
  ClientRoomView,
  HostReservationResult,
  PlayActNumber,
  RowRomanCode,
  TheaterEmblemId,
} from '../../src/contracts/types';

const PLAYER_NAMES = ['توحید', 'امیرعلی', 'علیرضا'] as const;
const CUTSCENE_STAGE = 'section[aria-label="کات‌سین اول‌شخص تماشاخانه اُرفه‌ئو"]';

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

async function openPlayerPage(
  browser: Browser,
  baseURL: string,
  roomCode: string,
  seatToken: string,
): Promise<Page> {
  const context = await browser.newContext({ baseURL, locale: 'fa-IR' });
  await context.addInitScript(
    ({ key, token }: { key: string; token: string }) => {
      sessionStorage.setItem(key, token);
      localStorage.setItem(key, token);
    },
    { key: `seat:${roomCode}`, token: seatToken },
  );
  const page = await context.newPage();
  await page.goto(`/room/${encodeURIComponent(roomCode)}`);
  return page;
}

test.describe('سفر کامل سه‌نفره فصل اول — از رزرو تا سالن تاریک', () => {
  test('سه مرورگر همزمان: معمای بلیط، کات‌سین همگام، Refresh و سالن تاریک', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(240_000);
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

    /* ۲) ورود هر سه بازیکن با توکن اختصاصی خودشان */
    const pages: Page[] = [];
    for (const invite of reservation.invites) {
      pages.push(await openPlayerPage(browser, baseURL, roomCode, invite.seatToken));
    }

    /* ۳) کارت دعوت و رسیدن به کوچه */
    for (const page of pages) {
      await expect(page.getByTestId('alley-fallback')).toBeVisible({ timeout: 20_000 });
      const invitationButton = page.getByTestId('complete-invitation');
      if (await invitationButton.isVisible().catch(() => false)) {
        await invitationButton.click();
      }
      await expect(page.getByTestId('companion-stub')).toBeVisible({ timeout: 20_000 });
    }

    /* ۴) حل حلقوی معما و پانچ بلیط هر سه نفر از داخل رابط کاربری */
    const viewsBeforePunch = await Promise.all(
      reservation.invites.map((invite) =>
        getRoomView(api, roomCode, invite.seatToken),
      ),
    );
    for (let seatIndex = 0; seatIndex < 3; seatIndex++) {
      const punch = solvePunchFor(seatIndex, viewsBeforePunch);
      const page = pages[seatIndex];
      await page.getByTestId('punch-emblem').selectOption(punch.emblem);
      await page.getByTestId('punch-act').selectOption(String(punch.actNumber));
      await page.getByTestId('punch-row').selectOption(punch.rowCode);
      await page.getByTestId('punch-submit').click();
      await expect(page.getByTestId('golden-digit')).toBeVisible({ timeout: 15_000 });
    }

    /* ۵) رمز طلایی در به ترتیب صندلی‌ها و باز کردن قفل توسط نفر اول */
    const viewsAfterPunch = await Promise.all(
      reservation.invites.map((invite) =>
        getRoomView(api, roomCode, invite.seatToken),
      ),
    );
    const doorCode = viewsAfterPunch
      .map((view) => {
        const digit = view.myHeldTickets.mainTicket.revealedGoldenDigit;
        if (digit == null) throw new Error('رقم طلایی یکی از بلیط‌ها آشکار نشده است');
        return String(digit);
      })
      .join('');
    await pages[0].getByTestId('door-code-input').fill(doorCode);
    await pages[0].getByTestId('door-unlock').click();

    /* ۶) هر سه مرورگر همزمان وارد کات‌سین می‌شوند */
    for (const page of pages) {
      await expect(page.locator(CUTSCENE_STAGE)).toBeVisible({ timeout: 25_000 });
    }

    /* ۷) در طول کات‌سین هر اکشن بازی با 409 CUTSCENE_LOCKED رد می‌شود */
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

    /* ۸) Refresh وسط کات‌سین وضعیت را از دست نمی‌دهد */
    await pages[1].waitForTimeout(3_000);
    await pages[1].reload();
    await expect(pages[1].locator(CUTSCENE_STAGE)).toBeVisible({ timeout: 25_000 });

    /* ۹) پس از پایان ۷۴ ثانیه هر سه مرورگر به سالن تاریک می‌رسند */
    for (const page of pages) {
      await expect(page.getByTestId('dark-auditorium-scene')).toBeVisible({
        timeout: 130_000,
      });
    }

    /* ۱۰) بررسی نقطه داغ در یک مرورگر برای بقیه هم همگام می‌شود */
    await pages[0].getByTestId('hotspot-shattered-chandelier').click();
    await pages[0].getByTestId('inspect-button').click();
    await pages[2].getByTestId('hotspot-shattered-chandelier').click();
    await expect(pages[2].getByTestId('hotspot-card')).toContainText(PLAYER_NAMES[0], {
      timeout: 15_000,
    });

    /* ۱۱) نجوای تیمی در سالن تاریک بین مرورگرها می‌رسد */
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
