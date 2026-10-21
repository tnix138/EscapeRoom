'use client';
// src/components/admin/PlayersTable.tsx — جدول بازیکنان + حذف بازیکن (فاز ۱۰ و ۱۳)
// حذف واقعی در سرور انجام می‌شود: توکن صندلی باطل و صندلی آزاد می‌شود.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminPlayerView } from '@/contracts/admin';
import { faDigits, formatClock, formatRelative, phaseLabel } from './format';
import {
  badgeStyle,
  dangerButtonStyle,
  errorTextStyle,
  hintStyle,
  tableStyle,
  tdStyle,
  thStyle,
} from './styles';

export interface PlayersTableProps {
  players: readonly AdminPlayerView[];
  now: number;
  canModerate: boolean;
}

interface RemoveState {
  pendingId: string | null;
  error: string | null;
  notice: string | null;
}

export default function PlayersTable({ players, now, canModerate }: PlayersTableProps) {
  const router = useRouter();
  const [state, setState] = useState<RemoveState>({
    pendingId: null,
    error: null,
    notice: null,
  });

  async function removePlayer(player: AdminPlayerView) {
    if (!canModerate) return;
    const confirmed = window.confirm(
      `بازیکن «${player.playerName}» از اتاق ${player.roomCode} حذف شود؟ این کار برگشت‌پذیر نیست.`,
    );
    if (!confirmed) return;

    setState({ pendingId: player.playerId, error: null, notice: null });
    try {
      const res = await fetch(`/api/admin/players/${encodeURIComponent(player.playerId)}`, {
        method: 'DELETE',
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || payload.ok !== true) {
        setState({
          pendingId: null,
          error: payload.error?.message || 'حذف بازیکن ناموفق بود.',
          notice: null,
        });
        return;
      }
      setState({
        pendingId: null,
        error: null,
        notice: `«${player.playerName}» از اتاق ${player.roomCode} حذف شد.`,
      });
      router.refresh();
    } catch {
      setState({
        pendingId: null,
        error: 'ارتباط با سرور برقرار نشد.',
        notice: null,
      });
    }
  }

  if (players.length === 0) {
    return <p style={hintStyle}>هنوز بازیکنی در اتاق‌ها نیست.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      {state.error ? (
        <p role="alert" style={errorTextStyle}>
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" style={{ ...hintStyle, color: 'var(--gold-light)' }}>
          {state.notice}
        </p>
      ) : null}

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <caption style={{ ...hintStyle, textAlign: 'start', paddingBottom: 8 }}>
            {faDigits(players.length)} بازیکن نشسته
          </caption>
          <thead>
            <tr>
              <th scope="col" style={thStyle}>نام</th>
              <th scope="col" style={thStyle}>اتاق</th>
              <th scope="col" style={thStyle}>صندلی</th>
              <th scope="col" style={thStyle}>فاز</th>
              <th scope="col" style={thStyle}>وضعیت</th>
              <th scope="col" style={thStyle}>آخرین فعالیت</th>
              {canModerate ? (
                <th scope="col" style={thStyle}>
                  عملیات
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={`${player.roomCode}:${player.seatIndex}`}>
                <td style={tdStyle}>{player.playerName}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                  <bdi>{player.roomCode}</bdi>
                </td>
                <td style={tdStyle}>{player.seatLabel}</td>
                <td style={tdStyle}>{phaseLabel(player.phase)}</td>
                <td style={tdStyle}>
                  <span style={badgeStyle(player.isOnline ? 'ok' : 'off')}>
                    {player.isOnline ? 'آنلاین' : 'آفلاین'}
                  </span>
                </td>
                <td style={tdStyle} title={formatClock(player.lastSeenAt ?? now)}>
                  {formatRelative(player.lastSeenAt, now)}
                </td>
                {canModerate ? (
                  <td style={tdStyle}>
                    <button
                      type="button"
                      style={dangerButtonStyle}
                      disabled={state.pendingId === player.playerId}
                      onClick={() => removePlayer(player)}
                    >
                      {state.pendingId === player.playerId ? 'در حال حذف…' : 'حذف'}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!canModerate ? (
        <p style={hintStyle}>نقش شما فقط‌خواندنی است؛ برای حذف بازیکن باید ناظر یا مدیر ارشد باشید.</p>
      ) : null}
    </div>
  );
}
