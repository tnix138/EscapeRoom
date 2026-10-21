// src/components/admin/StatsCard.tsx — کارت آمار داشبورد ادمین (فاز ۱۰)
import { panelStyle, hintStyle } from './styles';

export interface StatsCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warn';
}

export default function StatsCard({ label, value, hint, tone = 'default' }: StatsCardProps) {
  return (
    <div style={{ ...panelStyle, display: 'grid', gap: 6 }}>
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: tone === 'warn' ? 'var(--gold-light)' : 'var(--text-secondary)',
        }}
      >
        {label}
      </span>
      <strong style={{ fontSize: '1.75rem', color: 'var(--cream)', lineHeight: 1.2 }}>
        {value}
      </strong>
      {hint ? <span style={hintStyle}>{hint}</span> : null}
    </div>
  );
}
