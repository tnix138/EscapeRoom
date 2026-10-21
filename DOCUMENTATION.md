---
document_type: agent_execution_spec
status: active
intended_audience: coding_agents_only
human_reading: not_required
source_of_truth: true
---

# DOCUMENTATION — agent execution spec

> **AGENT-ONLY FILE.** This is structured project context for coding agents, not user-facing or human-oriented documentation. Do not spend time rewriting it as prose. On startup, identify the agent from the user's name, read that agent's `AGENT-*.md` plan and the explicitly assigned `WAVE-N-*.md` card. `WORKLOG.md` remains the only authority for commit/PR/push logs.

## 0. Authority and work limits

### Agent bootstrap (greeting → plan)

If the user only says “سلام، من [name] هستم؛ کارهامو بخون”, do not ask which task file to use: map the name, load that role plan, find the earliest incomplete wave, and begin it. Continue wave-by-wave after each acceptance gate unless the user explicitly pauses work or an external authorization/dependency is missing.

```yaml
agent_identity_map:
  Tohid: [توحید, Tohid, Tawhid]
  Amirali: [امیرعلی, Amirali]
  Alireza: [علیرضا, Alireza]
  Infrastructure: [ایجنت زیرساخت, Infrastructure, Infra]
startup:
  - identify_self_from_user_greeting
  - read: [AGENTS.md, DOCUMENTATION.md, AGENT_<SELF>.md, WORKLOG.md]
  - read_full_role_plan
  - determine_earliest_incomplete_wave_from_plan_and_worklog
  - execute_that_wave_and_only_owned_paths
  - when_acceptance_passes_record_completion_and_continue_to_next_wave
  - pause_only_for_missing_dependency, explicit_user_gate, or cloud_authorization
  - report_tests_and_limits; do_not_claim_other_agents_work
```

```yaml
priority:
  - this_file: product_direction, ownership, architecture boundaries, wave plan
  - agent_wave_file: exact scope and acceptance criteria for the assigned wave
  - AGENTS.md: git and worklog procedure
  - WORKLOG.md: log lifecycle and validation
legacy_docs:
  files: [PROJECT.md, ARCHITECTURE.md, API-CONTRACT.md, TEAM.md, TASKS-TOHID.md, TASKS-AMIRALI.md, TASKS-ALIREZA.md, TASKS-INFRA-AGENT.md]
  use: historical/context only; do not treat as active task instructions
conflict_rule: this file + assigned wave file win over legacy docs
current_phase: wave_2_runtime_contract
wave_1_status: accepted_after_owner_confirmation
implementation_authorization: no_game_code_in_wave_1
```

Do not claim work was performed by a different agent. If multiple agent processes are not actually available, work sequentially under the assigned scopes and state that honestly. Do not modify another owner's files; request an interface change through the owner/PR.

## 1. Product target (non-negotiable)

```yaml
game:
  genre: online cooperative escape room
  players: 3..8
  perspective: first_person
  world: real_3d_web_world; not_static_panorama; not_css_perspective_only
  playable_movement: [forward, backward, strafe_left, strafe_right]
  movement_lock: temporary_only_during_scripted_narrative
  audience_tone: adult, mature, psychologically atmospheric
  character_style: grounded_proportions, believable_costume_and_animation, non_childlike
  desktop: readable_at_browser_zoom_100_percent; zoom_in_must_not_be_required
  typography_targets_px:
    primary: 16
    secondary: 14
    tertiary_noncritical: 12
  language: Persian
  layout: RTL
  font: Vazirmatn
```

The exact renderer/library has **not** been selected. Select and record it in Wave 2 after checking Next.js client integration, bundle size, licensing, asset workflow, WebGL support and target-device performance. Do not add a graphics dependency during Wave 1.

## 2. Current baseline (verified from repository)

```yaml
stack:
  web: Next.js 15 App Router + React 19 + TypeScript strict
  storage: node:sqlite local; Supabase PostgreSQL production adapter
  realtime: SSE + server-calibrated cutscene clock
  tests: Vitest + Playwright
  graphics_dependency: none
current_game_view:
  alley: CSS/DOM panorama; camera pan, no true player translation
  auditorium_and_cutscene: CSS/DOM and CSS perspective effects
  movement: no world-space forward/back/strafe controller
  desktop_ui: legacy rules include very small 7-10px labels
server_baseline:
  owns: room, ticket puzzle, actions, phase, persistence, cutscene timing
  world_position_contract: absent
vercel:
  config: Next.js, API maxDuration, SSE response headers
  wave_1_action: audit only; no cloud change or deployment
```

Wave 1 makes no gameplay/source-code changes. Preserve existing tests and worklog data. The current implementation is a legacy baseline, not evidence that the 3D target is complete.

## 3. Narrative and gameplay requirements

1. Host reserves a room for 3–8 named players; each gets a unique invitation token/link.
2. Invitation leads to a collaborative alley ticket puzzle. Player `i` has a ticket and a clue for the next player in a cyclic group dependency. Correct punches reveal digits; server validates the door code. Never expose hidden answers or other players' seat tokens in client views.
3. The alley is a walkable three-dimensional space. The player must translate through the environment to approach the playbill, row chart, door and other clues. Existing ticket/chat/lock UI may be redesigned, but must remain readable and accessible.
4. After puzzle completion, a synchronized, scripted theatre/usher cutscene may temporarily lock movement. Server time remains authoritative; refresh must resume at the correct point.
5. After the cutscene, movement returns in the dark damaged auditorium. The horror music and room state persist; players can explore and inspect clues together.
6. Characters and spaces are designed for adults: grounded, proportionate and believable or deliberately mature stylized realism. Avoid childlike/cartoon proportions and presentation.

## 3.1. Story timeline and gameplay contract

```yaml
reservation:
  player_count: 3..8
  player_names: required
  invite: unique_per_seat
invitation:
  duration_ms: 16000
  sequence: [sealed_red_invite, open_invitation, receive_ticket, arrive_at_alley]
alley:
  world: walkable_3d
  clues: [left_playbill, right_row_chart, central_theatre_door]
  player_items: [named_main_ticket, cyclic_teammate_stub]
  puzzle: [three_correct_punches, reveal_digit, all_players_submit_door_code]
auditorium:
  capacity: 20
  layout: 4_rows_x_5_seats
cutscene:
  total_ms: 74000
  door_ms: 11000
  performance_ms: 63000
  movement_lock: scripted_sequence_only
  sync_source: server_clock
post_cutscene:
  phase: in_theater
  movement: restore_forward_backward_strafe
  persistent_state: [dark_room, broken_chandelier, crooked_paintings, vanished_performers, inspected_hotspots]
```

Cutscene beats: 0–11s usher/door; 11–21s entry/seating; 21–40s opera and shadowed man; 40–50s approach/singing/rejection; 50–56s inversion and player shock; 56–67s supernatural attack/room damage/chandelier fall; 67–74s disappearance, darkness and horror ambience. Design characters as adult, mature and grounded.

## 3.2. Existing service/API baseline

Current server contracts remain authoritative for room and puzzle outcomes. Existing routes:

```yaml
GET /api/health: health_and_storage_driver
POST /api/rooms: reserve_3_to_8_named_seats
GET /api/rooms/{code}: authenticated_room_view
POST /api/rooms/{code}/action: ticket_punch_door_unlock_hotspot_inspection
POST /api/rooms/{code}/chat: team_whispers_and_clue_sharing
GET /api/rooms/{code}/stream: SSE_room_updates_and_server_clock
security:
  seat_tokens: random_token; store_sha256_hash
  hidden_puzzle_answers: never_send_to_client
  other_seat_tokens: never_send_to_client
  cutscene_actions: reject_with_CUTSCENE_LOCKED
storage:
  local: node:sqlite
  production: Supabase_PostgreSQL
```

No movement/position endpoint is specified. Do not introduce one unless the Wave 1 sync decision is approved and a shared contract is reviewed.

## 4. Ownership map (strict; new paths are proposals until Wave 2)

| Owner | Exclusive area | Responsibility |
|---|---|---|
| Tohid | `src/server/**`, `src/engine/**`, `src/app/api/**`, `src/client-sdk/**`, `supabase/**`, `tests/tohid/**`; shared `src/contracts/**` only by agreement | server authority, persistence, puzzle, API, multiplayer state and security |
| Amirali | `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/reservation/**`, `invitation/**`, `alley/**`, `hud/**`, `tests/amirali/**` | reservation/invitation, readable RTL interface, clue/puzzle UX and overlays |
| Alireza | proposed `src/engine3d/**` from Wave 2; `src/audio/**`, `src/components/cinema/**`, `src/components/auditorium/**`, `src/app/room/**`, `src/app/preview/**`, `tests/alireza/**` | 3D runtime, camera/movement/collision, scene assembly, mature character animation, cutscene and audio |
| Infrastructure agent (Tohid-managed) | `vercel.json` only when required; cloud operations only via logged request; no game feature code | safe Preview/Production deployment, Supabase migrations and infrastructure smoke tests |

`src/contracts/**` is shared: no owner changes it unilaterally. No agent edits another owner's code or overwrites another branch's work.

## 5. Ten-wave roadmap

| Wave | Shared outcome | Tohid | Amirali | Alireza | Infrastructure |
|---|---|---|---|---|---|
| 1. Audit | Baseline and acceptance criteria; docs only | Audit state/API and world-sync gap | Audit UI/readability and define font scale | Audit CSS scene vs real 3D and movement needs | Audit build/Preview/asset constraints; no cloud changes |
| 2. 3D foundation | Real 3D scene + readable UI shell | Agree scene/state/API boundary | Desktop-first RTL tokens and readable shell | Select/record renderer; implement client runtime and base scene | Preview/bundle/cache review if requested |
| 3. Movement | Walkable first-person controls | Decide if visible player transforms need sync; no raw input streaming | Controls help, sensitivity/accessibility UI | Forward/back/strafe, mouse look, collisions, input | Browser/device Preview checks if requested |
| 4. Alley world | Walkable alley with 3D clues | Stable scene/return identifiers | Clue/prop content and readable interaction UX | Assemble alley, lighting, bounds and collision | Asset cache/licensing/hosting review |
| 5. Reservation-to-world | End-to-end invite to alley entry | Room/invite/session recovery | Reservation/invitation UX and transition | 3D spawn/arrival transition | Isolated Preview only on request |
| 6. Puzzle interactions | 3D investigation + server-validated puzzle | Authoritative punch/door and privacy tests | Ticket, clue, chat and lock UI | 3D targeting/interactions | Migration/smoke checks only when logged |
| 7. Theatre/characters | Mature 3D auditorium and believable characters | Room phase/presence transition | Readable low-obstruction player/story UI | Theatre, character models/rig/animation, performance | Asset size/license/deploy review |
| 8. Cutscene | Synchronized story sequence; movement restored after it | Clock, phase and refresh correctness | Subtitles, audio and lock-state messaging | Timeline, animation/audio and state restore | SSE/cache/timeout review if requested |
| 9. Post-event exploration | Free movement and shared persistent exploration | Persist/sync inspection progress | HUD, chat and readable clues | Damaged auditorium, colliders and hotspots | Backup/restore review if schema changes |
| 10. Integration/release | QA, performance, deployment and cleanup | API/security/migration tests | UX/accessibility/responsive QA | Rendering/control/E2E QA | Approved deploy, smoke test, archive and merged-branch cleanup |

**Wave sequencing:** finish and review acceptance criteria for one wave before opening the next. Do not combine unrelated work or skip dependencies. Wave 1 is audit/documentation only; code work begins in Wave 2 when the Wave 1 gate is accepted.

## 6. Wave 1 gate

Wave 1 is complete when all four tracks have recorded the following:

- Tohid: current server owns room/puzzle/phases; no 3D position contract; raw movement input is not sent to server by default.
- Amirali: desktop Zoom 100% requirement; target 16/14/12px type scale; identify tiny legacy labels for later UI work.
- Alireza: confirm current alley/cinema are CSS/DOM baseline; define world translation/collision/mature-visual criteria; renderer selection deferred to Wave 2.
- Infrastructure: inspect package/config/build/Preview constraints; no deployment, migration or secret change in audit.

Evidence file: `REDESIGN-WAVE-1.md`. Agent-specific execution requests: `WAVE-1-TOHID.md`, `WAVE-1-AMIRALI.md`, `WAVE-1-ALIREZA.md`, `WAVE-1-INFRA.md`.

## 7. Agent execution protocol

```yaml
scope:
  - read: [AGENTS.md, DOCUMENTATION.md, assigned_wave_file, WORKLOG.md]
  - edit: assigned_owner_files_only
  - shared_contracts: coordinate_before_change
cadence:
  - make_small_coherent_commits
  - push_regularly
  - open_early_draft_pr_and_update_it
  - sync_with_main_before_work_and_after_merges
  - never_overwrite_other_owners
completion:
  - tests_and_typecheck_for_changed_scope
  - describe_tests_and_known_limits_in_pr
  - after_pr_merge_delete_only_that_completed_feature_branch
  - never_delete_main_active_unmerged_or_Arena_locked_branch
logging:
  - every_commit_push_pr: WORKLOG.md_procedure
  - Persian_commit_subject_required
cloud:
  - no_supabase_vercel_action_without_pending_log_and_authorization
  - never_write_secrets_to_git_or_logs
```

A source-code agent should not claim a PR was merged or a branch deleted unless the operation actually succeeded. If working inside a branch Arena has locked for the active session, preserve that branch name and do not delete it.
