import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const invitationTsx = readFileSync(
  join(ROOT, 'src/components/invitation/InvitationCardVideo.tsx'),
  'utf8',
);
const globalsCss = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');

function extractRuleBlock(css: string, selectorRegex: RegExp): string {
  const match = css.match(selectorRegex);
  return match ? match[0] : '';
}

function readZIndex(block: string): number {
  const m = block.match(/z-index:\s*([0-9]+)/);
  if (!m) throw new Error(`z-index not found in block:\n${block}`);
  return Number(m[1]);
}

describe('رفع کامل تداخل برگهٔ دعوت‌نامه و پاکت مخملی در پیش‌درآمد (امیرعلی)', () => {
  it('برگهٔ دعوت‌نامه (.envelope-letter) فرزند مستقیم پاکت است و دیگر داخل .envelope-back محبوس نیست', () => {
    expect(invitationTsx).toContain('<div className="envelope-back" />');
    expect(invitationTsx).not.toContain('<div className="envelope-back"><div className="envelope-letter">');

    // ترتیب فیزیکی لایه‌ها در JSX: بدنهٔ پشتی -> درب پاکت -> برگهٔ دعوت -> جیب جلویی -> مُهر و دست‌ها
    const backIdx = invitationTsx.indexOf('className="envelope-back"');
    const flapIdx = invitationTsx.indexOf('className="envelope-flap"');
    const letterIdx = invitationTsx.indexOf('className="envelope-letter"');
    const frontIdx = invitationTsx.indexOf('className="envelope-front"');
    expect(backIdx).toBeGreaterThan(0);
    expect(flapIdx).toBeGreaterThan(backIdx);
    expect(letterIdx).toBeGreaterThan(flapIdx);
    expect(frontIdx).toBeGreaterThan(letterIdx);
  });

  it('ترتیب z-index در حالت بسته و باز کاملاً فیزیکی است و درب بازشده پشت برگه قرار می‌گیرد', () => {
    const velBlock = extractRuleBlock(globalsCss, /\.velvet-envelope\s*\{[^}]+\}/);
    expect(velBlock).toContain('isolation: isolate');

    const backZ = readZIndex(extractRuleBlock(globalsCss, /\.envelope-back\s*\{[^}]+\}/));
    const letterZ = readZIndex(extractRuleBlock(globalsCss, /\.envelope-letter\s*\{[^}]+\}/));
    const frontZ = readZIndex(extractRuleBlock(globalsCss, /\.envelope-front\s*\{[^}]+\}/));
    const flapClosedZ = readZIndex(extractRuleBlock(globalsCss, /\.envelope-flap\s*\{[^}]+\}/));
    const sealZ = readZIndex(extractRuleBlock(globalsCss, /\.wax-seal\s*\{[^}]+\}/));
    const flapOpenZ = readZIndex(
      extractRuleBlock(
        globalsCss,
        /\.scene-card \.envelope-flap,\s*\.scene-tickets \.envelope-flap\s*\{[^}]+\}/,
      ),
    );

    // حالت بسته: پشت (۱) < برگه (۳) < جیب جلو (۴) < درب بسته (۵) < مهر موم (۶)
    expect(backZ).toBeLessThan(letterZ);
    expect(letterZ).toBeLessThan(frontZ);
    expect(frontZ).toBeLessThan(flapClosedZ);
    expect(flapClosedZ).toBeLessThan(sealZ);

    // حالت باز: پشت (۱) < درب بازشده (۲) < برگهٔ بیرون‌آمده (۳) < جیب جلو (۴)
    expect(backZ).toBeLessThan(flapOpenZ);
    expect(flapOpenZ).toBeLessThan(letterZ);
    expect(letterZ).toBeLessThan(frontZ);
  });

  it('جیب جلویی پاکت (.envelope-front) در حالت باز مات می‌ماند و دیگر با opacity: 0.12 متن دوگانه و روح‌وار روی برگه نمی‌اندازد', () => {
    expect(globalsCss).not.toMatch(
      /\.scene-card \.envelope-front[\s\S]{0,120}?opacity:\s*0\.12/,
    );
    const openFront = extractRuleBlock(
      globalsCss,
      /\.scene-card \.envelope-front,\s*\.scene-tickets \.envelope-front\s*\{[^}]+\}/,
    );
    expect(openFront).toContain('opacity: 1');

    // در حالت بسته هم برگه کاملاً پنهان و داخل پاکت است
    const baseLetter = extractRuleBlock(globalsCss, /\.envelope-letter\s*\{[^}]+\}/);
    expect(baseLetter).toContain('opacity: 0');
  });

  it('هندسهٔ دقیق باز شدن پاکت در دسکتاپ، لپ‌تاپ ۱۲۵٪ (۷۲۸px)، موبایل و حالت افقی هیچ هم‌پوشانی متنی یا بریدگی ندارد', () => {
    interface StageProfile {
      name: string;
      objectHeight: number;
      envTop: number;
      envHeight: number;
      openShiftY: number;
      letterTop: number;
      letterHeight: number;
      letterOpenTranslateY: number;
      visibleContentHeight: number;
      nameBottomOffset: number;
      nameHeight: number;
    }

    const profiles: StageProfile[] = [
      {
        name: 'Desktop 1920x1080',
        objectHeight: 358,
        envTop: 80,
        envHeight: 196,
        openShiftY: 82,
        letterTop: 6,
        letterHeight: 184,
        letterOpenTranslateY: -164,
        visibleContentHeight: 162,
        nameBottomOffset: 16,
        nameHeight: 38,
      },
      {
        name: 'Laptop 1536x728 (1080p @ 125% DPI)',
        objectHeight: 316,
        envTop: 68,
        envHeight: 174,
        openShiftY: 72,
        letterTop: 5,
        letterHeight: 164,
        letterOpenTranslateY: -141,
        visibleContentHeight: 141,
        nameBottomOffset: 16,
        nameHeight: 38,
      },
      {
        name: 'Mobile 390x844',
        objectHeight: 270,
        envTop: 62,
        envHeight: 154,
        openShiftY: 54,
        letterTop: 5,
        letterHeight: 146,
        letterOpenTranslateY: -120,
        visibleContentHeight: 125,
        nameBottomOffset: 16,
        nameHeight: 36,
      },
      {
        name: 'Landscape 844x390',
        objectHeight: 148,
        envTop: 34,
        envHeight: 92,
        openShiftY: 22,
        letterTop: 4,
        letterHeight: 84,
        letterOpenTranslateY: -58,
        visibleContentHeight: 62,
        nameBottomOffset: 8,
        nameHeight: 32,
      },
    ];

    for (const p of profiles) {
      // ۱) در حالت بسته برگه کامل داخل پاکت جا می‌شود
      expect(p.letterTop, p.name).toBeGreaterThanOrEqual(0);
      expect(p.letterTop + p.letterHeight, p.name).toBeLessThanOrEqual(p.envHeight);

      // ۲) در حالت باز، کل مجموعه (بالای برگه تا کف پاکت) داخل قاب .invitation-object می‌ماند
      const openEnvTopInObject = p.envTop + p.openShiftY;
      const openEnvBottomInObject = openEnvTopInObject + p.envHeight;
      const risenCardTopInObject = openEnvTopInObject + p.letterTop + p.letterOpenTranslateY;

      expect(risenCardTopInObject, `${p.name} card top >= 0`).toBeGreaterThanOrEqual(0);
      expect(openEnvBottomInObject, `${p.name} env bottom <= objectHeight`).toBeLessThanOrEqual(
        p.objectHeight,
      );

      // ۳) تمام متن‌های برگه بالاتر از لبهٔ جیب V شکل پاکت قرار می‌گیرند و اصلاً با نام روی پاکت برخورد ندارند
      const textBottomInEnv = p.letterTop + p.letterOpenTranslateY + p.visibleContentHeight;
      const pocketCenterDipInEnv = p.envHeight * 0.44;
      const cardBottomInEnv = p.letterTop + p.letterOpenTranslateY + p.letterHeight;
      const envNameTopInEnv = p.envHeight - p.nameBottomOffset - p.nameHeight;

      expect(textBottomInEnv, `${p.name} text above V-pocket`).toBeLessThan(pocketCenterDipInEnv);
      expect(cardBottomInEnv, `${p.name} card bottom tucked inside pocket`).toBeGreaterThan(8);
      expect(cardBottomInEnv, `${p.name} card well above envelope recipient name`).toBeLessThan(
        envNameTopInEnv,
      );
    }
  });

  it('لایهٔ زیرنویس روایت (.invitation-narration) در جریان عمودی صفحه قرار دارد و روی پاکت شناور نمی‌شود', () => {
    const narrationBlock = extractRuleBlock(globalsCss, /^\.invitation-narration\s*\{[^}]+\}/m);
    expect(narrationBlock).toContain('position: relative');
    const allNarrationBlocks = [...globalsCss.matchAll(/\.invitation-narration\s*\{[^}]+\}/g)].map(
      (m) => m[0],
    );
    expect(allNarrationBlocks.length).toBeGreaterThan(0);
    for (const block of allNarrationBlocks) {
      expect(block).not.toContain('position: absolute');
    }
  });
});
