# 🔦 نورپردازی و ترس

> فازهای مرتبط: ۰۵، ۰۶، ۰۷
> مالک اصلی: علیرضا
> مالک دوم: امیرعلی (فاز ۰۷ — HUD ترسناک)

## چه مشکلی را حل می‌کند؟

الان صحنه‌ها «تخت» به‌نظر می‌رسند. نورپردازی ambient ساده است. ترس از سایه، نور موضعی، مه، و صدای محیطی می‌آید — هیچ‌کدام در سطح لازم نیست.

نتیجه: بازیکن نمی‌ترسد. بازی «یک بازی سه‌بعدی» است، نه «یک بازی ترسناک».

## چه چیزی می‌سازیم؟

### ۱. نورپردازی PBR (فاز ۰۵ — علیرضا)

در `src/engine3d/lighting/`:

- `SceneLighting` — مدیریت نورها (ambient, directional, point, spot).
- `ShadowConfig` — سایه‌های نرم (PCF soft shadows).
- `FogConfig` — مه سه‌بعدی (near/far).
- `LightAnimator` — انیمیشن نورها (سوسو زدن، حرکت).

**محدودهٔ فایل:** `src/engine3d/lighting/**`.

**تست‌های لازم:**
- نور point ساخته می‌شود.
- نور spot سایه می‌اندازد.
- مه با `near`/`far` کار می‌کند.
- انیمیشن نور با `requestAnimationFrame` حرکت می‌کند.

### ۲. مواد و بافت رویه‌ای (فاز ۰۶ — علیرضا)

در `src/engine3d/materials/`:

- `PBRMaterial` — material با normal map رویه‌ای.
- `ProceduralTextures` — تولید normal map، roughness map، AO map در زمان اجرا.
- `WetSurfaceMaterial` — سطح خیس با reflection.

**محدودهٔ فایل:** `src/engine3d/materials/**`.

**تست‌های لازم:**
- material با normal map ساخته می‌شود.
- texture رویه‌ای تولید می‌شود.
- سطح خیس reflection دارد.

### ۳. اتمسفر ترس (فاز ۰۷ — علیرضا + امیرعلی)

**علیرضا (سمت ۳D):**
- `HorrorAudio` — صدای محیطی (باد، پژواک، ضربان قلب).
- `JumpScare` — مدیریت جامپ‌اسکر (مکان، زمان، صدا).
- `Vignette` — post-processing (vignette, grain, chromatic aberration).

**محدودهٔ فایل علیرضا:** `src/engine3d/horror/**`, `src/audio/horror/**`.

**امیرعلی (سمت HUD):**
- `HorrorHud` — نشانگر ترس (لرزش صفحه، تغییر رنگ، پالس قرمز).
- `JumpScareOverlay` — پردهٔ سیاه با متن.

**محدودهٔ فایل امیرعلی:** `src/components/hud/horror/**`.

**تست‌های لازم:**
- جامپ‌اسکر تحریک می‌شود.
- صدای ضربان قلب پخش می‌شود.
- HUD در حالت ترس تغییر می‌کند.

## چه چیزی **نمی‌سازیم** (فعلاً)

- ❌ ray tracing
- ❌ global illumination
- ❌ فیزیک نور واقعی
- ❌ بیش از ۴ نور point هم‌زمان (محدودیت WebGL)

## محدودهٔ فایل (خلاصه)

| مالک | فایل‌ها |
|---|---|
| علیرضا | `src/engine3d/lighting/**`, `src/engine3d/materials/**`, `src/engine3d/horror/**`, `src/audio/horror/**`, `tests/alireza/lighting-*.test.ts` |
| امیرعلی | `src/components/hud/horror/**`, `tests/amirali/horror-*.test.ts` |

## معیار موفقیت

- ✅ سایه‌ها نرم و واقعی‌اند.
- ✅ مه در فاصله دیده می‌شود.
- ✅ سطح خیس reflection دارد.
- ✅ جامپ‌اسکر در زمان درست اتفاق می‌افتد.
- ✅ صدای ضربان قلب در فاز ترس پخش می‌شود.
- ✅ FPS روی موبایل ۳۰+ و دسکتاپ ۶۰ است.

## مرجع بصری

به `VISION.md` مراجعه کنید. مقایسه با **Phasmophobia**.