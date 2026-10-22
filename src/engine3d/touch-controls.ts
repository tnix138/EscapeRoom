/**
 * touch-controls.ts — پد حرکت لمسی برای صحنه‌های سه‌بعدی (موج ریسپانسیو)
 * -----------------------------------------------------------------------
 * روی دسکتاپ حرکت با W/A/S/D انجام می‌شود، ولی گوشی کیبورد ندارد؛ تا پیش از
 * این، بازیکن موبایل فقط می‌توانست دوربین را بچرخاند و هیچ‌وقت جابه‌جا نمی‌شد
 * (یعنی قفل درِ تماشاخانه و رسیدن به hotspotها عملاً غیرممکن بود).
 *
 * این ماژول یک پد جهت‌دار (۴ دکمه) روی گوشهٔ پایین صحنه می‌سازد و بردار حرکت
 * را به‌صورت `forward` / `strafe` برمی‌گرداند. طراحی:
 *  - فقط یک بار ساخته می‌شود و با `dispose` کامل پاک می‌شود؛
 *  - `pointerdown/up/cancel/leave` + `touch-action: none` تا اسکرول صفحه و
 *    منوی نگه‌داشتن لمس (long-press) مزاحم نشود؛
 *  - دکمه‌ها `aria-label` فارسی دارند و با کیبورد هم کار می‌کنند؛
 *  - هیچ وابستگی به Three.js ندارد تا تست‌شدنی بماند.
 */

export interface TouchMoveVector {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

export const EMPTY_TOUCH_MOVE: TouchMoveVector = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
};

type Direction = 'forward' | 'backward' | 'left' | 'right';

const BUTTONS: ReadonlyArray<{ dir: Direction; glyph: string; label: string; className: string }> = [
  { dir: 'forward', glyph: '▲', label: 'جلو رفتن', className: 'touch-pad-up' },
  { dir: 'left', glyph: '◀', label: 'چپ رفتن', className: 'touch-pad-left' },
  { dir: 'right', glyph: '▶', label: 'راست رفتن', className: 'touch-pad-right' },
  { dir: 'backward', glyph: '▼', label: 'عقب رفتن', className: 'touch-pad-down' },
];

export interface TouchControlsHandle {
  readonly element: HTMLElement;
  dispose: () => void;
}

/** آیا دستگاه ورودی لمسی درشت (انگشت) دارد؟ */
export function prefersTouchControls(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia('(pointer: coarse)').matches) return true;
  }
  return 'ontouchstart' in window;
}

/**
 * پد حرکت را داخل `container` می‌سازد و هر تغییر وضعیت را با `onChange`
 * اطلاع می‌دهد. اگر همین container قبلاً پد داشته باشد، پد قبلی جایگزین می‌شود.
 */
export function attachTouchControls(
  container: HTMLElement,
  onChange: (vector: TouchMoveVector) => void,
): TouchControlsHandle {
  container.querySelector('.touch-move-pad')?.remove();

  const pad = document.createElement('div');
  pad.className = 'touch-move-pad';
  pad.setAttribute('role', 'group');
  pad.setAttribute('aria-label', 'پد حرکت — جابه‌جایی در صحنه');
  /* لایهٔ پد نباید پن‌کردن دوربین روی بوم زیرش را قطع کند. */
  pad.addEventListener('pointerdown', (event) => event.stopPropagation());

  const state = { ...EMPTY_TOUCH_MOVE };
  const pressed = new Set<Direction>();

  const emit = () => onChange({ ...state });

  const clear = () => {
    pressed.clear();
    state.forward = state.backward = state.left = state.right = false;
    state.sprint = false;
    emit();
  };

  const releaseButton = (dir: Direction, element: HTMLButtonElement) => {
    if (!pressed.delete(dir)) return;
    state[dir] = false;
    element.classList.remove('is-pressed');
    emit();
  };

  for (const item of BUTTONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `touch-pad-button ${item.className}`;
    button.textContent = item.glyph;
    button.setAttribute('aria-label', item.label);

    const press = () => {
      pressed.add(item.dir);
      state[item.dir] = true;
      button.classList.add('is-pressed');
      emit();
    };

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.setPointerCapture?.(event.pointerId);
      press();
    });
    button.addEventListener('pointerup', (event) => {
      event.preventDefault();
      releaseButton(item.dir, button);
    });
    button.addEventListener('pointercancel', () => releaseButton(item.dir, button));
    button.addEventListener('lostpointercapture', () => releaseButton(item.dir, button));
    button.addEventListener('contextmenu', (event) => event.preventDefault());

    /* کیبورد: Space/Enter نگه‌داشتن حرکت را ساده می‌کند (دسترس‌پذیری). */
    button.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') press();
    });
    button.addEventListener('keyup', (event) => {
      if (event.key === ' ' || event.key === 'Enter') releaseButton(item.dir, button);
    });
    button.addEventListener('blur', () => releaseButton(item.dir, button));

    pad.appendChild(button);
  }

  /* دکمهٔ دویدن روی گوشی: نگه‌داشتن برای سرعت بیشتر */
  const sprint = document.createElement('button');
  sprint.type = 'button';
  sprint.className = 'touch-pad-button touch-pad-sprint';
  sprint.textContent = '»';
  sprint.setAttribute('aria-label', 'دویدن (نگه دارید)');
  sprint.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.sprint = true;
    sprint.classList.add('is-pressed');
    emit();
  });
  const releaseSprint = () => {
    if (!state.sprint) return;
    state.sprint = false;
    sprint.classList.remove('is-pressed');
    emit();
  };
  sprint.addEventListener('pointerup', releaseSprint);
  sprint.addEventListener('pointercancel', releaseSprint);
  sprint.addEventListener('lostpointercapture', releaseSprint);
  sprint.addEventListener('contextmenu', (event) => event.preventDefault());
  pad.appendChild(sprint);

  /* رها شدن لمس بیرون از دکمه‌ها (مثلاً وقتی انگشت از لبه رد می‌شود) */
  const onWindowPointerUp = () => {
    if (pressed.size === 0 && !state.sprint) return;
    for (const button of Array.from(pad.querySelectorAll<HTMLButtonElement>('.touch-pad-button'))) {
      button.classList.remove('is-pressed');
    }
    clear();
  };
  window.addEventListener('pointerup', onWindowPointerUp);
  window.addEventListener('blur', onWindowPointerUp);

  container.appendChild(pad);

  return {
    element: pad,
    dispose: () => {
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('blur', onWindowPointerUp);
      pad.remove();
    },
  };
}
