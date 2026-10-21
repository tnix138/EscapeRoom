---
agent: Amirali
wave: 1
status: READY_FOR_AGENT_REVIEW
audience: coding_agent_only
code_changes: prohibited
---

# Amirali — WAVE 1 task

> Agent task file. Follow `AGENTS.md`, `DOCS/DOCUMENTATION.md` and `WORKLOG.md`. Do not treat legacy docs as competing instructions.

## Assignment

Audit the current reservation, invitation, alley, ticket and chat experience for the redesign. Work only in Amirali-owned scope; **do not change CSS or UI code in this wave**.

## Required actions

1. Inspect the current entry/reservation/invitation/alley/chat UI and relevant CSS in `src/app/**` and `src/components/{reservation,invitation,alley,hud}/**`.
2. Identify font-size rules below the new readability thresholds and the screens/components affected. The current target is desktop browser Zoom 100%, no forced Zoom-in.
3. Apply these design targets in the audit: primary text ≥16px, secondary text ≥14px, noncritical detail ≥12px; preserve RTL, adequate contrast, line height, focus and mobile usability.
4. Confirm that the ticket/clue/door/chat interactions need to stay accessible while their presentation is moved into a real 3D world by the responsible owner.
5. Add only Amirali's findings to `DOCS/waves/redesign/REDESIGN-WAVE-1.md` if corrections are needed. Otherwise report “confirmed; no change.”

## Deliverable

A short inventory of the smallest/least readable UI areas and a desktop/mobile acceptance checklist for Wave 2+.

## Acceptance / stop

- No source-code/CSS changes.
- No edits to Tohid/Alireza files or runtime.
- Do not redesign 3D rendering or change game rules.
- End after audit evidence; do not start Wave 2 without the wave gate.
