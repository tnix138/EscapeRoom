/**
 * قواعد نمایش همراهِ تماشاخانه — موج ۷
 *
 * فقط view عمومی اتاق را به فهرست هم‌تیمی‌ها و «نشانهٔ داستان» تبدیل می‌کند.
 * بدون DOM، بدون fetch و بدون هیچ دادهٔ پنهان (رقم/پاسخ در این ماژول وجود ندارد).
 */

export interface RosterPlayerInput {
  playerId: string;
  playerName: string;
  seatLabel?: string | null;
  seatIndex: number;
  isOnline?: boolean;
  ticketPunched?: boolean;
  hasWatchedInvitation?: boolean;
}

export interface RosterEntry {
  playerId: string;
  name: string;
  seatLabel: string;
  seatIndex: number;
  isMe: boolean;
  isOnline: boolean;
  /** وضعیت قابل‌خواندن؛ رنگ تنها حامل معنا نیست. */
  statusLabel: string;
  /** پیشرفت این صندلی در فصل جاری. */
  progressLabel: string;
  initial: string;
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianNumber(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function fallbackSeatLabel(seatIndex: number): string {
  const safe = Number.isFinite(seatIndex) ? Math.max(0, Math.trunc(seatIndex)) : 0;
  return `صندلی ${toPersianNumber(String(safe + 1).padStart(2, '0'))}`;
}

/** حرف اولِ نام برای نشان گرد؛ نویسه‌های ترکیبی نمی‌شکنند. */
export function rosterInitial(name: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '؟';
  return Array.from(trimmed)[0] ?? '؟';
}

export function buildRoster(players: readonly RosterPlayerInput[], meId: string): RosterEntry[] {
  return [...players]
    .sort((a, b) => (a.seatIndex ?? 0) - (b.seatIndex ?? 0))
    .map((player) => {
      const isOnline = player.isOnline !== false;
      const punched = player.ticketPunched === true;
      const watched = player.hasWatchedInvitation === true;
      return {
        playerId: player.playerId,
        name: player.playerName?.trim() || 'مهمان',
        seatLabel: player.seatLabel?.trim() || fallbackSeatLabel(player.seatIndex),
        seatIndex: player.seatIndex ?? 0,
        isMe: player.playerId === meId,
        isOnline,
        statusLabel: isOnline ? 'آنلاین' : 'آفلاین',
        progressLabel: punched ? 'بلیط پانچ‌شده' : watched ? 'دعوت‌نامه دیده‌شده' : 'در انتظار ورود',
        initial: rosterInitial(player.playerName),
      };
    });
}

/** «۳ از ۵ نفر آنلاین» — برای صفحه‌خوان و نمایش فشرده. */
export function presenceSummary(roster: readonly RosterEntry[]): string {
  const total = roster.length;
  if (total === 0) return 'هم‌تیمی‌ای در این اتاق ثبت نشده است.';
  const online = roster.reduce((count, entry) => count + (entry.isOnline ? 1 : 0), 0);
  return `${toPersianNumber(online)} از ${toPersianNumber(total)} نفر آنلاین`;
}

export interface StoryCueStats {
  /** تعداد بلیط‌های پانچ‌شده. */
  punchedCount?: number;
  /** تعداد بخش‌های بررسی‌شده در سالن تاریک. */
  inspectedCount?: number;
  /** تعداد کل بخش‌های قابل بررسی. */
  hotspotTotal?: number;
}

export interface StoryCue {
  /** شناسهٔ ثابت برای صرف‌نظر کردن. */
  id: string;
  chapter: string;
  title: string;
  body: string;
}

/**
 * نشانهٔ داستان برای هر فاز. متن‌ها راهنمای جهت‌گیری‌اند و هیچ سرنخ یا پاسخی لو نمی‌دهند.
 */
export function storyCueFor(phase: string, stats: StoryCueStats = {}): StoryCue {
  switch (phase) {
    case 'alley_puzzle': {
      const punched = Math.max(0, stats.punchedCount ?? 0);
      return {
        id: 'alley-puzzle',
        chapter: 'فصل اول · بیرونِ تماشاخانه',
        title: 'بلیط‌ها باید پانچ شوند',
        body: punched > 0
          ? `${toPersianNumber(punched)} بلیط پانچ شده است؛ هر صندلی فقط یک رقم طلایی دارد.`
          : 'هر هم‌تیمی بلیط خودش را از روی کوپن و دیوارهای کوچه پانچ می‌کند.',
      };
    }
    case 'door_cutscene':
      return {
        id: 'door-cutscene',
        chapter: 'فصل دوم · آستانهٔ در',
        title: 'قفل چرخید',
        body: 'درِ سنگین تماشاخانه باز می‌شود؛ پرده سرخ در انتظار شماست.',
      };
    case 'theater_cutscene':
      return {
        id: 'theater-cutscene',
        chapter: 'فصل دوم · پردهٔ سرخ',
        title: 'اجرا آغاز می‌شود',
        body: 'چراغ‌ها پایین می‌آیند؛ چشم از صحنه برندارید.',
      };
    case 'in_theater': {
      const inspected = Math.max(0, stats.inspectedCount ?? 0);
      const total = Math.max(0, stats.hotspotTotal ?? 0);
      return {
        id: 'in-theater',
        chapter: 'فصل سوم · سالن تاریک',
        title: 'سالن را کنار هم بگردید',
        body: total > 0
          ? `${toPersianNumber(inspected)} از ${toPersianNumber(total)} بخش سالن بررسی شده است؛ بخش‌های تازه را با هم‌تیمی‌ها ببینید.`
          : 'هر بخشی که بررسی می‌کنید برای همهٔ هم‌تیمی‌ها ثبت می‌شود.',
      };
    }
    default:
      return {
        id: 'unknown-phase',
        chapter: 'تماشاخانهٔ اُرفه‌ئو',
        title: 'در انتظار صحنه',
        body: 'وضعیت اتاق از سرور تازه می‌شود؛ چند لحظه صبر کنید.',
      };
  }
}

/** آیا این نشانه با شناسه‌های صرف‌نظر‌شده پنهان می‌شود؟ */
export function isCueDismissed(cueId: string, dismissed: readonly string[]): boolean {
  return dismissed.includes(cueId);
}

/** برچسب دسترس‌پذیر برای یک ردیف هم‌تیمی. */
export function describeRosterEntry(entry: RosterEntry): string {
  const me = entry.isMe ? ' (شما)' : '';
  return `${entry.name}${me}، ${entry.seatLabel}، ${entry.statusLabel}، ${entry.progressLabel}`;
}
