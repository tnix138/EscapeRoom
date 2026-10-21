/**
 * کپی متن با دو مسیر: Clipboard API و fallback قدیمی `execCommand`.
 * نتیجه به‌صورت discriminated union برمی‌گردد تا UI بتواند کپی دستی پیشنهاد کند.
 */

export type CopyFailureReason = 'unsupported' | 'blocked';

export type CopyResult = { ok: true } | { ok: false; reason: CopyFailureReason };

export interface ClipboardLike {
  writeText?: (text: string) => Promise<void>;
}

export interface CopyEnvironment {
  clipboard?: ClipboardLike | null;
  document?: Document | null;
}

/** fallback برای مرورگرهای قدیمی یا وقتی مجوز کلیپ‌بورد رد شده است. */
export function legacyCopy(text: string, doc: Document | null | undefined): boolean {
  if (!doc || typeof doc.execCommand !== 'function') return false;
  const host = doc.body;
  if (!host) return false;
  const area = doc.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.opacity = '0';
  host.appendChild(area);
  try {
    area.select();
    area.setSelectionRange?.(0, text.length);
    return doc.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/**
 * تلاش برای کپی؛ اول Clipboard API، بعد fallback.
 * در تست می‌توان محیط را تزریق کرد (بدون نیاز به DOM واقعی).
 */
export async function copyText(text: string, environment: CopyEnvironment = {}): Promise<CopyResult> {
  if (!text) return { ok: false, reason: 'unsupported' };
  const clipboard = environment.clipboard ?? (typeof navigator === 'undefined' ? null : navigator.clipboard);
  const doc = environment.document ?? (typeof document === 'undefined' ? null : document);

  let hadClipboardApi = false;
  if (clipboard?.writeText) {
    hadClipboardApi = true;
    try {
      await clipboard.writeText(text);
      return { ok: true };
    } catch {
      // مجوز رد شده یا صفحه در حالت ناامن است؛ fallback را امتحان می‌کنیم.
    }
  }

  if (legacyCopy(text, doc)) return { ok: true };
  return { ok: false, reason: hadClipboardApi ? 'blocked' : 'unsupported' };
}
