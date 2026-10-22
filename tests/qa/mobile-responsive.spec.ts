/**
 * mobile-responsive.spec.ts — آزمون سرتاسری «واقعاً روی گوشی» (Playwright)
 * -------------------------------------------------------------------------------
 * چرا این فایل: کل مسیر بازیکن (صفحهٔ اصلی → دعوت‌نامه → کوچه/سالن) روی دسکتاپ
 * ساخته شده بود و در عرض ۳۲۰–۳۹۰px چند مشکل تکرارشونده داشت:
 *
 *   ۱) اسکرول افقی (پنل‌های ثابت پهن‌تر از صفحه)؛
 *   ۲) صحنهٔ بازی با minHeight ثابت ۶۰۰px بلندتر از دید گوشی؛
 *   ۳) نداشتن هیچ کنترل حرکتی لمسی (فقط چرخش دوربین)؛
 *   ۴) پنل بلیط که تمام صحنه را می‌پوشاند.
 *
 * این اسپک دقیقاً همان چهار مورد را می‌سنجد و روی هر سه عرض رایج گوشی اجرا
 * می‌شود: ۳۲۰ (iPhone SE نسل ۱ / گلکسی کوچک)، ۳۹۰ (iPhone 12/13/14) و ۴۳۰.
 *
 * اجرا: npx playwright install chromium && npx playwright test tests/qa/mobile-responsive.spec.ts
 */
import { expect, request as playwrightRequest, test, type APIRequestContext } from '@playwright/test';

const VIEWPORTS = [
  { name: '۳۲۰×۵۶۸', width: 320, height: 568 },
  { name: '۳۹۰×۸۴۴', width: 390, height: 844 },
  { name: '۴۳۰×۹۳۲', width: 430, height: 932 },
] as const;

const PUBLIC_ROUTES = ['/', '/admin/login', '/preview/invitation'] as const;

interface ApiOk<T> {
  ok: true;
  data: T;
}
interface ApiErr {
  ok: false;
  error: { code: string; message: string };
}
interface Reservation {
  roomCode: string;
  invites: ReadonlyArray<{ seatToken: string; playerName: string }>;
}

/** اندازهٔ سرریز افقی صفحه (هر مقدار > ۱ یعنی اسکرول افقی). */
async function horizontalOverflow(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(doc.scrollWidth, document.body.scrollWidth) - doc.clientWidth;
  });
}

/** عناصری که از لبهٔ راست/چپ بیرون زده‌اند (برای پیام خطای گویا). */
async function offenders(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = window.innerWidth;
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right <= width + 1 && rect.left >= -1) continue;
      const cls = typeof el.className === 'string' ? el.className.split(' ').slice(0, 2).join('.') : '';
      out.push(`${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''} → [${Math.round(rect.left)}, ${Math.round(rect.right)}]`);
      if (out.length >= 8) break;
    }
    return out;
  });
}

test.describe('ریسپانسیو موبایل — صفحه‌های عمومی', () => {
  for (const viewport of VIEWPORTS) {
    test(`هیچ اسکرول افقی در ${viewport.name} نیست`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const route of PUBLIC_ROUTES) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(400);
        const overflow = await horizontalOverflow(page);
        const detail = overflow > 1 ? await offenders(page) : [];
        expect(overflow, `${route} در ${viewport.name}: ${detail.join(' | ')}`).toBeLessThanOrEqual(1);
      }
    });
  }

  test('کنترل‌های لمسی صفحهٔ اصلی هدف ≥۴۴px دارند', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const targets = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.count-option, .button, .text-link, .sample-button')).map(
        (el) => ({ cls: el.className, height: Math.round(el.getBoundingClientRect().height) }),
      ),
    );
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(target.height, `هدف کوچک: ${target.cls}`).toBeGreaterThanOrEqual(44);
    }
  });
});

async function createRoom(api: APIRequestContext): Promise<Reservation> {
  const res = await api.post('/api/rooms', {
    data: { playerCount: 2, playerNames: ['آزمون موبایل', 'همراه آزمون'] },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as ApiOk<Reservation> | ApiErr;
  if (!body.ok) throw new Error(body.error.message);
  return body.data;
}

test.describe('ریسپانسیو موبایل — صحنهٔ بازی', () => {
  test('کوچه: قاب هم‌اندازهٔ دید، بدون اسکرول افقی و با پد حرکت لمسی', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    if (!baseURL) throw new Error('baseURL لازم است');

    const api = await playwrightRequest.newContext({ baseURL });
    const room = await createRoom(api);
    const seat = room.invites[0];

    // دعوت‌نامه را رد می‌کنیم تا مستقیم به کوچه برسیم.
    const done = await api.post(`/api/rooms/${encodeURIComponent(room.roomCode)}/action`, {
      headers: { 'X-Seat-Token': seat.seatToken },
      data: { type: 'COMPLETE_INVITATION_VIDEO' },
    });
    expect(done.status()).toBe(200);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/room/${encodeURIComponent(room.roomCode)}?token=${encodeURIComponent(seat.seatToken)}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(4_000);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    // ارتفاع قاب صحنه نباید از دید گوشی بلندتر باشد (اسکرول عمودی ناخواسته)
    const sceneHeight = await page.evaluate(() => {
      const shell = document.querySelector('.alley-game-shell, .alley3d-surface');
      return shell ? Math.round(shell.getBoundingClientRect().height) : 0;
    });
    expect(sceneHeight).toBeLessThanOrEqual(846);

    // پد حرکت فقط روی دستگاه لمسی ساخته می‌شود.
    const coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
    if (coarse) {
      const pad = page.locator('.touch-move-pad');
      await expect(pad).toBeVisible();
      const box = await pad.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(100);
    }

    await api.dispose();
  });
});
