import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTROL_HELP_ROWS, isControlHelpRoute } from '@/components/alley/controls-help-data';

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
const css = read('../../src/app/globals.css');
const layout = read('../../src/app/layout.tsx');

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

describe('راهنمای کنترل‌های کوچه — موج ۳', () => {
  it('فقط در مسیرهای بازی نمایش داده می‌شود', () => {
    expect(isControlHelpRoute('/room/ABC123')).toBe(true);
    expect(isControlHelpRoute('/preview/alley')).toBe(true);
    expect(isControlHelpRoute('/preview/alley/')).toBe(false);
    expect(isControlHelpRoute('/')).toBe(false);
    expect(isControlHelpRoute('/preview/invitation')).toBe(false);
    expect(isControlHelpRoute('/room')).toBe(false);
    expect(isControlHelpRoute(null)).toBe(false);
  });

  it('همهٔ کنترل‌های ضروری حرکت را با برچسب فارسی پوشش می‌دهد', () => {
    const keys = CONTROL_HELP_ROWS.flatMap((row) => row.keys);
    for (const key of ['W', 'A', 'S', 'D', '↑', '↓', 'Shift', 'E', 'Esc', 'H', 'ماوس', '← →']) {
      expect(keys, key).toContain(key);
    }
    expect(CONTROL_HELP_ROWS.every((row) => row.label.trim().length > 8)).toBe(true);
  });

  it('در ریشهٔ برنامه سوار می‌شود تا روی صحنهٔ سه‌بعدی هم دیده شود', () => {
    expect(layout).toContain('@/components/alley/ControlsHelpOverlay');
    expect(layout).toContain('<ControlsHelpOverlay />');
  });

  it('کنترل‌های راهنما اندازهٔ لمسی و متن خوانا دارند', () => {
    expect(block('.controls-help-trigger')).toContain('min-height: 44px');
    expect(block('.controls-help-close')).toContain('width: 44px');
    expect(block('.controls-help-close')).toContain('height: 44px');
    expect(block('.controls-help kbd')).toContain('font-size: var(--text-sm)');
    expect(block('.controls-help-list li')).toContain('font-size: var(--text-sm)');
    expect(block('.controls-help-desc')).toContain('font-size: var(--text-sm)');
    expect(block('.controls-help')).toContain('max-height: min(72vh, 470px)');
  });

  it('راهنما زیر مودال قفل در می‌ماند و با موبایل هم‌اندازه می‌شود', () => {
    const panelZ = Number(/z-index:\s*(\d+)/.exec(block('.controls-help'))?.[1] ?? 0);
    const doorZ = Number(/z-index:\s*(\d+)/.exec(block('.door-modal-backdrop'))?.[1] ?? 0);
    expect(panelZ).toBeGreaterThan(12);
    expect(doorZ).toBeGreaterThan(panelZ);
    expect(css).toContain('@media (max-width: 680px)');
    expect(css).toContain('.controls-help-trigger {\n    bottom: 14px;');
  });
});
