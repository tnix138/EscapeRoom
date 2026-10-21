---
document_type: agent_entrypoint
intended_audience: coding_agents_only
human_reading: not_required
---

# Repository agent entrypoint

> This repository's active project specification is intentionally written for agents, not for end users or general human reading.

## Required read order

1. [`AGENTS.md`](./AGENTS.md) — execution and Worklog rules.
2. [`DOCUMENTATION.md`](./DOCUMENTATION.md) — canonical product, architecture, ownership and 10-wave plan.
3. Your role plan — [`AGENT-TOHID.md`](./AGENT-TOHID.md), [`AGENT-AMIRALI.md`](./AGENT-AMIRALI.md), [`AGENT-ALIREZA.md`](./AGENT-ALIREZA.md) or [`AGENT-INFRA.md`](./AGENT-INFRA.md).
4. The specific `WAVE-N-OWNER.md` card only if a wave is explicitly assigned.
5. [`WORKLOG.md`](./WORKLOG.md) — required commit/push/PR log procedure.

The old `PROJECT.md`, `ARCHITECTURE.md`, `API-CONTRACT.md`, `TEAM.md` and `TASKS-*.md` files are retained as legacy pointers for historical links. They are **not active task instructions**; if a detail conflicts, use `DOCUMENTATION.md` and the assigned wave file.

## Local validation

```bash
npm ci
npm run typecheck
npm test
npm run worklog:check
```
