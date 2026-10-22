import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { previewModeFromParam } from '@/app/preview/alley/preview-mode';

const root = join(__dirname, '..', '..');
const pageSource = readFileSync(join(root, 'src/app/preview/alley/page.tsx'), 'utf8');
const componentSource = readFileSync(join(root, 'src/app/preview/alley/PreviewAlley.tsx'), 'utf8');

describe('حالت شروع پیش‌نمایش کوچه', () => {
  it('با ?mode=css نمای کلاسیک را انتخاب می‌کند', () => {
    expect(previewModeFromParam('css')).toBe('css');
  });

  it('پیش‌فرض سه‌بعدی است و مقدار ناشناخته هم سه‌بعدی می‌ماند', () => {
    expect(previewModeFromParam(undefined)).toBe('three');
    expect(previewModeFromParam('three')).toBe('three');
    expect(previewModeFromParam('')).toBe('three');
    expect(previewModeFromParam('classic')).toBe('three');
    expect(previewModeFromParam('CSS')).toBe('three');
  });

  it('آرایهٔ پارامتر را می‌خواند و اولین مقدار را می‌سنجد', () => {
    expect(previewModeFromParam(['css'])).toBe('css');
    expect(previewModeFromParam(['css', 'three'])).toBe('css');
    expect(previewModeFromParam(['three', 'css'])).toBe('three');
    expect(previewModeFromParam([])).toBe('three');
  });

  it('صفحهٔ پیش‌نمایش پارامتر را از آدرس می‌خواند و به کامپوننت می‌دهد', () => {
    expect(pageSource).toContain("mode?: string | string[]");
    expect(pageSource).toContain('previewModeFromParam(query.mode)');
    expect(pageSource).toContain('initialMode={initialMode}');
  });

  it('کامپوننت حالت اولیه را می‌پذیرد و پیش‌فرضش سه‌بعدی است', () => {
    expect(componentSource).toContain("initialMode = 'three'");
    expect(componentSource).toContain('useState<AlleyPreviewMode>(initialMode)');
    expect(componentSource).toContain("setMode('css')");
  });

  it('ورودی نامعتبر هرگز صفحهٔ خالی نمی‌سازد', () => {
    const values = [undefined, null, 'x', 'css ', ' css', 'Css', 'three', ['x']];
    for (const value of values) {
      const mode = previewModeFromParam(value as string | string[] | undefined);
      expect(['css', 'three']).toContain(mode);
    }
  });
});
