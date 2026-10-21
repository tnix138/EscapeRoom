import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildRoster,
  describeRosterEntry,
  fallbackSeatLabel,
  isCueDismissed,
  presenceSummary,
  rosterInitial,
  storyCueFor,
  toPersianNumber,
} from '../../src/components/hud/theater-roster';

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

function playersFor(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    playerId: `seat-${index + 1}`,
    playerName: `همراه ${index + 1}`,
    seatLabel: `ردیف ۱ — صندلی ${index + 1}`,
    seatIndex: index,
    isOnline: index % 2 === 0,
    ticketPunched: index === 0,
    hasWatchedInvitation: true,
  }));
}

describe('wave 7 — companion roster', () => {
  it('lists teammates in seat order and marks the current player', () => {
    const roster = buildRoster(playersFor(5), 'seat-3');
    expect(roster.map((entry) => entry.playerId)).toEqual([
      'seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5',
    ]);
    expect(roster[2].isMe).toBe(true);
    expect(roster.filter((entry) => entry.isMe)).toHaveLength(1);
    expect(roster[0].progressLabel).toBe('بلیط پانچ‌شده');
    expect(roster[1].progressLabel).toBe('دعوت‌نامه دیده‌شده');
  });

  it('keeps names, seats and online status readable for groups of three to eight', () => {
    for (let size = 3; size <= 8; size += 1) {
      const roster = buildRoster(playersFor(size), 'seat-1');
      expect(roster).toHaveLength(size);
      expect(roster.every((entry) => entry.name.length > 0)).toBe(true);
      expect(roster.every((entry) => entry.seatLabel.length > 0)).toBe(true);
      expect(roster.every((entry) => entry.statusLabel === 'آنلاین' || entry.statusLabel === 'آفلاین')).toBe(true);
      const online = roster.filter((entry) => entry.isOnline).length;
      expect(presenceSummary(roster)).toContain(toPersianNumber(online));
      expect(presenceSummary(roster)).toContain(toPersianNumber(size));
    }
  });

  it('falls back to a Persian seat label when the server omits one', () => {
    expect(fallbackSeatLabel(0)).toBe('صندلی ۰۱');
    expect(fallbackSeatLabel(7)).toBe('صندلی ۰۸');
    const roster = buildRoster(
      [{ playerId: 'a', playerName: '  ', seatIndex: 2, seatLabel: null }],
      'b',
    );
    expect(roster[0].name).toBe('مهمان');
    expect(roster[0].seatLabel).toBe('صندلی ۰۳');
    expect(roster[0].statusLabel).toBe('آنلاین');
  });

  it('builds an accessible description and an initial for every row', () => {
    const [entry] = buildRoster(playersFor(3), 'seat-1');
    const description = describeRosterEntry(entry);
    expect(description).toContain(entry.name);
    expect(description).toContain(entry.seatLabel);
    expect(description).toContain('(شما)');
    expect(rosterInitial('امیرعلی')).toBe('ا');
    expect(rosterInitial('   ')).toBe('؟');
  });

  it('handles an empty room without crashing', () => {
    expect(buildRoster([], 'seat-1')).toEqual([]);
    expect(presenceSummary([])).toContain('هم‌تیمی');
  });
});

describe('wave 7 — story cues', () => {
  it('gives each phase its own chapter and title', () => {
    const phases = ['alley_puzzle', 'door_cutscene', 'theater_cutscene', 'in_theater'] as const;
    const ids = phases.map((phase) => storyCueFor(phase).id);
    expect(new Set(ids).size).toBe(phases.length);
    for (const phase of phases) {
      const cue = storyCueFor(phase);
      expect(cue.chapter.length).toBeGreaterThan(0);
      expect(cue.title.length).toBeGreaterThan(0);
      expect(cue.body.length).toBeGreaterThan(0);
    }
    expect(storyCueFor('unknown_phase').id).toBe('unknown-phase');
  });

  it('reflects alley progress without revealing any answer', () => {
    const cue = storyCueFor('alley_puzzle', { punchedCount: 2 });
    expect(cue.body).toContain('۲');
    expect(cue.body).not.toMatch(/[0-9۰-۹]{3,}/); // هیچ کد درّی در متن نیست
  });

  it('counts inspected hall sections', () => {
    const cue = storyCueFor('in_theater', { inspectedCount: 2, hotspotTotal: 5 });
    expect(cue.body).toContain('۲');
    expect(cue.body).toContain('۵');
    expect(storyCueFor('in_theater').body).toContain('ثبت می‌شود');
  });

  it('remembers dismissed cues by stable id', () => {
    expect(isCueDismissed('in-theater', [])).toBe(false);
    expect(isCueDismissed('in-theater', ['alley-puzzle', 'in-theater'])).toBe(true);
  });
});

describe('wave 7 — accessible, low-interference HUD', () => {
  it('keeps the panel collapsed by default and keyboard operable', () => {
    const hud = read('../../src/components/hud/TheaterCompanionHud.tsx');
    expect(hud).toContain('aria-expanded={isOpen}');
    expect(hud).toContain('aria-controls="companion-body"');
    expect(hud).toContain('aria-label="همراه تماشاخانه"');
    expect(hud).toContain('<ul className="companion-roster" aria-label="فهرست هم‌تیمی‌ها و صندلی‌ها">');
    expect(hud).toContain('aria-live="polite"');
    expect(hud).toContain('defaultOpen = false');
    expect(hud).not.toContain('fetch(');
    expect(hud).not.toContain('EventSource');
  });

  it('is mounted wherever Amirali owns the shell', () => {
    for (const scene of [
      '../../src/components/alley/AlleyFirstPersonScene.tsx',
      '../../src/components/alley/AlleyRoomThreeIntegration.tsx',
    ]) {
      const source = read(scene);
      expect(source).toContain("import TheaterCompanionHud from '../hud/TheaterCompanionHud'");
      expect(source).toContain('<TheaterCompanionHud');
    }
  });

  it('stays out of the scene center and keeps readable type', () => {
    const css = read('../../src/app/globals.css');
    const block = css.slice(css.indexOf('.theater-companion-hud {'));
    expect(block).toContain('position: fixed');
    expect(block).toMatch(/right:\s*18px/);
    expect(block).toContain('max-width: calc(100vw - 36px)');
    const sizes = [...css.matchAll(/font-size:\s*([0-9.]+)px/g)].map((match) => Number(match[1]));
    expect(sizes.filter((size) => size < 12)).toHaveLength(0);
    expect(css).toMatch(/\.companion-toggle\s*\{[^}]*min-height:\s*54px/);
    expect(css).toMatch(/\.companion-row\s*\{[^}]*min-height:\s*46px/);
  });
});
