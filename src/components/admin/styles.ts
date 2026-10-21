// src/components/admin/styles.ts — سبک‌های مشترک پنل ادمین (بدون وابستگی به Tailwind)
// طراحی ساده و کاربردی مطابق docs/features/admin-panel.md
import type { CSSProperties } from 'react';

export const panelStyle: CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: 'var(--space-4)',
};

export const pageStyle: CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: 'var(--space-5)',
  display: 'grid',
  gap: 'var(--space-4)',
};

export const titleStyle: CSSProperties = {
  fontSize: 'var(--text-lg)',
  color: 'var(--gold-light)',
  margin: 0,
};

export const hintStyle: CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--text-muted)',
  lineHeight: 'var(--leading-normal)',
};

export const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--text-sm)',
};

export const thStyle: CSSProperties = {
  textAlign: 'start',
  padding: '8px 10px',
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--line)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

export const tdStyle: CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid rgba(212, 175, 99, 0.08)',
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
};

export const buttonStyle: CSSProperties = {
  minHeight: 36,
  padding: '0 14px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--panel-light)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: 'var(--text-sm)',
};

export const dangerButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: 'rgba(143, 33, 50, 0.6)',
  color: 'var(--gold-light)',
  background: 'var(--wine)',
};

export const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 'var(--control-height)',
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--ink-soft)',
  color: 'var(--text-primary)',
  fontSize: 'var(--text-base)',
};

export const badgeStyle = (tone: 'ok' | 'warn' | 'off'): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 'var(--text-xs)',
  border: '1px solid var(--line)',
  color: tone === 'ok' ? '#a8e6b0' : tone === 'warn' ? 'var(--gold-light)' : 'var(--text-muted)',
  background: tone === 'ok' ? 'rgba(50, 120, 70, 0.18)' : 'transparent',
});

export const errorTextStyle: CSSProperties = {
  color: '#ffb4b4',
  fontSize: 'var(--text-sm)',
  margin: 0,
};
