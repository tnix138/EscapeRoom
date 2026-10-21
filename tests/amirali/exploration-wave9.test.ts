import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALLEY_CLUES,
  HALL_HOTSPOTS,
  allHotspotsInspected,
  buildExplorationState,
  compactSummary,
  describeNote,
  describeProgress,
  inspectedHotspotCount,
  isExplorationPhase,
  objectivesFor,
  toPersianNumber,
  type ExplorationInput,
} from '../../src/components/hud/exploration-hud';

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

function alleyInput(overrides: Partial<ExplorationInput> = {}): ExplorationInput {
  return {
    phase: 'alley_puzzle',
    me: { playerName: 'امیرعلی', seatIndex: 0, ticketPunched: false },
    players: [
      { playerName: 'امیرعلی', seatIndex: 0, ticketPunched: false, isOnline: true },
      { playerName: 'توحید', seatIndex: 1, ticketPunched: true, isOnline: true },
      { playerName: 'علیرضا', seatIndex: 2, ticketPunched: false, isOnline: false },
    ],
    alley: { doorLockState: { punchedCount: 1, requiredCount: 3, attempts: 0 } },
    messages: [],
    visitedClues: [],
    ...overrides,
  };
}

function hallInput(overrides: Partial<ExplorationInput> = {}): ExplorationInput {
  return {
    phase: 'in_theater',
    me: { playerName: 'سارا', seatIndex: 1 },
    players: [
      { playerName: 'سارا', seatIndex: 0, isOnline: true },
      { playerName: 'نیما', seatIndex: 1, isOnline: false },
      { playerName: 'لیلا', seatIndex: 2, isOnline: true },
    ],
    auditorium: {
      inspectedHotspots: {
        'shattered-chandelier': ['سارا', 'نیما'],
        'crooked-paintings': [],
        'three-dark-stages': [],
        'locked-exit-doors': [],
      },
      chapterStatusBanner: 'سالن تاریک از سر گرفته شد.',
    },
    messages: [],
    ...overrides,
  };
}

describe('wave 9 — phase visibility', () => {
  it('shows the HUD only in explorable phases', () => {
    expect(isExplorationPhase('alley_puzzle')).toBe(true);
    expect(isExplorationPhase('in_theater')).toBe(true);
    for (const phase of ['door_cutscene', 'theater_cutscene', 'unknown']) {
      expect(isExplorationPhase(phase)).toBe(false);
      const state = buildExplorationState({ ...hallInput(), phase });
      expect(state.visible).toBe(false);
      expect(state.objectives).toEqual([]);
    }
  });
});

describe('wave 9 — alley objectives', () => {
  it('tracks clue reading, own punch, team punch and the door', () => {
    const objectives = objectivesFor(alleyInput());
    expect(objectives.map((objective) => objective.id)).toEqual([
      'alley-read-clues', 'alley-punch-own', 'alley-team-tickets', 'alley-unlock-door',
    ]);
    expect(objectives[0].detail).toBe('۰ از ۲ سرنخ');
    expect(objectives[2].detail).toBe('۱ از ۳ بلیط');
    expect(objectives.every((objective) => objective.countsForProgress)).toBe(true);
    expect(objectives.every((objective) => objective.done === false)).toBe(true);
  });

  it('completes objectives from the server view', () => {
    const objectives = objectivesFor(alleyInput({
      me: { playerName: 'امیرعلی', seatIndex: 0, ticketPunched: true },
      visitedClues: ['playbill', 'rowChart'],
      players: [
        { playerName: 'امیرعلی', ticketPunched: true, isOnline: true },
        { playerName: 'توحید', ticketPunched: true, isOnline: true },
        { playerName: 'علیرضا', ticketPunched: true, isOnline: true },
      ],
      doorUnlocked: true,
    }));
    expect(objectives.every((objective) => objective.done)).toBe(true);
  });

  it('keeps working for groups of three to eight players', () => {
    for (let size = 3; size <= 8; size += 1) {
      const players = Array.from({ length: size }, (_, index) => ({
        playerName: `بازیکن ${index + 1}`,
        seatIndex: index,
        ticketPunched: index < size - 1,
        isOnline: true,
      }));
      const state = buildExplorationState(alleyInput({
        players,
        alley: { doorLockState: { punchedCount: size - 1, requiredCount: size } },
      }));
      const teamObjective = state.objectives.find((objective) => objective.id === 'alley-team-tickets')!;
      expect(teamObjective.done).toBe(false);
      expect(teamObjective.detail).toBe(`${toPersianNumber(size - 1)} از ${toPersianNumber(size)} بلیط`);
      expect(state.progress.total).toBe(4);
    }
  });

  it('never counts a lead objective in the progress bar', () => {
    const state = buildExplorationState(hallInput());
    const lead = state.objectives.find((objective) => objective.id === 'hall-exit-lead')!;
    expect(lead.countsForProgress).toBe(false);
    expect(state.progress.total).toBe(3);
  });
});

describe('wave 9 — hall objectives and notes', () => {
  it('counts inspected hall sections from the shared server state', () => {
    const input = hallInput();
    expect(inspectedHotspotCount(input)).toBe(1);
    expect(allHotspotsInspected(input)).toBe(false);

    const full = hallInput({
      players: [
        { playerName: 'سارا', seatIndex: 0, isOnline: true },
        { playerName: 'نیما', seatIndex: 1, isOnline: true },
        { playerName: 'لیلا', seatIndex: 2, isOnline: true },
      ],
      messages: [{ id: 'm1', senderName: 'نیما', text: 'سالن را بگردیم', type: 'whisper' }],
      auditorium: {
        inspectedHotspots: {
          'shattered-chandelier': ['سارا'],
          'crooked-paintings': ['نیما'],
          'three-dark-stages': ['لیلا'],
          'locked-exit-doors': ['سارا', 'لیلا'],
        },
      },
    });
    expect(inspectedHotspotCount(full)).toBe(HALL_HOTSPOTS.length);
    expect(allHotspotsInspected(full)).toBe(true);
    const state = buildExplorationState(full);
    expect(state.allTasksDone).toBe(true);
    expect(state.progress.percent).toBe(100);
  });

  it('marks notes as mine, others or untouched', () => {
    const notes = buildExplorationState(hallInput()).notes;
    const chandelier = notes.find((note) => note.id === 'shattered-chandelier')!;
    expect(chandelier.inspected).toBe(true);
    expect(chandelier.mine).toBe(true);
    expect(chandelier.by).toEqual(['سارا', 'نیما']);
    expect(chandelier.statusLabel).toContain('شما');
    expect(chandelier.statusLabel).toContain('۲ نفر');

    const paintings = notes.find((note) => note.id === 'crooked-paintings')!;
    expect(paintings.inspected).toBe(false);
    expect(paintings.statusLabel).toBe('هنوز بررسی نشده');
    expect(describeNote(paintings)).toContain(paintings.title);
    expect(describeNote(paintings)).toContain('هنوز بررسی نشده');
  });

  it('reports someone else’s inspection without claiming it as mine', () => {
    const notes = buildExplorationState(hallInput({
      me: { playerName: 'سارا', seatIndex: 1 },
      auditorium: { inspectedHotspots: { 'crooked-paintings': ['نیما'] } },
    })).notes;
    const paintings = notes.find((note) => note.id === 'crooked-paintings')!;
    expect(paintings.mine).toBe(false);
    expect(paintings.inspected).toBe(true);
    expect(paintings.statusLabel).toBe('نیما بررسی کرده');
  });

  it('lists alley clue notes as read or not read', () => {
    const notes = buildExplorationState(alleyInput({ visitedClues: ['playbill'] })).notes;
    expect(notes.map((note) => note.id)).toEqual(ALLEY_CLUES.map((clue) => clue.id));
    expect(notes[0].statusLabel).toBe('خوانده‌اید');
    expect(notes[1].statusLabel).toBe('خوانده نشده');
  });
});

describe('wave 9 — player trail and chat', () => {
  it('marks exactly one upcoming step as the current place', () => {
    const trail = buildExplorationState(alleyInput({
      visitedClues: ['playbill', 'rowChart'],
      me: { playerName: 'امیرعلی', seatIndex: 0, ticketPunched: true },
      alley: { doorLockState: { punchedCount: 3, requiredCount: 3 } },
    })).trail;
    expect(trail.map((step) => step.state)).toEqual(['done', 'done', 'done', 'current', 'pending', 'pending']);
    expect(trail.filter((step) => step.state === 'current')).toHaveLength(1);
  });

  it('advances the trail inside the dark hall', () => {
    const trail = buildExplorationState(hallInput({
      auditorium: {
        inspectedHotspots: {
          'shattered-chandelier': ['سارا'],
          'crooked-paintings': ['سارا'],
          'three-dark-stages': ['سارا'],
          'locked-exit-doors': [],
        },
      },
    })).trail;
    expect(trail.filter((step) => step.state === 'done').map((step) => step.id)).toEqual([
      'arrive-alley', 'read-clues', 'punch-tickets', 'open-door', 'watch-cutscene',
    ]);
    expect(trail[trail.length - 1].state).toBe('current');
  });

  it('summarizes the last group message', () => {
    const state = buildExplorationState(hallInput({
      messages: [
        { id: 'm1', senderName: 'نیما', text: 'لوستر را دیدم', type: 'whisper' },
        { id: 'm2', senderName: 'لیلا', text: 'درها قفل‌اند', type: 'system' },
      ],
    }));
    expect(state.chat.total).toBe(2);
    expect(state.chat.lastSender).toBe('لیلا');
    expect(state.chat.lastText).toBe('درها قفل‌اند');
    expect(state.chat.hasMessages).toBe(true);
    expect(buildExplorationState(hallInput()).chat.hasMessages).toBe(false);
  });

  it('completes the “share notes” objective once the team speaks', () => {
    const quiet = buildExplorationState(hallInput()).objectives.find((objective) => objective.id === 'hall-share-notes')!;
    expect(quiet.done).toBe(false);
    const talking = buildExplorationState(hallInput({
      messages: [{ id: 'm1', senderName: 'لیلا', text: 'سلام', type: 'whisper' }],
    })).objectives.find((objective) => objective.id === 'hall-share-notes')!;
    expect(talking.done).toBe(true);
  });
});

describe('wave 9 — labels and accessibility text', () => {
  it('uses the provided position label or a phase default', () => {
    expect(buildExplorationState(alleyInput({ positionLabel: 'نزدیک گیشهٔ برنجی' })).positionLabel).toBe('نزدیک گیشهٔ برنجی');
    expect(buildExplorationState(alleyInput()).positionLabel).toBe('کوچهٔ تماشاخانه');
    expect(buildExplorationState(hallInput()).positionLabel).toBe('سالن تاریک · رو به سن');
    expect(buildExplorationState(hallInput({ positionLabel: '   ' })).positionLabel).toBe('سالن تاریک · رو به سن');
  });

  it('describes progress for screen readers', () => {
    const fresh = buildExplorationState(alleyInput());
    expect(describeProgress(fresh)).toContain('۰ از ۴');
    expect(describeProgress(fresh)).toContain('هدف بعدی');
    expect(compactSummary(fresh)).toBe('۰ از ۴');

    const done = buildExplorationState(hallInput({
      players: [
        { playerName: '۱', isOnline: true },
        { playerName: '۲', isOnline: true },
        { playerName: '۳', isOnline: true },
      ],
      messages: [{ id: 'm', senderName: '۱', text: 'سلام', type: 'whisper' }],
      auditorium: {
        inspectedHotspots: {
          'shattered-chandelier': ['۱'],
          'crooked-paintings': ['۲'],
          'three-dark-stages': ['۳'],
          'locked-exit-doors': ['۱'],
        },
      },
    }));
    expect(done.allTasksDone).toBe(true);
    expect(describeProgress(done)).toContain('همهٔ');
    expect(buildExplorationState({ phase: 'alley_puzzle', me: { playerName: 'x' } }).objectives).toHaveLength(4);
  });

  it('keeps the chapter banner from the server as the hall subtitle', () => {
    expect(buildExplorationState(hallInput()).subtitle).toBe('سالن تاریک از سر گرفته شد.');
    expect(buildExplorationState(hallInput({ auditorium: {} })).subtitle).toContain('سالن تاریک است');
  });
});

describe('wave 9 — no hidden answers and no latin digits', () => {
  it('never emits latin digits in generated copy', () => {
    const states = [
      buildExplorationState(alleyInput()),
      buildExplorationState(alleyInput({ visitedClues: ['playbill'], players: [] })),
      buildExplorationState(hallInput()),
      buildExplorationState(hallInput({ players: [] })),
    ];
    for (const state of states) {
      const text = [
        state.title, state.subtitle, state.chapterLabel, state.positionLabel,
        ...state.objectives.flatMap((objective) => [objective.label, objective.detail, objective.hint ?? '']),
        ...state.notes.map((note) => note.statusLabel),
        ...state.trail.map((step) => step.label),
      ].join(' ');
      expect(text).not.toMatch(/[0-9]/);
    }
  });

  it('does not contain known answer words', () => {
    const state = buildExplorationState(hallInput());
    const text = JSON.stringify(state);
    expect(text).not.toContain('رقم طلایی');
    expect(text).not.toContain('رمز ورود');
    expect(text).not.toContain('پاسخ');
  });
});

describe('wave 9 — UI wiring and readable styling', () => {
  it('renders a collapsed, non-blocking panel with accessible controls', () => {
    const hud = read('../../src/components/hud/ExplorationHud.tsx');
    expect(hud).toContain('aria-expanded={isOpen}');
    expect(hud).toContain('aria-controls={panelId}');
    // پنل همیشه در DOM است تا aria-controls به مقصد موجود اشاره کند
    expect(hud).toContain('id={panelId} hidden={!isOpen}');
    expect(hud).toContain('role="progressbar"');
    expect(hud).toContain('aria-valuenow={state.progress.percent}');
    expect(hud).toContain('role="status"');
    expect(hud).toContain('aria-live="polite"');
    expect(hud).toContain("defaultOpen = false");
    expect(hud).toContain("mode === 'hidden'");
    expect(hud).toContain("event.key !== 'Escape'");
    expect(hud).not.toContain('fetch(');
    expect(hud).not.toContain('EventSource');
  });

  it('is mounted in both Amirali alley shells with real state', () => {
    for (const scene of [
      '../../src/components/alley/AlleyFirstPersonScene.tsx',
      '../../src/components/alley/AlleyRoomThreeIntegration.tsx',
    ]) {
      const source = read(scene);
      expect(source).toContain("import ExplorationHud from '../hud/ExplorationHud'");
      expect(source).toContain('<ExplorationHud input={explorationInput}');
      expect(source).toContain('phase: room.phase');
      expect(source).toContain('visitedClues');
    }
    expect(read('../../src/components/alley/AlleyFirstPersonScene.tsx')).toContain("openCluePanel('playbill')");
    expect(read('../../src/components/alley/AlleyFirstPersonScene.tsx')).toContain("openCluePanel('rowChart')");
  });

  it('opens the whisper panel from the HUD through a controlled prop', () => {
    const inline = read('../../src/components/alley/AlleyFirstPersonScene.tsx');
    expect(inline).toContain('onOpenChat={() => setChatOpen(true)}');
    expect(inline).toContain('open={chatOpen}');
    expect(inline).toContain('onOpenChange={setChatOpen}');

    const panel = read('../../src/components/hud/WhisperChatPanel.tsx');
    expect(panel).toContain('open?: boolean');
    expect(panel).toContain('onOpenChange?: (open: boolean) => void');
    expect(panel).toContain('const isOpen = open ?? internalOpen');
  });

  it('stays readable without zoom and keeps 44px targets', () => {
    const css = read('../../src/app/globals.css');
    const sizes = [...css.matchAll(/font-size:\s*([0-9.]+)px/g)].map((match) => Number(match[1]));
    expect(sizes.filter((size) => size < 12)).toHaveLength(0);

    expect(css).toMatch(/\.exploration-toggle\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.exploration-chat-button,\s*\n?\.exploration-hide\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.exploration-restore\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.exploration-panel\s*\{[^}]*max-height:\s*min\(64vh, 540px\)/);
    expect(css).toContain('.exploration-hud');
    expect(css).toMatch(/\.exploration-hud\s*\{[^}]*pointer-events:\s*none/);
  });

  it('docks to a scene-safe corner and keeps Persian reading direction', () => {
    const css = read('../../src/app/globals.css');

    // پایین-چپ و بالاتر از نوار کنترل‌ها؛ نه وسط صحنه، نه زیر اعلان حرکت یا HUD همراهان.
    expect(css).toMatch(/\.exploration-hud\s*\{[^}]*bottom:\s*96px/);
    expect(css).toMatch(/\.exploration-hud\s*\{[^}]*left:\s*clamp\(/);
    expect(css).toMatch(/\.exploration-hud\s*\{[^}]*flex-direction:\s*column-reverse/);
    expect(css).not.toMatch(/\.exploration-hud\s*\{[^}]*left:\s*50%/);
    expect(css).toMatch(/\.movement-notice\s*\{[^}]*top:\s*84px/);
    expect(css).toMatch(/\.exploration-hud\s*\{[^}]*z-index:\s*13[;\s}]/);

    // متن «۱ از ۳» فارسی است و نباید با direction: ltr برعکس خوانده شود.
    expect(css).toMatch(/\.exploration-toggle-progress\s*\{[^}]*white-space:\s*nowrap/);
    expect(css).not.toMatch(/\.exploration-toggle-progress\s*\{[^}]*direction:\s*ltr/);
    expect(css).not.toMatch(/\.exploration-restore-count\s*\{[^}]*direction:\s*ltr/);

    // در موبایل بالاتر از نوار پایین هر دو پوسته می‌نشیند.
    expect(css).toMatch(/@media \(max-width: 720px\)\s*\{\s*\.exploration-hud\s*\{[^}]*bottom:\s*104px/);
  });
});
