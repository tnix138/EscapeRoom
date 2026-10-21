# ADR-001 — انتخاب رندرر سه‌بعدی واقعی برای تماشاخانه اُرفه‌ئو

**تاریخ:** ۱۴۰۴/۰۷/۲۹ — موج ۲ بازطراحی (هسته سه‌بعدی) — مالک: علیرضا

## تصمیم
**Three.js r160+** به عنوان رندرر اصلی انتخاب شد. Babylon.js به عنوان جایگزین دوم ارزیابی شد و کنار گذاشته شد.

## معیارهای ارزیابی (طبق DOCS/DOCUMENTATION.md §1 و DOCS/waves/cards/WAVE-1-ALIREZA.md)

| معیار | Three.js | Babylon.js | PlayCanvas |
|---|---|---|---|
| Next.js 15 App Router سازگاری | ✅ client component + dynamic import، SSR امن (ساخت renderer فقط در useEffect) | ✅ مشابه ولی نیاز به engine بزرگ‌تر | ❌ نیاز به wrapper بیشتر |
| لایسنس | MIT — تجاری آزاد | Apache 2 — آزاد | MIT ولی Editor ابری |
| حجم باندل (gz) | ~150kb core + tree-shaking، کل صحنه پایه < 200kb gz | ~350kb core gz | کوچک ولی وابسته به CDN |
| WebGL / WebGPU | WebGL2 پیش‌فرض، WebGPU experimental در r150+ | WebGL2 + WebGPU پایدارتر | WebGL2 |
| Asset Pipeline | glTF 2.0 رسمی، Draco, KTX2، تعداد ابزار تبدیل بالا | glTF هم پشتیبانی ولی تمرکز روی .babylon | نیاز به تبدیل |
| کاراکتر بزرگسال باورپذیر | پشتیبانی از SkinnedMesh, morphTargets, Mixamo, ReadyPlayerMe | مشابه | مشابه ولی مستندات کمتر |
| Performance هدف (Desktop 60fps, Mobile 30fps) | draw call کم با InstancedMesh، LOD داخلی، اندازه‌گیری با `renderer.info` | مشابه ولی overhead بیشتر | خوب |
| Fallback graceful | `WEBGL.isWebGLAvailable()` + پیام فارسی + صحنه CSS قدیمی | مشابه | مشابه |
| Community / نمونه | بزرگ‌ترین جامعه، مثال‌های alley / theater زیاد | جامعه کوچک‌تر | کوچک‌تر |

## نتیجه
Three.js برای نیاز ما به **جهان قابل پیمایش واقعی، حرکت جلو/عقب/strafe، برخورد ساده و لود مدل‌های بزرگسال** بهینه‌تر است.

## پیامدها
- وابستگی `three` و `@types/three` اضافه شد (MIT).
- همه کد سه‌بعدی فقط در `'use client'` و داخل `useEffect` ساخته می‌شود تا SSR امن بماند.
- چرخه حیات: `renderer.dispose()`, `controls.dispose()`, `geometry.dispose()`, `material.dispose()` در `useThreeEngine` + `ThreeErrorBoundary`.
- Resize با `ResizeObserver` + `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` برای کنترل GPU.
- Fallback: اگر WebGL در دسترس نباشد، کامپوننت `ThreeSceneBase` پیام فارسی «مرورگر شما WebGL را پشتیبانی نمی‌کند» و دکمه بازگشت به نمای کلاسیک را نشان می‌دهد.
- Bundle اندازه‌گیری: `npm run build` → مسیر `/preview/alley` با Three.js حدود 180kb gz اضافه (قابل قبول برای دسکتاپ هدف).

## ارجاع
- `src/engine3d/three-engine.ts` — پیاده‌سازی runtime
- `src/engine3d/useThreeEngine.ts` — هوک Next.js
- `src/engine3d/ThreeErrorBoundary.tsx`
