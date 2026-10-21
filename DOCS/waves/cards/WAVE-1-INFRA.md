---
agent: Infrastructure
wave: 1
status: READY_FOR_AGENT_REVIEW
audience: coding_agent_only
cloud_changes: prohibited
---

# Infrastructure agent — WAVE 1 task

> Agent task file. Follow `AGENTS.md`, `DOCS/DOCUMENTATION.md` and `WORKLOG.md`. This is an audit request only.

## Assignment

Review build/deployment constraints for an upcoming browser-based 3D runtime. Do not deploy, migrate, edit environment variables or access production data in Wave 1.

## Required actions

1. Inspect `package.json`, `next.config.mjs`, `vercel.json`, `.env.example` and current Preview/build assumptions.
2. Record whether a 3D library or asset pipeline currently exists. Identify only constraints relevant to client-side WebGL, static assets, bundle/cache and allowed Preview origins.
3. Confirm that current Vercel settings already cover Next.js, API duration and SSE headers; propose no changes unless a concrete Wave 2 build issue appears.
4. Confirm that all Supabase/Vercel actions require a `Pending` worklog request and explicit authorization; never expose secrets.
5. Add only infrastructure findings to `DOCS/waves/redesign/REDESIGN-WAVE-1.md` if corrections are needed. Otherwise report “confirmed; no change.”

## Deliverable

A short build/deploy constraints note. No online Preview or cloud operation is needed for this audit.

## Acceptance / stop

- No code, configuration, migration or secret changes.
- No Vercel/Supabase operation or deployment.
- Do not modify game owners' files.
- End after audit evidence; wait for the Wave 2 gate.
