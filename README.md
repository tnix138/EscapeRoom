---
document_type: agent_entrypoint
intended_audience: coding_agents_only
human_reading: not_required
---

# Repository agent entrypoint

> This repository's active project specification is intentionally written for agents, not for end users or general human reading.

## Required read order

1. [`AGENTS.md`](./AGENTS.md) — execution and Worklog rules.
2. [`DOCS/DOCUMENTATION.md`](./DOCS/DOCUMENTATION.md) — canonical product, architecture, ownership and 10-wave plan.
3. Your role plan — [`DOCS/agents/AGENT-TOHID.md`](./DOCS/agents/AGENT-TOHID.md), [`DOCS/agents/AGENT-AMIRALI.md`](./DOCS/agents/AGENT-AMIRALI.md), [`DOCS/agents/AGENT-ALIREZA.md`](./DOCS/agents/AGENT-ALIREZA.md) or [`DOCS/agents/AGENT-INFRA.md`](./DOCS/agents/AGENT-INFRA.md).
4. The specific `DOCS/waves/cards/WAVE-N-OWNER.md` card only if a wave is explicitly assigned.
5. [`WORKLOG.md`](./WORKLOG.md) — required commit/push/PR log procedure.

The old `DOCS/legacy/PROJECT.md`, `DOCS/legacy/ARCHITECTURE.md`, `DOCS/legacy/API-CONTRACT.md`, `DOCS/legacy/TEAM.md` and `DOCS/legacy/TASKS-*.md` files are retained as legacy pointers for historical links. They are **not active task instructions**; if a detail conflicts, use `DOCS/DOCUMENTATION.md` and the assigned wave file.

## Repository layout

```
README.md          # این فایل: نقطهٔ ورود ایجنت‌ها
AGENTS.md          # قوانین اجرا و لاگ‌گذاری
WORKLOG.md         # دفتر خودکار فعالیت‌ها (از logs/ ساخته می‌شود)
logs/              # pending/ و archive/ — تاریخچهٔ خام لاگ‌ها (توسط ابزار worklog)
DOCS/
  INDEX.md         # فهرست کامل اسناد
  DOCUMENTATION.md # مشخصات فعال محصول، معماری، مالکیت و نقشهٔ ۱۰ موج
  agents/          # AGENT-TOHID / AMIRALI / ALIREZA / INFRA
  waves/cards/     # کارت‌های WAVE-N-OWNER
  waves/redesign/  # REDESIGN-WAVE-1..9
  adr/             # ADR‌ها (مثلاً انتخاب رندرر سه‌بعدی)
  legacy/          # اسناد قدیمی فقط برای حفظ پیوندهای تاریخی
```

## Local validation

```bash
npm ci
npm run typecheck
npm test
npm run worklog:check
```
