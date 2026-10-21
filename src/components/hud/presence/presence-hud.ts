/**
 * presence-hud.ts — مدل خالص HUD حضور در جهان سه‌بعدی (فاز ۱۲ — امیرعلی)
 * ---------------------------------------------------------------------------
 * ورودی: موقعیت بازیکن محلی + snapshotهای هم‌تیمی‌ها (فاز ۰۳/۰۴).
 * خروجی: فهرست نشانگرهای آمادهٔ رندر — برچسب نام بالای سرِ هم‌تیمیِ در دید،
 * و فلش لبهٔ صفحه برای هر کسی که بیرون از دید است.
 *
 * قواعد این فایل:
 *  - هیچ DOM، هیچ three.js و هیچ fetch؛ فقط محاسبات خالص و قابل‌تست.
 *  - هیچ پاسخ معمایی (رقم در، نماد بلیط، کد ردیف) در برچسب‌ها نیست.
 *  - هم‌تیمی آفلاین دقیقاً بعد از ۳۰ ثانیه (قرارداد ۲) حذف می‌شود و پیش از آن
 *    کم‌رنگ می‌شود تا ناگهانی ناپدید نشود.
 *  - دو شکل snapshot پشتیبانی می‌شود تا HUD به قرارداد فاز ۰۳ گره نخورد:
 *      الف) شکل فاز ۰۴: { playerId, transform: {x,y,z,...}, updatedAt }
 *      ب) شکل قرارداد ۲:  { playerId, position: {x,y,z}, lastUpdate }
 *    ورودی خراب نادیده گرفته می‌شود؛ هرگز exception نمی‌دهد.
 *  - هر چه تعداد برچسب نام بیشتر شود، خوانایی و FPS افت می‌کند؛ پس فقط
 *    `MAX_NAMEPLATES` نفر نزدیک‌تر نام می‌گیرند و بقیه فلش می‌شوند.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** بازیکن محلی؛ ارتفاع چشم در y است (مثل PlayerTransform موتور سه‌بعدی). */
export interface LocalViewer {
  position: Vec3;
  /** چرخش افقی دوربین (درجه). صفر یعنی رو به محور −z. */
  yawDeg: number;
  /** چرخش عمودی دوربین (درجه). مثبت یعنی نگاه به بالا. */
  pitchDeg?: number;
}

/**
 * ورودی خام یک هم‌تیمی. هر سه شکل زیر پذیرفته می‌شود:
 *  - { playerId, transform: {x,y,z}, updatedAt }
 *  - { playerId, position: {x,y,z}, lastUpdate }
 *  - { playerId, x, y, z, updatedAt }
 */
export interface RemotePlayerInput {
  playerId?: unknown;
  playerName?: unknown;
  name?: unknown;
  seatIndex?: unknown;
  seatLabel?: unknown;
  transform?: { x?: unknown; y?: unknown; z?: unknown; yawDeg?: unknown; yaw?: unknown } | null;
  position?: { x?: unknown; y?: unknown; z?: unknown } | null;
  /** چرخش سرور به رادیان (قرارداد ۲ / Issue #104). */
  yaw?: unknown;
  /** چرخش شکل قدیمی کلاینت به درجه (فاز ۰۴). */
  yawDeg?: unknown;
  phase?: unknown;
  updatedAt?: unknown;
  lastUpdate?: unknown;
  x?: unknown;
  y?: unknown;
  z?: unknown;
}

export interface RemotePlayer {
  playerId: string;
  name: string | null;
  seatIndex: number | null;
  seatLabel: string | null;
  position: Vec3;
  /** چرخش افقی به درجه؛ از `yaw` رادیانی یا `yawDeg` قدیمی خوانده می‌شود. */
  yawDeg: number;
  /** فاز بازی هنگام آخرین ارسال؛ اگر نبود null. */
  phase: string | null;
  /** زمان آخرین به‌روزرسانی (ms)؛ نامعتبر → ۰ یعنی «نامعلوم». */
  updatedAt: number;
}

export interface PresenceView {
  /** عرض و ارتفاع ناحیهٔ دید (پیکسل). */
  widthPx: number;
  heightPx: number;
  /** میدان دید عمودی دوربین (درجه). پیش‌فرض موتور: ۶۸. */
  fovYDeg?: number;
}

export interface PresenceHudOptions {
  /** زمان «اکنون» برای محاسبهٔ کهنگی (ms). */
  now?: number;
  /** حداکثر برچسب نامِ در دید (پیش‌فرض ۴). */
  maxNameplates?: number;
  /** حاشیهٔ امن فلش‌ها از لبهٔ صفحه (درصد). پیش‌فرض ۶. */
  edgeInsetPct?: number;
  /** حاشیهٔ داخل صفحه برای «در دید» بودن (درصد). پیش‌فرض ۲. */
  safeInsetPct?: number;
  /** نام نمایشی هر بازیکن از view اتاق؛ اولویت دارد بر نام داخل snapshot. */
  names?: Readonly<Record<string, string>> | null;
}

export const PRESENCE_SEND_INTERVAL_MS = 100;
export const PRESENCE_OFFLINE_TIMEOUT_MS = 30_000;
export const PRESENCE_STALE_AFTER_MS = 10_000;
export const PRESENCE_STALE_MIN_OPACITY = 0.25;
export const PRESENCE_ENABLED_AFTER_MS = 7_000;
export const MAX_NAMEPLATES = 4;
export const MAX_MARKERS = 32;
export const DEFAULT_FOV_Y_DEG = 68;
export const DEFAULT_EDGE_INSET_PCT = 6;
export const DEFAULT_SAFE_INSET_PCT = 2;

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianNumber(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readPoint(source: { x?: unknown; y?: unknown; z?: unknown } | null | undefined): Vec3 | null {
  if (!source || typeof source !== 'object') return null;
  const x = source.x;
  const y = source.y;
  const z = source.z;
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  if (typeof y !== 'number' || !Number.isFinite(y)) return null;
  if (typeof z !== 'number' || !Number.isFinite(z)) return null;
  return { x, y, z };
}

/** خواندن یک رکورد خام به شکل داخلی؛ ورودی نامعتبر → null. */
export function normalizeRemotePlayer(input: unknown): RemotePlayer | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as RemotePlayerInput;
  const playerId = typeof raw.playerId === 'string' ? raw.playerId.trim() : '';
  if (!playerId) return null;

  const point =
    readPoint(raw.transform) ??
    readPoint(raw.position) ??
    readPoint(raw as { x?: unknown; y?: unknown; z?: unknown });
  if (!point) return null;

  const nameSource = typeof raw.playerName === 'string' ? raw.playerName : raw.name;
  const name = typeof nameSource === 'string' && nameSource.trim() ? nameSource.trim() : null;
  const seatIndex = typeof raw.seatIndex === 'number' && Number.isFinite(raw.seatIndex)
    ? Math.max(0, Math.trunc(raw.seatIndex))
    : null;
  const seatLabel = typeof raw.seatLabel === 'string' && raw.seatLabel.trim()
    ? raw.seatLabel.trim()
    : null;
  // `receivedAt` هم ساعت سرور است و اگر lastUpdate نبود جایگزین می‌شود.
  const updatedAt = Math.max(
    0,
    finiteOr(raw.updatedAt, finiteOr(raw.lastUpdate, finiteOr((raw as { receivedAt?: unknown }).receivedAt, 0))),
  );

  // چرخش: شکل قدیمی درجه دارد و قرارداد ۲ رادیان؛ درجهٔ نرمال‌شده ذخیره می‌شود.
  const rawTransform = raw.transform ?? null;
  const yawDegSource = raw.yawDeg ?? rawTransform?.yawDeg;
  const yawRadSource = raw.yaw ?? rawTransform?.yaw;
  const yawDeg = typeof yawDegSource === 'number' && Number.isFinite(yawDegSource)
    ? yawDegSource
    : typeof yawRadSource === 'number' && Number.isFinite(yawRadSource)
      ? (yawRadSource * 180) / Math.PI
      : 0;

  const phase = typeof raw.phase === 'string' && raw.phase.trim() ? raw.phase.trim() : null;

  return { playerId, name, seatIndex, seatLabel, position: point, yawDeg, phase, updatedAt };
}

/** فهرست خام → فهرست معتبر، بدون تکرار playerId و حداکثر `MAX_MARKERS` مورد. */
export function normalizeRemotePlayers(input: unknown, limit = MAX_MARKERS): RemotePlayer[] {
  if (!Array.isArray(input)) return [];
  const byId = new Map<string, RemotePlayer>();
  for (const entry of input) {
    const player = normalizeRemotePlayer(entry);
    if (!player) continue;
    const previous = byId.get(player.playerId);
    if (!previous || player.updatedAt >= previous.updatedAt) byId.set(player.playerId, player);
    if (byId.size >= Math.max(1, limit)) break;
  }
  return [...byId.values()];
}

/** سن snapshot؛ اگر زمان نامعلوم باشد `Infinity` (کهنه) برمی‌گردد. */
export function presenceAge(player: Pick<RemotePlayer, 'updatedAt'>, now: number): number {
  if (!Number.isFinite(now) || !player.updatedAt) return Number.POSITIVE_INFINITY;
  return Math.max(0, now - player.updatedAt);
}

/** هم‌تیمی هنوز آنلاین است؟ (قرارداد ۲: ۳۰ ثانیه) */
export function isTeammateOnline(player: Pick<RemotePlayer, 'updatedAt'>, now: number): boolean {
  return presenceAge(player, now) < PRESENCE_OFFLINE_TIMEOUT_MS;
}

/**
 * شفافیت: تا ۱۰ ثانیه کامل، بعد خطی تا `PRESENCE_STALE_MIN_OPACITY` در آستانهٔ
 * ۳۰ ثانیه و پس از آن صفر (حذف).
 */
export function staleOpacity(age: number): number {
  if (!Number.isFinite(age)) return 0;
  if (age <= PRESENCE_STALE_AFTER_MS) return 1;
  if (age >= PRESENCE_OFFLINE_TIMEOUT_MS) return 0;
  const span = PRESENCE_OFFLINE_TIMEOUT_MS - PRESENCE_STALE_AFTER_MS;
  const remaining = 1 - (age - PRESENCE_STALE_AFTER_MS) / span;
  return PRESENCE_STALE_MIN_OPACITY + (1 - PRESENCE_STALE_MIN_OPACITY) * remaining;
}

/** شفافیت نشانگر یک هم‌تیمی در لحظهٔ now. */
export function presenceOpacity(player: Pick<RemotePlayer, 'updatedAt'>, now: number): number {
  return staleOpacity(presenceAge(player, now));
}

/** زاویهٔ نسبی هم‌تیمی نسبت به جهت نگاه بازیکن محلی (درجه، −۱۸۰ تا ۱۸۰). */
export function bearingDeg(local: LocalViewer, remote: Vec3): number {
  const dx = remote.x - local.position.x;
  const dz = remote.z - local.position.z;
  if (dx === 0 && dz === 0) return 0;
  const yawRad = ((Number.isFinite(local.yawDeg) ? local.yawDeg : 0) * Math.PI) / 180;
  // جهت نگاه موتور سه‌بعدی: forward = (−sin, −cos) و right = (cos, −sin)
  const forward = -dx * Math.sin(yawRad) - dz * Math.cos(yawRad);
  const right = dx * Math.cos(yawRad) - dz * Math.sin(yawRad);
  return (Math.atan2(right, forward) * 180) / Math.PI;
}

/** فاصلهٔ افقی افقی به متر (بدون اختلاف ارتفاع). */
export function distanceMeters(local: LocalViewer, remote: Vec3): number {
  const dx = remote.x - local.position.x;
  const dz = remote.z - local.position.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** «۲٫۴ متر» — با یک رقم اعشار و رقم فارسی. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return 'نامعلوم';
  if (meters < 1) return 'کمتر از ۱ متر';
  const rounded = Math.round(meters * 10) / 10;
  return `${toPersianNumber(rounded.toFixed(1).replace(/\.0$/, ''))} متر`;
}

/** «روبه‌رو» / «سمت راست» / «پشت سر» — برای صفحه‌خوان و برچسب فلش. */
export function describeDirection(bearing: number): string {
  if (!Number.isFinite(bearing)) return 'نامعلوم';
  const normalized = ((bearing + 540) % 360) - 180;
  const magnitude = Math.abs(normalized);
  if (magnitude <= 22.5) return 'روبه‌رو';
  if (magnitude >= 157.5) return 'پشت سر';
  const side = normalized > 0 ? 'راست' : 'چپ';
  if (magnitude <= 67.5) return `کمی سمت ${side}`;
  if (magnitude <= 112.5) return `سمت ${side}`;
  return `عقب ${side}`;
}

export interface ProjectedPoint {
  /** موقعیت افقی در ناحیهٔ دید (۰ تا ۱، چپ به راست). */
  xPct: number;
  /** موقعیت عمودی در ناحیهٔ دید (۰ بالا، ۱ پایین). */
  yPct: number;
  /** فاصله در راستای نگاه (متر)؛ منفی یعنی پشت سر. */
  depth: number;
  /** مقابل دوربین است؟ */
  inFront: boolean;
}

/**
 * تصویر کردن یک نقطهٔ سه‌بعدی روی صفحهٔ دوربین (مدل سوراخ‌سوزنی).
 * خروجی مستقل از رزولوشن است: فقط درصد و نسبت ابعاد مهم است.
 */
export function projectPoint(local: LocalViewer, point: Vec3, view: PresenceView): ProjectedPoint {
  const width = Math.max(1, finiteOr(view.widthPx, 1));
  const height = Math.max(1, finiteOr(view.heightPx, 1));
  const aspect = width / height;
  const fovY = finiteOr(view.fovYDeg, DEFAULT_FOV_Y_DEG);
  const halfTanY = Math.tan((Math.min(179, Math.max(1, fovY)) * Math.PI) / 360);
  const halfTanX = halfTanY * aspect;

  const yawRad = ((Number.isFinite(local.yawDeg) ? local.yawDeg : 0) * Math.PI) / 180;
  const pitchRad = ((Number.isFinite(local.pitchDeg ?? 0) ? (local.pitchDeg ?? 0) : 0) * Math.PI) / 180;

  const dx = point.x - local.position.x;
  const dy = point.y - local.position.y;
  const dz = point.z - local.position.z;

  const forward = -dx * Math.sin(yawRad) - dz * Math.cos(yawRad);
  const right = dx * Math.cos(yawRad) - dz * Math.sin(yawRad);
  const up = dy;

  // چرخش عمودی دوربین: مثبت = نگاه به بالا.
  const cosP = Math.cos(pitchRad);
  const sinP = Math.sin(pitchRad);
  const depth = forward * cosP - up * sinP;
  const vertical = up * cosP + forward * sinP;

  const inFront = depth > 0.001;
  if (!inFront) {
    return { xPct: 0.5, yPct: 0.5, depth, inFront: false };
  }

  const ndcX = right / (depth * halfTanX);
  const ndcY = vertical / (depth * halfTanY);
  return {
    xPct: 0.5 + 0.5 * ndcX,
    yPct: 0.5 - 0.5 * ndcY,
    depth,
    inFront: true,
  };
}

export type PresenceMarkerKind = 'nameplate' | 'arrow';

export interface PresenceMarker {
  playerId: string;
  /** نام نمایشی؛ اگر نبود از صندلی و در نهایت از شناسه ساخته می‌شود. */
  label: string;
  /** حرف اول برای نشان گرد. */
  initial: string;
  seatLabel: string | null;
  kind: PresenceMarkerKind;
  /** هندسی در میدان دید است؟ (مستقل از سقف برچسب نام) */
  inView: boolean;
  /** موقعیت افقی نشانگر روی صفحه (درصد). */
  xPct: number;
  /** موقعیت عمودی نشانگر روی صفحه (درصد). */
  yPct: number;
  /** چرخش فلش (درجه، ۰ = رو به بالا). برای برچسب نام همیشه ۰ است. */
  angleDeg: number;
  /** زاویهٔ نسبی به جهت نگاه (درجه). */
  bearingDeg: number;
  distanceMeters: number;
  distanceLabel: string;
  directionLabel: string;
  /** شفافیت بر اساس کهنگی snapshot. */
  opacity: number;
  /** برای صفحه‌خوان: «سارا — سمت راست، ۲٫۴ متر». */
  announcement: string;
}

function displayName(player: RemotePlayer, names?: Readonly<Record<string, string>> | null): string {
  const fromRoom = names?.[player.playerId];
  if (typeof fromRoom === 'string' && fromRoom.trim()) return fromRoom.trim();
  if (player.name) return player.name;
  if (player.seatIndex !== null) return `هم‌تیمی صندلی ${toPersianNumber(player.seatIndex + 1)}`;
  return 'هم‌تیمی';
}

function seatText(player: RemotePlayer): string | null {
  if (player.seatLabel) return player.seatLabel;
  if (player.seatIndex !== null) return `صندلی ${toPersianNumber(player.seatIndex + 1)}`;
  return null;
}

/** موقعیت فلش روی لبهٔ ناحیهٔ دید؛ جهت با زاویهٔ صفحه (۰ = بالا، ۹۰ = راست). */
export function edgePosition(
  bearing: number,
  insetPct = DEFAULT_EDGE_INSET_PCT,
): { xPct: number; yPct: number } {
  const radians = (bearing * Math.PI) / 180;
  const dirX = Math.sin(radians);
  const dirY = -Math.cos(radians);
  const halfW = Math.max(0.5, 50 - Math.min(45, Math.max(0, insetPct)));
  const halfH = Math.max(0.5, 50 - Math.min(45, Math.max(0, insetPct)));

  const scaleX = Math.abs(dirX) < 1e-9 ? Number.POSITIVE_INFINITY : halfW / Math.abs(dirX);
  const scaleY = Math.abs(dirY) < 1e-9 ? Number.POSITIVE_INFINITY : halfH / Math.abs(dirY);
  const scale = Math.min(scaleX, scaleY);
  const t = Number.isFinite(scale) ? scale : Math.min(halfW, halfH);

  return {
    xPct: Math.min(100 - insetPct, Math.max(insetPct, 50 + dirX * t)),
    yPct: Math.min(100 - insetPct, Math.max(insetPct, 50 + dirY * t)),
  };
}

/**
 * ساخت همهٔ نشانگرهای HUD.
 *
 * - هم‌تیمی محلی و آفلاین‌های بیش از ۳۰ ثانیه حذف می‌شوند.
 * - در دید → برچسب نام بالای سر (حداکثر `maxNameplates` نفر نزدیک‌تر).
 * - بیرون از دید یا پشت سر → فلش روی لبه با همان جهت.
 * - خروجی پایدار و مرتب است (نزدیک‌تر اول) تا رندر هر بار نلرزد.
 */
export function buildPresenceMarkers(
  local: LocalViewer | null,
  playersInput: unknown,
  view: PresenceView,
  options: PresenceHudOptions & { localPlayerId?: string } = {},
): PresenceMarker[] {
  if (!local) return [];
  const now = finiteOr(options.now, Date.now());
  const maxNameplates = Math.max(0, Math.trunc(finiteOr(options.maxNameplates, MAX_NAMEPLATES)));
  const edgeInset = Math.min(45, Math.max(1, finiteOr(options.edgeInsetPct, DEFAULT_EDGE_INSET_PCT)));
  const safeInsetPct = Math.min(45, Math.max(0, finiteOr(options.safeInsetPct, DEFAULT_SAFE_INSET_PCT)));
  // xPct/yPct کسری در بازهٔ ۰ تا ۱ هستند؛ حاشیهٔ امن درصدی است.
  const safeInset = safeInsetPct / 100;

  const candidates = normalizeRemotePlayers(playersInput)
    .filter((player) => player.playerId !== options.localPlayerId)
    .filter((player) => isTeammateOnline(player, now))
    .map((player) => ({
      player,
      distance: distanceMeters(local, player.position),
      bearing: bearingDeg(local, player.position),
      projected: projectPoint(local, player.position, view),
      opacity: staleOpacity(presenceAge(player, now)),
    }))
    .sort((a, b) => a.distance - b.distance || a.player.playerId.localeCompare(b.player.playerId));

  let nameplatesLeft = maxNameplates;

  return candidates.map(({ player, distance, bearing, projected, opacity }) => {
    const label = displayName(player, options.names);
    const distanceLabel = formatDistance(distance);
    const directionLabel = describeDirection(bearing);
    const seat = seatText(player);
    const onScreen =
      projected.inFront &&
      projected.xPct >= safeInset && projected.xPct <= 1 - safeInset &&
      projected.yPct >= safeInset && projected.yPct <= 1 - safeInset;
    const kind: PresenceMarkerKind = onScreen && nameplatesLeft > 0 ? 'nameplate' : 'arrow';
    if (kind === 'nameplate') nameplatesLeft -= 1;

    // projectPoint کسری (۰ تا ۱) برمی‌گرداند؛ نشانگرها درصدی (۰ تا ۱۰۰) کار می‌کنند.
    const position = kind === 'nameplate'
      ? { xPct: clampPct(projected.xPct * 100), yPct: clampPct(projected.yPct * 100) }
      : edgePosition(bearing, edgeInset);

    return {
      playerId: player.playerId,
      label,
      initial: Array.from(label)[0] ?? '؟',
      seatLabel: seat,
      kind,
      inView: onScreen,
      xPct: position.xPct,
      yPct: position.yPct,
      angleDeg: kind === 'arrow' ? ((bearing + 540) % 360) - 180 : 0,
      bearingDeg: bearing,
      distanceMeters: distance,
      distanceLabel,
      directionLabel,
      opacity,
      announcement: seat
        ? `${label}، ${seat} — ${directionLabel}، ${distanceLabel}`
        : `${label} — ${directionLabel}، ${distanceLabel}`,
    };
  });
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, value));
}

/** جمع‌بندی فارسی برای aria-live: «۳ هم‌تیمی در دید، ۱ نفر بیرون از دید». */
export function presenceSummaryLabel(markers: readonly PresenceMarker[]): string {
  if (markers.length === 0) return 'هم‌تیمی‌ای در دید نیست.';
  const visible = markers.filter((marker) => marker.inView).length;
  const outside = markers.length - visible;
  const parts: string[] = [];
  if (visible > 0) parts.push(`${toPersianNumber(visible)} هم‌تیمی در دید`);
  if (outside > 0) parts.push(`${toPersianNumber(outside)} نفر بیرون از دید`);
  return `${parts.join('، ')}.`;
}

/** آیا HUD باید نمایش داده شود؟ (بدون بازیکن محلی یا بدون هم‌تیمی: نه) */
export function shouldShowPresence(local: LocalViewer | null, markers: readonly PresenceMarker[]): boolean {
  return Boolean(local) && markers.length > 0;
}

/** پیکربندی ارسال ۱۰Hz برای موتور — تا HUD و شبکه از یک عدد استفاده کنند. */
export const PRESENCE_PUBLISH_INTERVAL_MS = PRESENCE_SEND_INTERVAL_MS;
