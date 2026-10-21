// src/components/admin/ErrorsTable.tsx — جدول خطاهای سرور با زمان و کد (فاز ۱۳)
import type { AdminEvent } from '@/contracts/admin';
import { faDigits, formatClock, formatRelative } from './format';
import { hintStyle, tableStyle, tdStyle, thStyle } from './styles';

export interface ErrorsTableProps {
  errors: readonly AdminEvent[];
  now: number;
}

function errorCodeOf(event: AdminEvent): string {
  const code = event.payload.code ?? event.payload.errorCode;
  return typeof code === 'string' && code.length > 0 ? code : 'UNKNOWN';
}

function errorMessageOf(event: AdminEvent): string {
  const message = event.payload.message ?? event.payload.reason;
  return typeof message === 'string' && message.length > 0 ? message : 'بدون توضیح';
}

export default function ErrorsTable({ errors, now }: ErrorsTableProps) {
  if (errors.length === 0) {
    return <p style={hintStyle}>هیچ خطای ثبت‌شده‌ای وجود ندارد. 🎉</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <caption style={{ ...hintStyle, textAlign: 'start', paddingBottom: 8 }}>
          {faDigits(errors.length)} خطای آخر، جدیدترین اول
        </caption>
        <thead>
          <tr>
            <th scope="col" style={thStyle}>زمان</th>
            <th scope="col" style={thStyle}>کد</th>
            <th scope="col" style={thStyle}>اتاق</th>
            <th scope="col" style={thStyle}>توضیح</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((event) => (
            <tr key={event.id}>
              <td style={tdStyle} title={formatRelative(event.createdAt, now)}>
                {formatClock(event.createdAt)}
              </td>
              <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                <bdi>{errorCodeOf(event)}</bdi>
              </td>
              <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                <bdi>{event.roomCode ?? '—'}</bdi>
              </td>
              <td style={{ ...tdStyle, whiteSpace: 'normal' }}>{errorMessageOf(event)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
