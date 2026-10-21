---
agent: Tohid
wave: 2
status: REVIEW_COMPLETE_NO_CONTRACT_CHANGE
intended_audience: coding_agents_only
---

# Tohid — WAVE 2 runtime contract boundary

## Gate

Wave 1 owner confirmation was reported by the user in this conversation. The team gate is recorded as accepted in `REDESIGN-WAVE-1.md` and `DOCUMENTATION.md`.

## Scope reviewed

- `src/contracts/types.ts`, `src/contracts/actions.ts`, `src/engine/view-projector.ts`
- `src/engine3d/types.ts`, `src/engine3d/spawn.ts`, `src/engine3d/transition.ts`
- `src/components/alley/AlleyRoomThreeIntegration.tsx`
- `src/app/room/[code]/page.tsx`
- `tests/tohid/contract-conformance.test.ts`

## Boundary decision

No additional shared scene-ID, spawn, movement, or interaction API is needed for the current first 3D release:

1. The server-owned `GamePhase` already selects the current high-level experience: `alley_puzzle`, cutscene phases, or `in_theater`. The room page maps those phases to the relevant client scene; a second server-owned `sceneId` would duplicate that state today.
2. The 3D alley derives deterministic initial spawn from the already-projected `me.playerId` / `me.seatIndex` and stores the local player transform in browser `localStorage`. This supports same-device refresh only; it is not shared or server-authoritative.
3. Existing actions already represent gameplay outcomes (`PUNCH_MY_TICKET`, `UNLOCK_THEATER_DOOR`, and `INSPECT_AUDITORIUM_HOTSPOT`). Scene geometry and Three.js types remain client-only.
4. Teammate transforms remain out of the first-release contract. No movement endpoint, raw input transmission, or renderer state is added to `ClientRoomView`.
5. Cross-device recovery of a player's exact world position is not provided by the current client-local storage. If that becomes a product requirement, define it in a separately reviewed, bounded/versioned contract; do not add it implicitly in this wave.

## Projection evidence

`tests/tohid/contract-conformance.test.ts` asserts the exact serialized `ClientRoomView` and seat keys for all phases and group sizes 3–8, including the phase and seat identity needed by the 3D client. Its exact-key checks also reject renderer-only additions such as `sceneId`, `spawn`, `position`, and `transform` unless the shared contract is intentionally reviewed and updated.

## Validation

- `npm run typecheck` — passed.
- `npm run test:tohid` — 6 files, 39 tests passed.

## Result / stop

Wave 2 Tohid boundary review is complete with **no shared contract, API, database, or migration change**. This is based on the current merged scene integration and the reported Wave 1 approval. Any future cross-device spawn persistence or teammate-avatar sync requires a new shared decision before implementation.
