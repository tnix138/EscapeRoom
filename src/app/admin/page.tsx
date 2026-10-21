// src/app/admin/page.tsx — داشبورد آمار پنل ادمین (فاز ۱۰)
import Link from 'next/link';
import AdminSidebar from '@/components/admin/AdminSidebar';
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
    </main>
  );
}
