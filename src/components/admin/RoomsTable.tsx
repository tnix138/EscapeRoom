// src/components/admin/RoomsTable.tsx — جدول اتاق‌های فعال (فاز ۱۰)
import type { RoomSummary } from '@/contracts/admin';
import { faDigits, formatRelative, phaseLabel } from './format';
import { badgeStyle, hintStyle, tableStyle, tdStyle, thStyle } from './styles';

export interface RoomsTableProps {
  rooms: readonly RoomSummary[];
  now: number;
}

export default function RoomsTable({ rooms, now }: RoomsTableProps) {
  if (rooms.length === 0) {
    return <p style={hintStyle}>هنوز اتاقی ساخته نشده است.</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <caption style={{ ...hintStyle, textAlign: 'start', paddingBottom: 8 }}>
          {faDigits(rooms.length)} اتاق، جدیدترین فعالیت اول
        </caption>
        <thead>
          <tr>
            <th scope="col" style={thStyle}>کد اتاق</th>
            <th scope="col" style={thStyle}>فاز</th>
            <th scope="col" style={thStyle}>بازیکنان</th>
            <th scope="col" style={thStyle}>آنلاین</th>
            <th scope="col" style={thStyle}>نسخه</th>
            <th scope="col" style={thStyle}>آخرین فعالیت</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.code}>
              <td style={{ ...tdStyle, fontFamily: 'monospace', letterSpacing: 1 }}>
                <bdi>{room.code}</bdi>
              </td>
              <td style={tdStyle}>{phaseLabel(room.phase)}</td>
              <td style={tdStyle}>
                {faDigits(room.occupiedSeats)} از {faDigits(room.playerCount)}
              </td>
              <td style={tdStyle}>
                <span style={badgeStyle(room.onlineCount > 0 ? 'ok' : 'off')}>
                  {faDigits(room.onlineCount)} نفر
                </span>
              </td>
              <td style={tdStyle}>{faDigits(room.version)}</td>
              <td style={tdStyle}>{formatRelative(room.updatedAt, now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
