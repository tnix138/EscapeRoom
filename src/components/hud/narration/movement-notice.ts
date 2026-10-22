/**
 * movement-notice.ts — وضعیت حرکت بازیکن و اعلان‌های آن (موج ۸)
 * ----------------------------------------------------------------
 * وقتی مودال/پنل باز است یا ماوس قفل شده، بازیکن باید بداند چرا حرکت نمی‌کند و
 * چطور آزادش کند. متن‌ها اینجا ساخته می‌شوند تا بدون مرورگر هم تست شوند.
 */

export type MovementMode = 'free' | 'pointer-lock' | 'modal' | 'cinematic';

export interface MovementStatus {
  mode: MovementMode;
  /** زمانی که حرکت آزاد شد (میلی‌ثانیهٔ ساعت مرورگر)؛ برای اعلان کوتاه «آزاد شد». */
  releasedAtMs?: number | null;
  /**
   * زمانی که ماوس قفل شد. اگر داده شود، راهنمای «ماوس قفل شده» فقط یک
   * پنجرهٔ کوتاه نمایش داده می‌شود و بعد محو می‌شود؛ در بازی ماوس تقریباً
   * همیشه قفل است و اعلان دائمی وسط صفحه دیده را می‌بندد.
   */
  pointerLockedAtMs?: number | null;
}

export type MovementNoticeTone = 'locked' | 'info' | 'ready';

export interface MovementNoticeView {
  /** شناسهٔ پایدار برای کلید React و برای صفحه‌خوان. */
  id: string;
  text: string;
  detail?: string;
  tone: MovementNoticeTone;
}

/** پنجرهٔ نمایش اعلان «حرکت آزاد شد» پس از رهاسازی. */
export const MOVEMENT_RELEASE_WINDOW_MS = 3_200;

/**
 * پنجرهٔ نمایش راهنمای «ماوس قفل شده» بعد از قفل شدن (ms).
 * بعد از این مدت اعلان پنهان می‌شود تا HUD وسط صفحه شلوغ نماند.
 */
export const MOVEMENT_POINTER_HINT_MS = 4_000;

export function describeMovementMode(mode: MovementMode): string {
  if (mode === 'modal') return 'حرکت قفل شده است: یک پنجره باز است.';
  if (mode === 'cinematic') return 'حرکت قفل شده است: کات‌سین در جریان است.';
  if (mode === 'pointer-lock') return 'حرکت آزاد است و ماوس قفل شده.';
  return 'حرکت آزاد است.';
}

/**
 * اعلان مناسب همین لحظه یا null.
 * - مودال باز: حرکت قفل است و راه بستن پنجره گفته می‌شود.
 * - کات‌سین: هیچ حرکتی مجاز نیست.
 * - ماوس قفل: راهنمای Esc.
 * - آزادشده در چند ثانیهٔ اخیر: اعلان «حرکت آزاد شد» یک‌بار نمایش داده می‌شود.
 */
export function movementNotice(
  status: MovementStatus,
  nowMs: number,
  releaseWindowMs: number = MOVEMENT_RELEASE_WINDOW_MS,
): MovementNoticeView | null {
  switch (status.mode) {
    case 'modal':
      return {
        id: 'movement-modal',
        text: 'حرکت قفل شد',
        detail: 'برای ادامه، پنجرهٔ باز را با Esc ببندید.',
        tone: 'locked',
      };
    case 'cinematic':
      return {
        id: 'movement-cinematic',
        text: 'حرکت در دسترس نیست',
        detail: 'تا پایان کات‌سین فقط می‌توانید سرتان را بچرخانید.',
        tone: 'locked',
      };
    case 'pointer-lock': {
      // اگر زمان قفل شدن معلوم است، راهنما فقط یک پنجرهٔ کوتاه می‌ماند.
      const lockedAt = status.pointerLockedAtMs ?? null;
      if (lockedAt !== null && Number.isFinite(lockedAt)) {
        const elapsed = nowMs - lockedAt;
        if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= MOVEMENT_POINTER_HINT_MS) {
          return null;
        }
      }
      return {
        id: 'movement-pointer-lock',
        text: 'ماوس قفل شده',
        detail: 'برای آزادکردن ماوس و دیدن نشانگر، Esc را بزنید.',
        tone: 'info',
      };
    }
    default: {
      const releasedAt = status.releasedAtMs ?? null;
      if (releasedAt === null) return null;
      const elapsed = nowMs - releasedAt;
      if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= releaseWindowMs) return null;
      return {
        id: 'movement-released',
        text: 'حرکت آزاد شد',
        detail: 'می‌توانید با کلیدهای جهت‌دار یا W/A/S/D دوباره راه بروید.',
        tone: 'ready',
      };
    }
  }
}

/**
 * حالت حرکت را از پرچم‌های رابط می‌سازد تا هر پوسته فقط وضعیت خام را بدهد.
 * اولویت از سخت‌گیرترین قید به آزادترین است.
 */
export function resolveMovementMode(flags: {
  cinematic?: boolean;
  modalOpen?: boolean;
  pointerLocked?: boolean;
}): MovementMode {
  if (flags.cinematic) return 'cinematic';
  if (flags.modalOpen) return 'modal';
  if (flags.pointerLocked) return 'pointer-lock';
  return 'free';
}
