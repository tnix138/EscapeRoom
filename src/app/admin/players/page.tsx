// src/app/admin/players/page.tsx — لیست بازیکنان و حذف بازیکن (فاز ۱۰ و ۱۳)
import AdminSidebar from '@/components/admin/AdminSidebar';
import PlayersTable from '@/components/admin/PlayersTable';
import { pageStyle, panelStyle, titleStyle } from '@/components/admin/styles';
import { canModerate } from '@/contracts/admin';
import { loadAdminPlayers } from '@/server/admin/queries';
import { getRoomRepository } from '@/server/db/repository';
import { requireAdminPage } from '../guard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'بازیکنان | پنل ادمین' };

export default async function AdminPlayersPage() {
  const session = await requireAdminPage();
  const now = Date.now();
  const players = await loadAdminPlayers(getRoomRepository(), now);

  return (
    <main style={pageStyle}>
      <AdminSidebar active="players" username={session.username} role={session.role} />
      <section style={panelStyle}>
        <h1 style={titleStyle}>بازیکنان</h1>
        <PlayersTable players={players} now={now} canModerate={canModerate(session.role)} />
      </section>
    </main>
  );
}
