// src/app/admin/characters/page.tsx — نمایشگاه کامل کاراکترهای بازی در پنل ادمین
import AdminSidebar from '@/components/admin/AdminSidebar';
import CharactersShowcase from '@/components/admin/CharactersShowcase';
import { pageStyle, titleStyle } from '@/components/admin/styles';
import { loadAdminPlayers } from '@/server/admin/queries';
import { getRoomRepository } from '@/server/db/repository';
import { requireAdminPage } from '../guard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'کاراکترها | پنل ادمین' };

export default async function AdminCharactersPage() {
  const session = await requireAdminPage();
  const now = Date.now();
  const players = await loadAdminPlayers(getRoomRepository(), now);

  return (
    <main style={pageStyle}>
      <AdminSidebar active="characters" username={session.username} role={session.role} />
      <h1 style={{ ...titleStyle, fontSize: '1.375rem' }}>کاراکترهای بازی (پلیرها و صحنه)</h1>
      <CharactersShowcase players={players} />
    </main>
  );
}
