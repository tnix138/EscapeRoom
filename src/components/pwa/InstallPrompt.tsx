'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * InstallPrompt — آستانهٔ نصب پیش از ورود به صحنه
 * -------------------------------------------------------------------------
 * روی آیفون تجربهٔ «مرورگر» دو مشکل واقعی دارد:
 *   ۱) نوار آدرس بالا/پایین ارتفاع دید را مدام عوض می‌کند و HUD جابه‌جا می‌شود؛
 *   ۲) صفحهٔ بلیط/اتاق فضای کمتری می‌گیرد و اسکرول ناخواسته می‌سازد.
 * در حالت نصب‌شده (`display-mode: standalone`) صحنه تمام‌صفحه و پایدار است.
 *
 * این لایه پیش از ورود به اتاق یک بار پیشنهاد نصب می‌دهد:
 *   - iOS: مسیر «اشتراک‌گذاری ← افزودن به صفحهٔ خانه»؛
 *   - اندروید: دکمهٔ نصب بومی (رویداد `beforeinstallprompt`).
 * بستن آستانه هرگز مانع بازی نمی‌شود؛ فقط سه روز دوباره پیشنهاد نمی‌شود.
 */

const DISMISS_KEY = 'orfeo:pwa-gate-dismissed-at';
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true;
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const touch = 'ontouchstart' in window;
  const ua = /iPhone|iPad|iPod|Android|Mobile/i.test(window.navigator.userAgent);
  return (coarse && touch) || ua;
}

function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/i.test(ua);
  // آیپد جدید خودش را مک نشان می‌دهد؛ لمس چندنقطه‌ای لو می‌دهد.
  const iPadOs = /Macintosh/i.test(ua) && (window.navigator.maxTouchPoints ?? 0) > 1;
  return iOS || iPadOs;
}

function recentlyDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const pathname = usePathname();
  const inGameRoute = pathname?.startsWith('/room') || pathname?.startsWith('/invite');
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (!inGameRoute) {
      setVisible(false);
      return;
    }
    if (!isMobileDevice() || isStandalone() || recentlyDismissed()) return;
    setIos(isIos());
    setVisible(true);
  }, [inGameRoute]);

  useEffect(() => {
    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  // پس از نصب واقعی، لایه خودش کنار می‌رود.
  useEffect(() => {
    if (!visible) return;
    const query = window.matchMedia?.('(display-mode: standalone)');
    if (!query) return;
    const sync = () => {
      if (query.matches) setVisible(false);
    };
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, [visible]);

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage اختیاری است */
    }
    setVisible(false);
  }

  async function install() {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } catch {
      /* اگر مرورگر اجازه نداد، راهنمای دستی می‌ماند */
    }
    setInstallEvent(null);
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="pwa-gate" role="dialog" aria-modal="true" aria-labelledby="pwa-gate-title" dir="rtl">
      <div className="pwa-gate-card">
        <span className="pwa-gate-seal" aria-hidden="true">✳</span>
        <h2 id="pwa-gate-title">پردهٔ سرخ را نصب کن</h2>
        <p className="pwa-gate-lead">
          این بازی برای «اپ نصب‌شده» طراحی شده است: صحنهٔ سه‌بعدی تمام‌صفحه می‌شود، نوار
          آدرس ارتفاع صفحه را جابه‌جا نمی‌کند و بلیط و نشانگرها دقیقاً در قاب گوشی جا می‌گیرند.
        </p>

        <ol className="pwa-gate-steps">
          {ios ? (
            <>
              <li>
                <span className="pwa-gate-step-icon" aria-hidden="true">⬆</span>
                <span className="pwa-gate-step-text">
                  در سافاری دکمهٔ <strong>اشتراک‌گذاری</strong> را بزن؛ مربع با فلشِ رو به بالا.
                </span>
              </li>
              <li>
                <span className="pwa-gate-step-icon" aria-hidden="true">⊞</span>
                <span className="pwa-gate-step-text">
                  از فهرست، <strong>«افزودن به صفحهٔ خانه»</strong> را انتخاب کن.
                </span>
              </li>
              <li>
                <span className="pwa-gate-step-icon" aria-hidden="true">✳</span>
                <span className="pwa-gate-step-text">بعد از صفحهٔ خانه، بازی را از همان آیکن باز کن.</span>
              </li>
            </>
          ) : (
            <>
              <li>
                <span className="pwa-gate-step-icon" aria-hidden="true">⋮</span>
                <span className="pwa-gate-step-text">
                  در منوی مرورگر گزینهٔ <strong>«نصب اپلیکیشن»</strong> یا «افزودن به صفحهٔ اصلی» را بزن.
                </span>
              </li>
              <li>
                <span className="pwa-gate-step-icon" aria-hidden="true">✳</span>
                <span className="pwa-gate-step-text">بعد از نصب، بازی را از آیکن پردهٔ سرخ باز کن.</span>
              </li>
            </>
          )}
        </ol>

        <div className="pwa-gate-actions">
          {installEvent && !ios && (
            <button type="button" className="pwa-gate-primary" onClick={() => void install()}>
              نصب روی گوشی
            </button>
          )}
          <button type="button" className="pwa-gate-secondary" onClick={dismiss}>
            ادامه در همین مرورگر
          </button>
        </div>
        <p className="pwa-gate-note">
          اگر الان نصب نکنی هم می‌توانی بازی کنی؛ ولی بلیط و صحنه فضای بیشتری برای اسکرول می‌خواهند.
        </p>
      </div>
    </div>
  );
}
