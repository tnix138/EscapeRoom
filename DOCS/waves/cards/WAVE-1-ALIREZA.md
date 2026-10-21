---
agent: Alireza
wave: 1
status: READY_FOR_AGENT_REVIEW
audience: coding_agent_only
code_changes: prohibited
---

# Alireza — WAVE 1 task

> Agent task file. Follow `AGENTS.md`, `DOCS/DOCUMENTATION.md` and `WORKLOG.md`. Do not treat legacy docs as competing instructions.

## Assignment

Audit the current game scenes, camera and animation implementation against the real-3D/movement target. Work only in Alireza-owned scope; **do not add a renderer or change scene code in this wave**.

## Required actions

1. Inspect `src/components/alley/**`, `src/components/cinema/**`, `src/components/auditorium/**`, `src/audio/**` and the `/room/[code]` route.
2. Identify which parts are CSS/DOM staging, perspective transforms, canvas/WebGL and/or actual scene meshes. Confirm whether world-space player translation exists.
3. Record Wave 2 renderer selection criteria: Next.js client integration, asset pipeline/licensing, bundle size, WebGL availability, target-device performance and graceful failure.
4. Define acceptance for real movement: forward, backward, left/right strafe, camera look, collision/bounds, and return to full control after narrative cutscenes.
5. Record mature character requirements: adult, believable proportions/costumes/animation; not childlike/cartoon-styled.
6. Add only Alireza's findings to `DOCS/waves/redesign/REDESIGN-WAVE-1.md` if corrections are needed. Otherwise report “confirmed; no change.”

## Deliverable

A short rendering/movement baseline report and renderer decision criteria for Wave 2. Do not select/install the renderer yet.

## Acceptance / stop

- No source-code or dependency changes.
- No edits to Amirali/Tohid files.
- No asset downloads.
- End after audit evidence; do not start Wave 2 without the wave gate.
