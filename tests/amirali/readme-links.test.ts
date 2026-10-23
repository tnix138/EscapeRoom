import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const README_PATH = join(ROOT, 'README.md');

describe('README.md — نمایش کامل و صحت تمام لینک‌های پروژه', () => {
  const readme = readFileSync(README_PATH, 'utf8');

  it('تمام لینک‌های نسبی به فایل‌های واقعی داخل مخزن اشاره می‌کنند', () => {
    const markdownLinkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
    const relativeTargets: string[] = [];

    for (const match of readme.matchAll(markdownLinkRegex)) {
      const href = match[1]?.trim() ?? '';
      expect(href.length).toBeGreaterThan(0);

      if (href.startsWith('./')) {
        const cleanRel = href.slice(2).split('#')[0]!;
        relativeTargets.push(cleanRel);
        expect(
          existsSync(join(ROOT, cleanRel)),
          `مسیر نسبی ناموجود در README.md: ${href}`,
        ).toBe(true);
      } else {
        expect(
          href.startsWith('https://') || href.startsWith('http://'),
          `لینک نامعتبر در README.md: ${href}`,
        ).toBe(true);
      }
    }

    expect(relativeTargets.length).toBeGreaterThanOrEqual(25);
  });

  it('تمام مسیرهای بازی، پیش‌نمایش‌های سه‌بعدی، پنل ادمین، API و گیت‌هاب به صورت لینک قابل کلیک حضور دارند', () => {
    const requiredClickableUrls = [
      'https://escaperoom-orfeo.vercel.app',
      'https://escaperoom-orfeo.vercel.app/',
      'https://escaperoom-orfeo.vercel.app/#updates',
      'https://escaperoom-orfeo.vercel.app/manifest.webmanifest',
      'https://escaperoom-orfeo.vercel.app/preview/invitation',
      'https://escaperoom-orfeo.vercel.app/preview/alley',
      'https://escaperoom-orfeo.vercel.app/preview/alley?mode=css',
      'https://escaperoom-orfeo.vercel.app/preview/cinema',
      'https://escaperoom-orfeo.vercel.app/preview/auditorium',
      'https://escaperoom-orfeo.vercel.app/preview/characters',
      'https://escaperoom-orfeo.vercel.app/preview/performance',
      'https://escaperoom-orfeo.vercel.app/qa/exploration',
      'https://escaperoom-orfeo.vercel.app/admin/login',
      'https://escaperoom-orfeo.vercel.app/admin',
      'https://escaperoom-orfeo.vercel.app/admin/rooms',
      'https://escaperoom-orfeo.vercel.app/admin/players',
      'https://escaperoom-orfeo.vercel.app/admin/errors',
      'https://escaperoom-orfeo.vercel.app/admin/characters',
      'https://escaperoom-orfeo.vercel.app/admin/updates',
      'https://escaperoom-orfeo.vercel.app/api/health',
      'https://escaperoom-orfeo.vercel.app/api/admin/session',
      'https://github.com/tnix138/EscapeRoom',
      'https://github.com/tnix138/EscapeRoom/actions',
      'https://github.com/tnix138/EscapeRoom/pulls',
      'https://github.com/tnix138/EscapeRoom/issues',
    ];

    for (const url of requiredClickableUrls) {
      expect(readme).toContain(`(${url})`);
    }
  });
});
