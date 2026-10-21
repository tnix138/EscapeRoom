---
agent_id: alireza
agent_name: علیرضا
role: 3d_world_and_audio
status: active_plan
intended_audience: coding_agents_only
human_reading: not_required
plan: DOCUMENTATION.md
---

# Agent plan — علیرضا

> **عامل کدنویس بخواند؛ متن برای کاربر نهایی نیست.** پیش از هر موج `AGENTS.md`، `DOCUMENTATION.md`، این فایل و `WORKLOG.md` را بخوان. برای هر موج فقط خروجی تعیین‌شده را بساز.

## هویت و محدوده مالکیت

- مالک: مسیر جدید پیشنهادی `src/engine3d/**` از موج ۲، `src/audio/**`, `src/components/cinema/**`, `src/components/auditorium/**`, `src/app/room/**`, `src/app/preview/**`, `tests/alireza/**`.
- تو مالک server/API، database، ticket business rules یا Amirali UI نیستی. برای تغییر مشترک از interface مورد توافق استفاده کن.
- Target: WebGL/WebGPU world واقعی، movement translation forward/back/strafe، mouse look، collision/bounds; mature adult characters, believable grounded proportions; no childlike/cartoon look.
- Renderer library هنوز انتخاب نشده؛ انتخاب را موج ۲ با ثبت rationale انجام بده، نه در موج ۱.

## برنامهٔ اجرایی ۱۰ موج

| موج | کارهای دقیق | تحویل و معیار پذیرش |
|---|---|---|
| **۱ — ممیزی رندر** | alley/cinema/auditorium/room route را بررسی کن؛ CSS/DOM perspective را از mesh/WebGL واقعی تفکیک کن؛ movement/collision gap و device constraints را ثبت کن. | findings در `REDESIGN-WAVE-1.md`; بدون renderer/dependency/code. |
| **۲ — هسته سه‌بعدی** | گزینه‌های renderer را از نظر Next client lifecycle, license, bundle, WebGL, assets, target devices بسنج؛ یک مورد را با ADR کوتاه انتخاب کن؛ runtime lifecycle, disposal, resize, error boundary و صحنهٔ پایه در `src/engine3d/**` بساز. | صحنه با meshes/depth/light/camera واقعی؛ SSR امن؛ renderer dispose/resize درست؛ bundle/perf اندازه‌گیری. |
| **۳ — کنترل و حرکت** | player controller: forward/back/left/right strafe، mouse look، سرعت قابل تنظیم، delta-time, collision/bounds, pointer-lock fallback, keyboard focus management؛ touch controls در صورت target موبایل. | بازی جابه‌جایی واقعی world-space دارد؛ cannot walk through walls/fall through ground؛ tests/helper + manual QA. |
| **۴ — کوچهٔ سه‌بعدی** | modular alley geometry, scale, lighting, collision, spawn points, playbill/row chart/door anchors را بساز و UI/props امیرعلی را از قرارداد هماهنگ وصل کن. | walkable 3D route, front/left/right clues discoverable at actual distances, no fixed panorama dependency. |
| **۵ — ورود و transition** | spawn location, invitation→alley scene load, return/reconnect placement, door transition و loading feedback را وصل کن؛ state را از server view دریافت کن. | no camera jump; refresh/re-entry stable; no server logic changes. |
| **۶ — هدف‌گیری و تعامل 3D** | raycast/interaction focus, range check, highlight and trigger event for clue/door/ticket panels؛ event handler فقط درخواست UI/API توافق‌شده را فراخواند. | keyboard/mouse interaction, accessible fallback/label, no authoritative puzzle answer in client. |
| **۷ — سالن و شخصیت‌های بزرگسال** | theater geometry, auditorium perspective, seats/empty chairs, stage layout, adult performer/usher models or approved assets, rig/animation; document asset source/license and budget. | plausible proportions/wardrobe/animation; models at scale; named player seating; asset provenance and performance validated. |
| **۸ — timeline و صدا** | implement server-time-driven 74s cutscene; stage cues, audio states and transitions; movement lock only for scripted interval; restore controls after. | refresh resumes correctly; synchronized visual/audio timing; no permanent head-pan-only gameplay. |
| **۹ — سالن آسیب‌دیده و کاوش** | damaged-room variation, broken chandelier, crooked paintings, empty stages, hotspot anchors and walkable collision; consume persisted state. | free movement restored; inspection targets stable across refresh; horror ambience continues without memory leaks. |
| **۱۰ — performance/E2E** | profile GPU/CPU, draw calls, asset loading, frame time, renderer fallback; run scene integration and multiplayer E2E with other owners. | supported devices meet agreed target FPS/budget; no crashes/leaks; `npm run typecheck`, `npm run test:alireza`, build/E2E pass. |

## روش تحویل هر موج

- Work only in Alireza-owned paths; don't edit Amirali CSS/UI or Tohid server/API.
- Small commits frequently; push often; open Draft PR early; update same PR; sync with `main` before work and after merges.
- Run tests relevant to the slice; record decisions/perf/asset licenses in PR; every Commit/Push/PR has Persian Worklog record.
- After Merge remove only the completed feature branch; never delete `main`, active/unmerged branches or the Arena locked branch.
- Wave 1: audit only; no dependency or source changes.
