/**
 * exploration-hud.ts — وضعیت کاوش برای سالن تاریک و کوچه (موج ۹)
 * -------------------------------------------------------------------
 * تمام منطق «هدف بعدی»، «یادداشت‌های بررسی‌شده» و «مسیر بازیکن» اینجا خالص است؛
 * کامپوننت فقط آن را رسم می‌کند. هیچ داده‌ای واکشی نمی‌شود و هیچ پاسخ معمایی
 * (رقم در، نماد بلیط، کد ردیف) در این ماژول ساخته یا حدس زده نمی‌شود.
 *
 * منبع حقیقت، همان `ClientRoomView` سرور است؛ ورودی این ماژول عمداً زیرمجموعه‌ای
 * ساختاری است تا تست بدون مرورگر و بدون اتاق واقعی ممکن باشد.
 */

import type { AuditoriumHotspotId } from '@/contracts/types';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianNumber(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

/* --------------------------------------------------------------------------
 * نقاط بررسی سالن — فقط عنوان عمومی؛ متن کامل در صحنهٔ مالک آن است
 * -------------------------------------------------------------------------- */

export interface HallHotspotMeta {
  id: AuditoriumHotspotId;
  title: string;
  hint: string;
}

export const HALL_HOTSPOTS: readonly HallHotspotMeta[] = [
  { id: 'shattered-chandelier', title: 'لوستر شکسته', hint: 'وسط زمین' },
  { id: 'crooked-paintings', title: 'تابلوهای کج', hint: 'دیوارهای چپ و راست' },
  { id: 'three-dark-stages', title: 'سه سِن تاریک', hint: 'روبه‌روی صندلی‌ها' },
  { id: 'locked-exit-doors', title: 'درهای قفل‌شده', hint: 'دو انتهای سالن' },
];

export const ALLEY_CLUES = [
  { id: 'playbill', title: 'اعلان نمایش امشب', hint: 'تابلوی اعلانات، سمت چپ کوچه' },
  { id: 'rowChart', title: 'جدول تبدیل ردیف‌ها', hint: 'گیشهٔ برنجی، سمت راست کوچه' },
] as const;

export type AlleyClueId = (typeof ALLEY_CLUES)[number]['id'];

/* --------------------------------------------------------------------------
 * ورودی ساختاری
 * -------------------------------------------------------------------------- */

export interface ExplorationPlayerInput {
  playerName: string;
  seatLabel?: string | null;
  seatIndex?: number;
  ticketPunched?: boolean;
  isOnline?: boolean;
}

export interface ExplorationMessageInput {
  id: string;
  senderName: string;
  text: string;
  type?: 'whisper' | 'ticket_share' | 'system';
}

export interface ExplorationInput {
  phase: string;
  me: { playerName: string; seatIndex?: number; ticketPunched?: boolean };
  players?: readonly ExplorationPlayerInput[];
  auditorium?: {
    inspectedHotspots?: Partial<Record<AuditoriumHotspotId, string[]>>;
    chapterStatusBanner?: string | null;
  } | null;
  alley?: {
    doorLockState?: { punchedCount?: number; requiredCount?: number; attempts?: number } | null;
  } | null;
  messages?: readonly ExplorationMessageInput[];
  /** سرنخ‌هایی که خود بازیکن در این نشست خوانده است. */
  visitedClues?: readonly string[];
  /** قفل در در این نشست توسط تیم باز شده است. */
  doorUnlocked?: boolean;
  /** برچسب موقعیت از سمت صحنه (مثلاً «نزدیک گیشه»). */
  positionLabel?: string | null;
}

/* --------------------------------------------------------------------------
 * خروجی
 * -------------------------------------------------------------------------- */

export interface ExplorationObjective {
  id: string;
  label: string;
  done: boolean;
  /** جزئیات کوتاه: «۲ از ۴ بخش». */
  detail: string;
  /** راهنمای کوتاه برای انجام دادن. */
  hint?: string;
  /** آیا در نوار پیشرفت شمرده می‌شود؟ «سرنخ»ها شمرده نمی‌شوند. */
  countsForProgress: boolean;
}

export interface ExplorationNote {
  id: string;
  title: string;
  hint: string;
  inspected: boolean;
  /** خودِ بازیکن این بخش را بررسی کرده است. */
  mine: boolean;
  /** نام‌هایی که سرور ثبت کرده است (فقط view عمومی). */
  by: string[];
  /** خلاصهٔ وضعیت با متن، مستقل از رنگ. */
  statusLabel: string;
}

export type TrailState = 'done' | 'current' | 'pending';

export interface ExplorationTrailStep {
  id: string;
  label: string;
  state: TrailState;
}

export interface ExplorationChatSummary {
  total: number;
  lastSender: string;
  lastText: string;
  lastType: 'whisper' | 'ticket_share' | 'system';
  hasMessages: boolean;
}

export interface ExplorationState {
  visible: boolean;
  phase: string;
  chapterLabel: string;
  title: string;
  subtitle: string;
  objectives: ExplorationObjective[];
  notes: ExplorationNote[];
  trail: ExplorationTrailStep[];
  positionLabel: string;
  chat: ExplorationChatSummary;
  progress: { done: number; total: number; percent: number; label: string };
  /** هدف بعدی؛ برای عنوان فشرده و اعلام صفحه‌خوان. */
  nextObjectiveLabel: string | null;
  allTasksDone: boolean;
}

/* --------------------------------------------------------------------------
 * ابزارها
 * -------------------------------------------------------------------------- */

/** فازهای کات‌سین نباید هیچ HUDی روی صحنه داشته باشند. */
export function isExplorationPhase(phase: string): boolean {
  return phase === 'alley_puzzle' || phase === 'in_theater';
}

function uniqueNames(names: readonly string[] | undefined): string[] {
  if (!names || names.length === 0) return [];
  return Array.from(new Set(names.filter((name) => typeof name === 'string' && name.trim().length > 0)));
}

function inspectedNames(input: ExplorationInput, id: AuditoriumHotspotId): string[] {
  return uniqueNames(input.auditorium?.inspectedHotspots?.[id]);
}

/** چند بخش سالن دست‌کم یک بار بررسی شده است. */
export function inspectedHotspotCount(input: ExplorationInput): number {
  return HALL_HOTSPOTS.reduce(
    (count, hotspot) => count + (inspectedNames(input, hotspot.id).length > 0 ? 1 : 0),
    0,
  );
}

export function allHotspotsInspected(input: ExplorationInput): boolean {
  return inspectedHotspotCount(input) === HALL_HOTSPOTS.length;
}

function readClueCount(input: ExplorationInput): number {
  const visited = new Set(input.visitedClues ?? []);
  return ALLEY_CLUES.reduce((count, clue) => count + (visited.has(clue.id) ? 1 : 0), 0);
}

function punchedCount(input: ExplorationInput): number {
  const players = input.players ?? [];
  const fromPlayers = players.reduce((count, player) => count + (player.ticketPunched ? 1 : 0), 0);
  const reported = input.alley?.doorLockState?.punchedCount ?? 0;
  return Math.max(fromPlayers, Math.max(0, Math.trunc(reported)));
}

function requiredCount(input: ExplorationInput): number {
  const players = input.players ?? [];
  const total = Math.max(players.length, input.alley?.doorLockState?.requiredCount ?? 0);
  return Math.max(1, total);
}

function everyoneOnline(input: ExplorationInput): boolean {
  const players = input.players ?? [];
  return players.length > 0 && players.every((player) => player.isOnline !== false);
}

function chatSummary(input: ExplorationInput): ExplorationChatSummary {
  const messages = input.messages ?? [];
  const last = messages[messages.length - 1];
  return {
    total: messages.length,
    lastSender: last?.senderName ?? '',
    lastText: last?.text ?? '',
    lastType: last?.type ?? 'system',
    hasMessages: messages.length > 0,
  };
}

function teammatesSpoke(input: ExplorationInput): boolean {
  return (input.messages ?? []).some((message) => message.type === 'whisper' || message.type === 'ticket_share');
}

/* --------------------------------------------------------------------------
 * اهداف
 * -------------------------------------------------------------------------- */

function alleyObjectives(input: ExplorationInput): ExplorationObjective[] {
  const read = readClueCount(input);
  const punched = punchedCount(input);
  const required = requiredCount(input);
  const punchedAll = punched >= required;
  const doorOpen = input.doorUnlocked === true || input.phase !== 'alley_puzzle';

  return [
    {
      id: 'alley-read-clues',
      label: 'سرنخ‌های کوچه را بخوانید',
      done: read === ALLEY_CLUES.length,
      detail: `${toPersianNumber(read)} از ${toPersianNumber(ALLEY_CLUES.length)} سرنخ`,
      hint: 'تابلوی اعلانات سمت چپ و جدول ردیف‌ها در گیشهٔ راست.',
      countsForProgress: true,
    },
    {
      id: 'alley-punch-own',
      label: 'بلیط خودتان را پانچ کنید',
      done: input.me.ticketPunched === true,
      detail: input.me.ticketPunched ? 'بلیط شما تأیید شد' : 'سه نشانه را از کوپن و دیوارها کنار هم بگذارید',
      hint: 'نماد، پرده و ردیف باید با کوپن و دیوارهای کوچه بخوانند.',
      countsForProgress: true,
    },
    {
      id: 'alley-team-tickets',
      label: 'بلیط همهٔ هم‌تیمی‌ها پانچ شود',
      done: punchedAll,
      detail: `${toPersianNumber(punched)} از ${toPersianNumber(required)} بلیط`,
      hint: 'چراغ هر صندلی روی درِ تماشاخانه با پانچ شدن روشن می‌شود.',
      countsForProgress: true,
    },
    {
      id: 'alley-unlock-door',
      label: 'قفل درِ تماشاخانه را بچرخانید',
      done: doorOpen,
      detail: doorOpen ? 'در باز شد' : 'ارقام طلایی را به ترتیب صندلی وارد کنید',
      hint: 'هر بلیط فقط یک رقم طلایی دارد؛ ترتیب، ترتیب صندلی‌هاست.',
      countsForProgress: true,
    },
  ];
}

function hallObjectives(input: ExplorationInput): ExplorationObjective[] {
  const inspected = inspectedHotspotCount(input);
  const total = HALL_HOTSPOTS.length;
  return [
    {
      id: 'hall-inspect',
      label: 'چهار بخش سالن را با تیم بگردید',
      done: inspected === total,
      detail: `${toPersianNumber(inspected)} از ${toPersianNumber(total)} بخش`,
      hint: 'هر بخشی که بررسی شود برای همهٔ هم‌تیمی‌ها ثبت می‌شود؛ لازم نیست همه خودشان بروند.',
      countsForProgress: true,
    },
    {
      id: 'hall-share-notes',
      label: 'یادداشت‌های سالن را با تیم در میان بگذارید',
      done: teammatesSpoke(input),
      detail: teammatesSpoke(input) ? 'گفتگو شروع شده است' : 'هنوز هیچ نجوایی رد و بدل نشده',
      hint: 'در تاریکی، یک جملهٔ کوتاه می‌تواند مسیر را روشن کند.',
      countsForProgress: true,
    },
    {
      id: 'hall-regroup',
      label: 'همهٔ هم‌تیمی‌ها دوباره آنلاین شوند',
      done: everyoneOnline(input),
      detail: everyoneOnline(input) ? 'همه حاضرند' : 'دست‌کم یک نفر آفلاین است',
      hint: 'اگر کسی قطع شد، منتظر بمانید تا وضعیتش سبز شود.',
      countsForProgress: true,
    },
    {
      id: 'hall-exit-lead',
      label: 'نشانهٔ راه خروج را پیدا کنید',
      done: false,
      detail: 'درها از بیرون قفل‌اند؛ سرنخ تازه‌ای لازم است',
      hint: 'این هدف سرنخ است و در شمارش پیشرفت نمی‌آید.',
      countsForProgress: false,
    },
  ];
}

export function objectivesFor(input: ExplorationInput): ExplorationObjective[] {
  if (input.phase === 'in_theater') return hallObjectives(input);
  if (input.phase === 'alley_puzzle') return alleyObjectives(input);
  return [];
}

/* --------------------------------------------------------------------------
 * یادداشت‌ها / وضعیت بررسی
 * -------------------------------------------------------------------------- */

export function notesFor(input: ExplorationInput): ExplorationNote[] {
  if (input.phase === 'in_theater') {
    return HALL_HOTSPOTS.map((hotspot) => {
      const by = inspectedNames(input, hotspot.id);
      const mine = by.includes(input.me.playerName);
      return {
        id: hotspot.id,
        title: hotspot.title,
        hint: hotspot.hint,
        inspected: by.length > 0,
        mine,
        by,
        statusLabel: by.length === 0
          ? 'هنوز بررسی نشده'
          : mine
            ? `شما بررسی کردید${by.length > 1 ? ` · ${toPersianNumber(by.length)} نفر` : ''}`
            : `${by.length === 1 ? by[0] : `${toPersianNumber(by.length)} نفر`} بررسی کرده`,
      };
    });
  }

  if (input.phase === 'alley_puzzle') {
    const visited = new Set(input.visitedClues ?? []);
    return ALLEY_CLUES.map((clue) => {
      const seen = visited.has(clue.id);
      return {
        id: clue.id,
        title: clue.title,
        hint: clue.hint,
        inspected: seen,
        mine: seen,
        by: seen ? [input.me.playerName] : [],
        statusLabel: seen ? 'خوانده‌اید' : 'خوانده نشده',
      };
    });
  }

  return [];
}

/* --------------------------------------------------------------------------
 * مسیر بازیکن
 * -------------------------------------------------------------------------- */

export function trailFor(input: ExplorationInput): ExplorationTrailStep[] {
  // هر گامی که بازی از آن گذشته باشد «انجام‌شده» است، حتی اگر سرنخ‌ها در نشست
  // قبلی خوانده شده باشند (وضعیت کوچه در کلاینت نگه داشته نمی‌شود).
  const pastAlley = input.phase === 'door_cutscene'
    || input.phase === 'theater_cutscene'
    || input.phase === 'in_theater';
  const readAll = readClueCount(input) === ALLEY_CLUES.length || pastAlley;
  const punchedAll = punchedCount(input) >= requiredCount(input) || pastAlley;
  const pastDoor = input.doorUnlocked === true || pastAlley;
  const pastCutscene = input.phase === 'in_theater';
  const hallDone = allHotspotsInspected(input);

  const steps: Array<{ id: string; label: string; done: boolean }> = [
    { id: 'arrive-alley', label: 'رسیدن به کوچه', done: true },
    { id: 'read-clues', label: 'خواندن سرنخ‌های کوچه', done: readAll },
    { id: 'punch-tickets', label: 'پانچ بلیط‌های تیم', done: punchedAll },
    { id: 'open-door', label: 'گشودن درِ تماشاخانه', done: pastDoor },
    { id: 'watch-cutscene', label: 'تماشای پردهٔ سرخ', done: pastCutscene },
    { id: 'explore-hall', label: 'بررسی سالن تاریک', done: hallDone },
  ];

  let currentAssigned = false;
  return steps.map((step) => {
    if (step.done) return { id: step.id, label: step.label, state: 'done' as TrailState };
    if (!currentAssigned) {
      currentAssigned = true;
      return { id: step.id, label: step.label, state: 'current' as TrailState };
    }
    return { id: step.id, label: step.label, state: 'pending' as TrailState };
  });
}

/* --------------------------------------------------------------------------
 * وضعیت نهایی
 * -------------------------------------------------------------------------- */

export function explorationProgress(
  objectives: readonly ExplorationObjective[],
): { done: number; total: number; percent: number; label: string } {
  const counted = objectives.filter((objective) => objective.countsForProgress);
  const total = counted.length;
  const done = counted.filter((objective) => objective.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return {
    done,
    total,
    percent,
    label: `${toPersianNumber(done)} از ${toPersianNumber(total)} هدف`,
  };
}

const HALL_POSITION_DEFAULT = 'سالن تاریک · رو به سن';
const ALLEY_POSITION_DEFAULT = 'کوچهٔ تماشاخانه';

export function buildExplorationState(input: ExplorationInput): ExplorationState {
  const objectives = objectivesFor(input);
  const notes = notesFor(input);
  const trail = trailFor(input);
  const progress = explorationProgress(objectives);
  const visible = isExplorationPhase(input.phase);
  const next = objectives.find((objective) => !objective.done) ?? null;
  const counted = objectives.filter((objective) => objective.countsForProgress);

  const chapterLabel = input.phase === 'in_theater'
    ? 'فصل سوم · سالن تاریک'
    : 'فصل اول · بیرونِ تماشاخانه';

  const title = input.phase === 'in_theater'
    ? (next ? next.label : 'سالن بررسی شد')
    : (next ? next.label : 'کوچه آماده است');

  const subtitle = input.phase === 'in_theater'
    ? (input.auditorium?.chapterStatusBanner?.trim() || 'سالن تاریک است؛ با هم‌تیمی‌ها بگردید.')
    : 'هر سرنخ، یک تکه از قفل در است.';

  return {
    visible,
    phase: input.phase,
    chapterLabel,
    title,
    subtitle,
    objectives,
    notes,
    trail,
    positionLabel: input.positionLabel?.trim() || (input.phase === 'in_theater' ? HALL_POSITION_DEFAULT : ALLEY_POSITION_DEFAULT),
    chat: chatSummary(input),
    progress,
    nextObjectiveLabel: next ? next.label : null,
    allTasksDone: counted.length > 0 && counted.every((objective) => objective.done),
  };
}

/** متن اعلام پیشرفت برای ناحیهٔ زندهٔ صفحه‌خوان. */
export function describeProgress(state: ExplorationState): string {
  if (state.objectives.length === 0) return 'هدفی برای این صحنه ثبت نشده است.';
  if (state.allTasksDone) return `همهٔ ${toPersianNumber(state.progress.total)} هدف کامل شد.`;
  return `${state.progress.label} کامل شده؛ هدف بعدی: ${state.nextObjectiveLabel ?? 'ادامهٔ کاوش'}.`;
}

/** خلاصهٔ یک خطی برای عنوان فشرده. */
export function compactSummary(state: ExplorationState): string {
  return `${toPersianNumber(state.progress.done)} از ${toPersianNumber(state.progress.total)}`;
}

/** برچسب دسترس‌پذیر برای هر ردیف یادداشت. */
export function describeNote(note: ExplorationNote): string {
  return `${note.title} — ${note.statusLabel}`;
}
