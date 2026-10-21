import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CUTSCENE_CUES,
  CUTSCENE_DURATION_MS,
  DOOR_PHASE_END_MS,
  INVITATION_CUES,
  INVITATION_DURATION_MS,
  chapterLabel,
  cueAt,
  cuesBetween,
  describeCue,
  formatClock,
  inspectTrack,
  phaseNotice,
} from '../../src/components/hud/narration/narration-track';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_VOLUME,
  clampVolume,
  describeAudioState,
  describeCaptionState,
  isAudible,
  isCaptionKey,
  isMuteKey,
  isTypingTarget,
  parsePreferences,
  readPreferences,
  resolveAudioShortcut,
  serializePreferences,
  stepVolume,
  toggleMute,
  volumePercentLabel,
  writePreferences,
} from '../../src/components/hud/narration/audio-preferences';
import {
  MOVEMENT_RELEASE_WINDOW_MS,
  describeMovementMode,
  movementNotice,
  resolveMovementMode,
} from '../../src/components/hud/narration/movement-notice';
import { DOOR_CUTSCENE_DURATION_MS, TOTAL_CUTSCENE_DURATION_MS } from '../../src/contracts/types';

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const FORBIDDEN = [/[0-9۰-۹]{3,}/, /رمز/, /پاسخ/, /کدِ در/];

describe('wave 8 — narration track integrity', () => {
  it('covers the invitation prelude without gaps or overlaps', () => {
    const issues = inspectTrack(INVITATION_CUES, FORBIDDEN);
    expect(issues).toMatchObject({ empty: false, unsorted: false, startsLate: false, gaps: [], overlaps: [], forbidden: [] });
    expect(INVITATION_CUES[0].startMs).toBe(0);
    expect(INVITATION_CUES[INVITATION_CUES.length - 1].endMs).toBe(INVITATION_DURATION_MS);
    expect(INVITATION_DURATION_MS).toBe(16_000);
  });

  it('covers the full 74-second cutscene with a single cue at every moment', () => {
    const issues = inspectTrack(CUTSCENE_CUES, FORBIDDEN);
    expect(issues.gaps).toEqual([]);
    expect(issues.overlaps).toEqual([]);
    expect(issues.unsorted).toBe(false);
    expect(issues.forbidden).toEqual([]);
    expect(CUTSCENE_CUES[0].startMs).toBe(0);
    expect(CUTSCENE_CUES[CUTSCENE_CUES.length - 1].endMs).toBe(TOTAL_CUTSCENE_DURATION_MS);
    expect(CUTSCENE_DURATION_MS).toBe(TOTAL_CUTSCENE_DURATION_MS);
    expect(DOOR_PHASE_END_MS).toBe(DOOR_CUTSCENE_DURATION_MS);
  });

  it('samples every second and always finds exactly one cue', () => {
    for (let second = 0; second < 74; second += 1) {
      const matches = CUTSCENE_CUES.filter((cue) => second * 1000 >= cue.startMs && second * 1000 < cue.endMs);
      expect(matches, `second ${second}`).toHaveLength(1);
    }
  });

  it('aligns the dramatic beats with the cinema timing constants', () => {
    const starts = CUTSCENE_CUES.map((cue) => cue.startMs);
    expect(starts).toContain(DOOR_CUTSCENE_DURATION_MS);
    expect(starts).toContain(49_600); // پس زدن دست
    expect(starts).toContain(65_500); // سقوط لوستر
    expect(starts).toContain(67_000); // غیب شدن
    const handover = CUTSCENE_CUES.find((cue) => cue.id === 'hall-handover-to-exploration');
    expect(handover).toBeDefined();
    expect(handover!.text).toContain('می‌توانید بگردید');
  });

  it('never repeats a cue id and never uses latin digits', () => {
    const ids = [...CUTSCENE_CUES, ...INVITATION_CUES].map((cue) => cue.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const cue of [...CUTSCENE_CUES, ...INVITATION_CUES]) {
      expect(cue.text).not.toMatch(/[0-9]/);
      expect(cue.speaker.length).toBeGreaterThan(0);
      expect(chapterLabel(cue.chapter).length).toBeGreaterThan(0);
    }
  });
});

describe('wave 8 — cue lookup', () => {
  it('returns the active cue and null outside the track', () => {
    expect(cueAt(CUTSCENE_CUES, 0)?.id).toBe('door-arrival');
    expect(cueAt(CUTSCENE_CUES, 3_000)?.id).toBe('door-peephole');
    expect(cueAt(CUTSCENE_CUES, 10_999)?.id).toBe('door-open');
    expect(cueAt(CUTSCENE_CUES, 11_000)?.id).toBe('hall-entry');
    expect(cueAt(CUTSCENE_CUES, 73_999)?.id).toBe('hall-handover-to-exploration');
    expect(cueAt(CUTSCENE_CUES, 74_000)).toBeNull();
    expect(cueAt(CUTSCENE_CUES, -1)).toBeNull();
    expect(cueAt(CUTSCENE_CUES, Number.NaN)).toBeNull();
  });

  it('formats clocks in Persian', () => {
    expect(formatClock(0)).toBe('۰:۰۰');
    expect(formatClock(9_000)).toBe('۰:۰۹');
    expect(formatClock(61_000)).toBe('۱:۰۱');
    expect(formatClock(74_000)).toBe('۱:۱۴');
    expect(formatClock(Number.NaN)).toBe('۰:۰۰');
    expect(formatClock(-5_000)).toBe('۰:۰۰');
  });

  it('describes cues and collects ranges', () => {
    const first = CUTSCENE_CUES[0];
    expect(describeCue(first)).toBe(`${first.speaker}: ${first.text}`);
    expect(cuesBetween(CUTSCENE_CUES, 0, 12_000).map((cue) => cue.id)).toEqual([
      'door-arrival', 'door-peephole', 'door-handover', 'door-open', 'hall-entry',
    ]);
    expect(cuesBetween(CUTSCENE_CUES, 12_000, 0)).toHaveLength(5);
  });
});

describe('wave 8 — cutscene start and end notices', () => {
  it('announces the start in the first six seconds only', () => {
    expect(phaseNotice(0, 74_000)?.tone).toBe('start');
    expect(phaseNotice(5_999, 74_000)?.tone).toBe('start');
    expect(phaseNotice(6_000, 74_000)).toBeNull();
    expect(phaseNotice(30_000, 74_000)).toBeNull();
  });

  it('announces the end in the last six seconds', () => {
    expect(phaseNotice(68_000, 74_000)?.tone).toBe('end');
    expect(phaseNotice(74_000, 74_000)?.tone).toBe('end');
    expect(phaseNotice(80_000, 74_000)?.tone).toBe('end');
  });

  it('stays silent for unknown durations', () => {
    expect(phaseNotice(1_000, 0)).toBeNull();
    expect(phaseNotice(Number.NaN, 74_000)).toBeNull();
  });
});

describe('wave 8 — audio preferences', () => {
  it('clamps volume safely', () => {
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(-2)).toBe(0);
    expect(clampVolume(4)).toBe(1);
    expect(clampVolume('loud')).toBe(DEFAULT_VOLUME);
    expect(clampVolume(Number.NaN)).toBe(DEFAULT_VOLUME);
  });

  it('steps volume inside the allowed range', () => {
    expect(stepVolume(0.5, 0.1)).toBe(0.6);
    expect(stepVolume(0.95, 0.1)).toBe(1);
    expect(stepVolume(0.05, -0.1)).toBe(0);
    expect(stepVolume(0.5, 0)).toBe(0.5);
  });

  it('labels volume in Persian percent', () => {
    expect(volumePercentLabel(0)).toBe('۰٪');
    expect(volumePercentLabel(0.35)).toBe('۳۵٪');
    expect(volumePercentLabel(1)).toBe('۱۰۰٪');
  });

  it('mutes without losing the volume and restores it', () => {
    const muted = toggleMute({ muted: false, volume: 0.6, captions: true });
    expect(muted.muted).toBe(true);
    expect(muted.volume).toBe(0.6);
    expect(isAudible(muted)).toBe(false);
    const restored = toggleMute(muted);
    expect(restored.muted).toBe(false);
    expect(restored.volume).toBe(0.6);
    expect(toggleMute({ muted: true, volume: 0, captions: true }).volume).toBe(DEFAULT_VOLUME);
  });

  it('describes audio state for the live region', () => {
    expect(describeAudioState({ muted: true, volume: 0.6, captions: true })).toContain('بی‌صدا');
    expect(describeAudioState({ muted: false, volume: 0, captions: true })).toContain('خاموش');
    expect(describeAudioState({ muted: false, volume: 0.6, captions: true })).toContain('۶۰٪');
    expect(describeCaptionState(true)).toContain('روشن');
    expect(describeCaptionState(false)).toContain('خاموش');
  });

  it('maps keyboard shortcuts and ignores typing fields', () => {
    expect(isMuteKey('m')).toBe(true);
    expect(isMuteKey('م')).toBe(true);
    expect(isCaptionKey('c')).toBe(true);
    expect(isCaptionKey('ث')).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'div', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);

    const prefs = { muted: false, volume: 0.5, captions: true };
    expect(resolveAudioShortcut({ key: 'm' }, prefs)).toEqual({ type: 'toggle-mute' });
    expect(resolveAudioShortcut({ key: 'c' }, prefs)).toEqual({ type: 'toggle-captions' });
    expect(resolveAudioShortcut({ key: 'ArrowUp' }, prefs)).toEqual({ type: 'volume', volume: 0.6 });
    expect(resolveAudioShortcut({ key: 'ArrowDown' }, prefs)).toEqual({ type: 'volume', volume: 0.4 });
    expect(resolveAudioShortcut({ key: 'ArrowUp', ctrlKey: true }, prefs)).toBeNull();
    expect(resolveAudioShortcut({ key: 'm', target: { tagName: 'INPUT' } }, prefs)).toBeNull();
    expect(resolveAudioShortcut({ key: 'x' }, prefs)).toBeNull();
  });

  it('round-trips preferences through storage safely', () => {
    const serialized = serializePreferences({ muted: true, volume: 0.8, captions: false });
    expect(parsePreferences(serialized)).toEqual({ muted: true, volume: 0.8, captions: false });
    expect(parsePreferences('not json')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(JSON.stringify({ v: 99, muted: true }))).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);

    const store: Record<string, string> = {};
    const storage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
    };
    expect(writePreferences(storage, { muted: false, volume: 0.3, captions: true })).toBe(true);
    expect(readPreferences(storage)).toEqual({ muted: false, volume: 0.3, captions: true });

    const throwing = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(readPreferences(throwing)).toEqual(DEFAULT_PREFERENCES);
    expect(writePreferences(throwing, DEFAULT_PREFERENCES)).toBe(false);
    expect(readPreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('wave 8 — movement notices', () => {
  it('prioritises cinematic over modal over pointer lock', () => {
    expect(resolveMovementMode({ cinematic: true, modalOpen: true, pointerLocked: true })).toBe('cinematic');
    expect(resolveMovementMode({ modalOpen: true, pointerLocked: true })).toBe('modal');
    expect(resolveMovementMode({ pointerLocked: true })).toBe('pointer-lock');
    expect(resolveMovementMode({})).toBe('free');
  });

  it('explains why movement is blocked and how to release it', () => {
    const modal = movementNotice({ mode: 'modal' }, 0);
    expect(modal?.tone).toBe('locked');
    expect(modal?.detail).toContain('Esc');

    const cinematic = movementNotice({ mode: 'cinematic' }, 0);
    expect(cinematic?.detail).toContain('کات‌سین');

    const locked = movementNotice({ mode: 'pointer-lock' }, 0);
    expect(locked?.tone).toBe('info');
    expect(locked?.detail).toContain('Esc');
  });

  it('announces a release briefly and then goes quiet', () => {
    const released = movementNotice({ mode: 'free', releasedAtMs: 1_000 }, 2_000);
    expect(released?.tone).toBe('ready');
    expect(released?.text).toContain('آزاد شد');

    expect(movementNotice({ mode: 'free', releasedAtMs: 1_000 }, 1_000 + MOVEMENT_RELEASE_WINDOW_MS)).toBeNull();
    expect(movementNotice({ mode: 'free', releasedAtMs: null }, 5_000)).toBeNull();
    expect(movementNotice({ mode: 'free' }, 5_000)).toBeNull();
  });

  it('describes every mode in Persian', () => {
    for (const mode of ['free', 'pointer-lock', 'modal', 'cinematic'] as const) {
      expect(describeMovementMode(mode).length).toBeGreaterThan(4);
    }
  });
});

describe('wave 8 — UI wiring and readable styling', () => {
  it('mounts captions in the invitation prelude with live announcements', () => {
    const invitation = read('../../src/components/invitation/InvitationCardVideo.tsx');
    expect(invitation).toContain("import NarrationLayer from '../hud/NarrationLayer'");
    expect(invitation).toContain('track={INVITATION_CUES}');
    expect(invitation).toContain('muted={!musicOn}');
    expect(invitation).toContain('onVolumeChange={setVolume}');

    const layer = read('../../src/components/hud/NarrationLayer.tsx');
    expect(layer).toContain('role="status"');
    expect(layer).toContain('aria-live="polite"');
    expect(layer).toContain('aria-pressed={captionsOn}');
    expect(layer).toContain('aria-pressed={!mutedNow}');
    expect(layer).toContain('type="range"');
    expect(layer).toContain('aria-valuetext={volumePercentLabel(effectiveVolume)}');
    expect(layer).toContain('resolveAudioShortcut');
    expect(layer).not.toContain('fetch(');
  });

  it('offers the same layer to cinematic scenes with cutscene defaults', () => {
    const layer = read('../../src/components/hud/NarrationLayer.tsx');
    expect(layer).toContain('track = CUTSCENE_CUES');
    expect(layer).toContain('CUTSCENE_DURATION_MS');
    expect(layer).toContain('showPhaseNotices');
  });

  it('shows movement notices in both alley shells', () => {
    const classic = read('../../src/components/alley/AlleyFirstPersonScene.tsx');
    expect(classic).toContain("import MovementNotice from '../hud/MovementNotice'");
    expect(classic).toContain('<MovementNotice');

    const three = read('../../src/components/alley/AlleyRoomThreeIntegration.tsx');
    expect(three).toContain("import MovementNotice from '../hud/MovementNotice'");
    expect(three).toContain('pointerLocked={isPointerLocked}');

    const notice = read('../../src/components/hud/MovementNotice.tsx');
    expect(notice).toContain('role="status"');
    expect(notice).toContain('aria-live="polite"');
  });

  it('keeps narration text readable and targets tappable', () => {
    const css = read('../../src/app/globals.css');
    const sizes = [...css.matchAll(/font-size:\s*([0-9.]+)px/g)].map((match) => Number(match[1]));
    expect(sizes.filter((size) => size < 12)).toHaveLength(0);

    const caption = css.slice(css.indexOf('.narration-caption {'));
    expect(caption).toContain('font-size: var(--text-lg)');
    expect(css).toMatch(/\.narration-button\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.narration-volume\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.movement-notice\s*\{[^}]*font-size:\s*var\(--text-sm\)/);
  });
});
