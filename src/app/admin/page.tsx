// src/app/admin/page.tsx — داشبورد آمار پنل ادمین (فاز ۱۰)
import Link from 'next/link';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { PLAYER_CHARACTER_PRESETS } from '@/components/admin/character-presets';
import StatsCard from '@/components/admin/StatsCard';
import RoomsTable from '@/components/admin/RoomsTable';
import { faDigits, formatPercent, phaseLabel } from '@/components/admin/format';
import { hintStyle, pageStyle, panelStyle, titleStyle } from '@/components/admin/styles';
import type { GamePhase } from '@/contracts/types';
import { loadAdminRooms, loadAdminStats } from '@/server/admin/queries';
import { getRoomRepository } from '@/server/db/repository';
import { requireAdminPage } from './guard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'داشبورد ادمین | پردهٔ سرخ' };

const PHASES: GamePhase[] = ['alley_puzzle', 'door_cutscene', 'theater_cutscene', 'in_theater'];

export default async function AdminDashboardPage() {
  const session = await requireAdminPage();
  const repo = getRoomRepository();
  const now = Date.now();
  const [stats, rooms] = await Promise.all([loadAdminStats(repo, now), loadAdminRooms(repo, now, 5)]);

  return (
    <main style={pageStyle}>
      <AdminSidebar active="dashboard" username={session.username} role={session.role} />

      <h1 style={{ ...titleStyle, fontSize: '1.375rem' }}>داشبورد آمار</h1>

      <section
        aria-label="آمار کلی"
        style={{ display: 'grid', gap: 'var(--space-3)', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
      >
        <StatsCard label="اتاق‌ها" value={faDigits(stats.rooms)} hint="اتاق‌های ساخته‌شده" />
        <StatsCard
          label="بازیکنان"
          value={faDigits(stats.players)}
          hint={`${faDigits(stats.online)} نفر آنلاین`}
        />
        <StatsCard
          label="نرخ خطا"
          value={formatPercent(stats.errorRate)}
          hint={`${faDigits(stats.errors)} خطا از ${faDigits(stats.events)} رویداد`}
          tone={stats.errorRate > 0.1 ? 'warn' : 'default'}
        />
        <StatsCard
          label="رویدادها"
          value={faDigits(stats.events)}
          hint="رویدادهای ثبت‌شده در admin_events"
        />
      </section>

      <section aria-label="پراکندگی فازها" style={panelStyle}>
        <h2 style={titleStyle}>پراکندگی فازها</h2>
        <ul style={{ ...hintStyle, listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 6 }}>
          {PHASES.map((phase) => (
            <li key={phase}>
              {phaseLabel(phase)}: <strong>{faDigits(stats.phases[phase])}</strong> اتاق
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="آخرین اتاق‌ها" style={panelStyle}>
        <h2 style={titleStyle}>آخرین اتاق‌ها</h2>
        <RoomsTable rooms={rooms} now={now} />
        <p style={{ ...hintStyle, marginTop: 8 }}>
          <Link href="/admin/rooms" style={{ color: 'var(--gold-light)' }}>
            همهٔ اتاق‌ها →
          </Link>
        </p>
      </section>

      <section aria-label="کاراکترهای بازی" style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={titleStyle}>کاراکترهای پلیر و صحنه</h2>
          <Link href="/admin/characters" style={{ color: 'var(--gold-light)', fontSize: 'var(--text-sm)' }}>
            استودیوی سه‌بعدی و نمایش کامل کاراکترها →
          </Link>
        </div>
        <p style={{ ...hintStyle, marginTop: 6 }}>
          ۸ تیپ کاراکتر انسان برای صندلی‌های ۱ تا ۸ (با مدل سه‌بعدی مفصل‌دار، انیمیشن راه رفتن/نشستن و نیم‌تنهٔ دوبعدی):
        </p>
        <div
          style={{
            display: 'grid',
            gap: 8,
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            marginTop: 10,
          }}
        >
          {PLAYER_CHARACTER_PRESETS.map((preset) => (
            <Link
              key={preset.seatIndex}
              href="/admin/characters"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--ink-soft)',
                textDecoration: 'none',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-xs)',
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: preset.coatHex,
                  border: '1px solid rgba(255,255,255,0.35)',
                  flexShrink: 0,
                }}
              />
              <span>
                <strong>{preset.archetypeName}</strong> · کت {preset.coatLabel}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
