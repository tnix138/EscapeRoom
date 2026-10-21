---
agent: Tohid
wave: 1
status: READY_FOR_AGENT_REVIEW
audience: coding_agent_only
code_changes: prohibited
---

# Tohid — WAVE 1 task

> Agent task file. Follow `AGENTS.md`, `DOCUMENTATION.md` and `WORKLOG.md`. Do not treat legacy docs as competing instructions.

## Assignment

Audit the current server/data/client boundary for the 3D redesign. Work only in Tohid-owned scope; **do not modify gameplay code, contracts or migrations in this wave**.

## Required actions

1. Inspect `src/contracts/**`, `src/engine/**`, `src/server/**`, `src/app/api/**` and `src/client-sdk/**`.
2. Record which state is server-authoritative today: room membership, ticket puzzle, door actions, phases, persistence, cutscene clock and inspection progress.
3. Confirm whether any world-space player position/transform is currently represented or synchronized. Do not assume it is.
4. Recommend whether teammates need to see each other's transforms in the first 3D release. Until that decision is approved, do not propose per-frame keyboard/mouse input transmission.
5. Add only Tohid's findings/decision to `REDESIGN-WAVE-1.md` if it changes or clarifies the current record. If no correction is needed, report “confirmed; no change.”

## Deliverable

A short findings note covering current authority, missing movement-state contract, and a recommendation for a minimal future sync boundary if needed.

## Acceptance / stop

- No source-code, API-type, database or migration changes.
- No Vercel/Supabase access or deployment.
- No edits to Amirali/Alireza files.
- Wave 1 ends after review evidence is recorded; do not start Wave 2 without the wave gate.
