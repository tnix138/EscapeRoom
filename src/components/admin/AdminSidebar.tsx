'use client';
// src/components/admin/AdminSidebar.tsx — سایدبار و خروج پنل ادمین (فاز ۰۹)
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminRole } from '@/contracts/admin';
import { buttonStyle } from './styles';

export type AdminSection =
  | 'dashboard'
  | 'rooms'
  | 'players'
  | 'characters'
  | 'updates'
  | 'errors';

const LINKS: ReadonlyArray<{ href: string; label: string; section: AdminSection }> = [
  { href: '/admin', label: 'داشبورد', section: 'dashboard' },
  { href: '/admin/rooms', label: 'اتاق‌ها', section: 'rooms' },
  { href: '/admin/players', label: 'بازیکنان', section: 'players' },
  { href: '/admin/characters', label: 'کاراکترها', section: 'characters' },
  { href: '/admin/updates', label: 'آپدیت‌ها', section: 'updates' },
  { href: '/admin/errors', label: 'خطاها', section: 'errors' },
];

export interface AdminSidebarProps {
  active: AdminSection;
  username: string;
  role: AdminRole;
}

const ROLE_LABELS: Record<AdminRole, string> = {
  superadmin: 'مدیر ارشد',
  moderator: 'ناظر',
  viewer: 'فقط‌خواندنی',
};

export default function AdminSidebar({ active, username, role }: AdminSidebarProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.replace('/admin/login');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <nav
      aria-label="منوی پنل ادمین"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        background: 'var(--ink-soft)',
      }}
    >
      <strong style={{ color: 'var(--gold)', marginInlineEnd: 'var(--space-2)' }}>
        پنل ادمین
      </strong>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={active === link.section ? 'page' : undefined}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 'var(--text-sm)',
            color: active === link.section ? 'var(--ink)' : 'var(--text-primary)',
            background: active === link.section ? 'var(--gold)' : 'transparent',
          }}
        >
          {link.label}
        </Link>
      ))}
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        {username} · {ROLE_LABELS[role]}
      </span>
      <button type="button" style={buttonStyle} onClick={logout} disabled={pending}>
        {pending ? 'در حال خروج…' : 'خروج'}
      </button>
    </nav>
  );
}
