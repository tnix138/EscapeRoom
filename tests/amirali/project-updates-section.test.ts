import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  useRouter: () => ({ replace: () => undefined, refresh: () => undefined, push: () => undefined }),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

import HomePage from '../../src/app/page';
import AdminUpdatesPage from '../../src/app/admin/updates/page';
import AdminSidebar from '../../src/components/admin/AdminSidebar';
import AdminUpdatesExplorer from '../../src/components/admin/AdminUpdatesExplorer';
import LandingUpdatesSection from '../../src/components/updates/LandingUpdatesSection';
import { loadAdminUpdatesOverview } from '../../src/updates/changelog-loader';
import {
  PUBLIC_UPDATES,
  PUBLIC_UPDATE_FILTERS,
  SUBSYSTEM_META,
  parseChangelogMarkdown,
} from '../../src/updates/project-updates';

const ROOT = path.resolve(__dirname, '../..');

describe('بخش «آپدیت‌ها» — نسخهٔ کلی در صفحهٔ اصلی و نسخهٔ کامل فنی در پنل ادمین', () => {
  it('صفحهٔ اصلی سکشن آپدیت‌ها و لینک دسترسی سریع هدر را با متن کلی و بدون اصطلاحات کد رندر می‌کند', () => {
    expect(PUBLIC_UPDATES.length).toBeGreaterThanOrEqual(5);
    expect(PUBLIC_UPDATE_FILTERS.length).toBe(4);

    // متن‌های صفحهٔ اصلی باید کلی و کاربرپسند باشند (بدون مسیر فایل‌های کد مثل src/ یا .tsx)
    for (const item of PUBLIC_UPDATES) {
      const combined = `${item.title} ${item.summary} ${item.highlights.join(' ')}`;
      expect(combined).not.toMatch(/\bsrc\/|\btests\/|\.(?:ts|tsx|mjs|css)\b/);
    }

    const landingHtml = renderToStaticMarkup(createElement(LandingUpdatesSection));
    expect(landingHtml).toContain('id="updates"');
    expect(landingHtml).toContain('آخرین آپدیت‌ها و بهبودهای بازی');
    expect(landingHtml).toContain('جدیدترین آپدیت');
    expect(landingHtml).toContain('مشاهدهٔ همهٔ آپدیت‌ها');

    const homeHtml = renderToStaticMarkup(createElement(HomePage));
    expect(homeHtml).toContain('href="#updates"');
    expect(homeHtml).toContain('class="updates-section"');
  });

  it('استایل بخش آپدیت‌ها با تم مخمل سرخ و طلایی سایت، فوکوس کیبورد و موبایل هماهنگ است', () => {
    const css = readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');
    expect(css).toContain('.updates-section');
    expect(css).toContain('.update-card.is-latest');
    expect(css).toContain('.updates-filter-pill.is-active');
    expect(css).toContain('.topbar-updates-link');
    expect(css).toContain('var(--gold-light)');
  });

  it('تحلیل‌گر CHANGELOG تمام آپدیت‌های فنی، زیربولت‌ها، فایل‌های src/ و تست‌های tests/ را استخراج می‌کند', () => {
    const overview = loadAdminUpdatesOverview();
    expect(overview.totalEntries).toBeGreaterThanOrEqual(25);
    expect(overview.fixedCount).toBeGreaterThan(10);
    expect(overview.addedCount).toBeGreaterThan(5);
    expect(overview.uniqueFilesCount).toBeGreaterThan(15);
    expect(overview.uniqueTestFilesCount).toBeGreaterThan(10);
    expect(overview.checklist.length).toBeGreaterThan(0);

    // بررسی پارس دقیق ورودی نمونه با بولت تودرتو و مسیر کد
    const sample = parseChangelogMarkdown(`## [منتشرنشده]
### اصلاح شد
**رفع باگ نمونه در شبکه**
- بهینه‌سازی استریم در \`src/client-sdk/shared-room-stream.ts\`
  - کاهش اتصالات باز به یک استریم مشترک
- تست تازه: \`tests/amirali/whisper-send-unstuck.test.ts\`

### باقی‌مانده برای انتشار
- [x] اجرای تست‌های واحد
- [ ] تنظیم کلید تولیدی
`);
    expect(sample.totalEntries).toBe(1);
    expect(sample.updates[0]?.bullets[0]?.subItems).toEqual([
      'کاهش اتصالات باز به یک استریم مشترک',
    ]);
    expect(sample.updates[0]?.touchedFiles).toContain(
      'src/client-sdk/shared-room-stream.ts',
    );
    expect(sample.updates[0]?.testFiles).toContain(
      'tests/amirali/whisper-send-unstuck.test.ts',
    );
    expect(sample.updates[0]?.subsystems).toContain('multiplayer');
    expect(sample.checklist).toEqual([
      { done: true, text: 'اجرای تست‌های واحد' },
      { done: false, text: 'تنظیم کلید تولیدی' },
    ]);
  });

  it('پنل ادمین لینک سایدبار، اکسپلورر پرجزئیات فنی و محافظ احراز هویت /admin/updates را دارد', async () => {
    const sidebarHtml = renderToStaticMarkup(
      createElement(AdminSidebar, {
        active: 'updates',
        username: 'amirali',
        role: 'superadmin',
      }),
    );
    expect(sidebarHtml).toContain('href="/admin/updates"');
    expect(sidebarHtml).toContain('آپدیت‌ها');
    expect(sidebarHtml).toContain('aria-current="page"');

    const overview = loadAdminUpdatesOverview();
    const explorerHtml = renderToStaticMarkup(
      createElement(AdminUpdatesExplorer, { overview }),
    );
    expect(explorerHtml).toContain('تفکیک آپدیت‌ها بر اساس زیرسیستم فنی');
    expect(explorerHtml).toContain('جزئیات فنی، معماری و تغییرات پیاده‌سازی');
    expect(explorerHtml).toContain('فایل‌ها و ماژول‌های تغییریافته');
    expect(explorerHtml).toContain('تست‌های تضمین کیفیت');
    for (const meta of Object.values(SUBSYSTEM_META)) {
      expect(explorerHtml).toContain(meta.label);
    }

    // بدون کوکی ادمین، صفحهٔ /admin/updates باید به /admin/login هدایت شود
    await expect(AdminUpdatesPage()).rejects.toThrow('REDIRECT:/admin/login');
  });
});
