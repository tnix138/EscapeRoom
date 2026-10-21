// src/app/admin/rooms/page.tsx — لیست اتاق‌های فعال (فاز ۱۰)
import AdminSidebar from '@/components/admin/AdminSidebar';
import RoomsTable from '@/components/admin/RoomsTable';
import { pageStyle, panelStyle, titleStyle } from '@/components/admin/styles';
import { loadAdminRooms } from '@/server/admin/queries';
import { getRoomRepository } from '@/server/db/repository';
import { requireAdminPage } from '../guard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'اتاق‌ها | پنل ادمین' };

export default async function AdminRoomsPage() {
  const session = await requireAdminPage();
  const now = Date.now();
  const rooms = await loadAdminRooms(getRoomRepository(), now);

  return (
    <main style={pageStyle}>
      <AdminSidebar active="rooms" username={session.username} role={session.role} />
      <section style={panelStyle}>
        <h1 style={titleStyle}>اتاق‌های فعال</h1>
        <RoomsTable rooms={rooms} now={now} />
      </section>
    </main>
  );
}
