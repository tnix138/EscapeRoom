import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CUTSCENE_BEAT_WINDOWS,
  beatFromElapsedMs,
} from '../../src/audio/theater-audio-engine';
import {
  CHANDELIER_FALL_AT_MS,
  HAND_REJECTION_AT_MS,
  getAuditoriumTimeline,
  getDoorTimeline,
} from '../../src/components/cinema/cutscene-timing';
import {
  CUTSCENE_CUES,
  CUTSCENE_DURATION_MS,
  cueAt,
  inspectTrack,
} from '../../src/components/hud/narration/narration-track';
import {
  DOOR_CUTSCENE_DURATION_MS,
  TOTAL_CUTSCENE_DURATION_MS,
} from '../../src/contracts/types';
import { resolveRoomPhase } from '../../src/components/room/resolve-room-phase';
import {
  LEFT_WALL_PLAYBILL,
  PLAY_TITLE,
  RIGHT_WALL_ROW_CHART,
} from '../../src/engine/ticket-puzzle';

const read = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const storyDocument = read('../../docs/features/story.md');
const roadmapStoryDocument = read('../../docs-v2/features/story.md');
const audioSource = read('../../src/audio/theater-audio-engine.ts');
const cutsceneSource = read('../../src/components/cinema/FirstPersonCutsceneStage.tsx');

const applyBeatStart = audioSource.indexOf(
  '  applyBeat(beat: CutsceneBeatId): void {',
);
const applyBeatEnd = audioSource.indexOf('  /** میانبر موج ۲:', applyBeatStart);
const applyBeatSource =
  applyBeatStart >= 0 && applyBeatEnd > applyBeatStart
    ? audioSource.slice(applyBeatStart, applyBeatEnd)
    : '';

function audioCase(beat: string): string {
  const start = applyBeatSource.indexOf(`      case '${beat}':`);
  if (start < 0) return '';
  const nextCase = applyBeatSource.indexOf('\n      case ', start + 1);
  return applyBeatSource.slice(start, nextCase < 0 ? undefined : nextCase);
}

describe('روایت رسمی تماشاخانهٔ اُرفه‌ئو', () => {
  it('نام اثر، سال و شخصیت‌های اصلی را در سند روایت ثبت می‌کند', () => {
    for (const document of [storyDocument, roadmapStoryDocument]) {
      expect(document).toContain(PLAY_TITLE);
      expect(document).toContain('۱۹۲۴');
      expect(document).toContain('سینیور مَتِئو');
      expect(document).toContain('بانوی اجرا');
      expect(document).toContain('مرد سیاه‌پوش');
    }
  });

  it('مسیر احساسی و واژه‌نامهٔ فارسی را برای هماهنگی HUD مستند می‌کند', () => {
    for (const document of [storyDocument, roadmapStoryDocument]) {
      for (const term of [
        'ترس',
        'همکاری',
        'کشف',
        'فرار',
        'واژه‌نامهٔ فارسی',
        'بیت روایی',
        'کوپن همراه',
        'رقم طلایی',
      ]) {
        expect(document).toContain(term);
      }
    }
  });

  it('عنوان‌های برنامه و ردیف‌ها را از دادهٔ اصلی معما می‌گیرد', () => {
    expect(LEFT_WALL_PLAYBILL).toHaveLength(4);
    expect(RIGHT_WALL_ROW_CHART).toHaveLength(4);

    for (const act of LEFT_WALL_PLAYBILL) {
      expect(storyDocument).toContain(act.sceneTitle);
    }
    for (const row of RIGHT_WALL_ROW_CHART) {
      expect(storyDocument).toContain(row.rowTitle);
    }
  });
});

describe('پیوستگی روایت و زیرنویس‌های کات‌سین', () => {
  it('خط روایت از آغاز تا پایان ۷۴ ثانیه‌ای شکاف یا هم‌پوشانی ندارد', () => {
    const issues = inspectTrack(CUTSCENE_CUES);
    expect(issues.empty).toBe(false);
    expect(issues.unsorted).toBe(false);
    expect(issues.startsLate).toBe(false);
    expect(issues.gaps).toEqual([]);
    expect(issues.overlaps).toEqual([]);
    expect(CUTSCENE_CUES[0]?.startMs).toBe(0);
    expect(CUTSCENE_CUES[CUTSCENE_CUES.length - 1]?.endMs).toBe(
      TOTAL_CUTSCENE_DURATION_MS,
    );
    expect(CUTSCENE_DURATION_MS).toBe(TOTAL_CUTSCENE_DURATION_MS);
  });

  it('رخدادهای اصلی داستان در لحظهٔ درست زیرنویس دارند', () => {
    const storyMoments: Array<[number, string]> = [
      [0, 'door-arrival'],
      [6_000, 'door-handover'],
      [11_000, 'hall-entry'],
      [26_000, 'hall-curtain'],
      [31_000, 'hall-shadow'],
      [40_000, 'hall-applause'],
      [46_000, 'hall-hand'],
      [HAND_REJECTION_AT_MS, 'hall-inversion'],
      [53_000, 'hall-glare'],
      [56_000, 'hall-slams'],
      [CHANDELIER_FALL_AT_MS, 'hall-chandelier'],
      [67_000, 'hall-vanish'],
      [70_000, 'hall-handover-to-exploration'],
    ];

    for (const [time, cueId] of storyMoments) {
      expect(cueAt(CUTSCENE_CUES, time)?.id).toBe(cueId);
    }
  });

  it('زمان زیرنویس با نقاط تصویریِ تحویل بلیط، ردشدن دست و سقوط لوستر هم‌تراز است', () => {
    expect(DOOR_CUTSCENE_DURATION_MS).toBe(11_000);
    expect(getDoorTimeline(9_000).ticketHandover).toBe(1);
    expect(cueAt(CUTSCENE_CUES, 9_000)?.id).toBe('door-open');

    expect(getAuditoriumTimeline(36_000).darkManReveal).toBe(1);
    expect(HAND_REJECTION_AT_MS).toBe(49_600);
    expect(getAuditoriumTimeline(HAND_REJECTION_AT_MS).handRejectionProgress).toBe(0);
    expect(CHANDELIER_FALL_AT_MS).toBe(65_500);
    expect(getAuditoriumTimeline(CHANDELIER_FALL_AT_MS).chandelierFallProgress).toBe(0);
  });

  it('هیچ زیرنویس یا برچسب بیت، پاسخ معما یا رقم قفل را فاش نمی‌کند', () => {
    const forbidden = [/[0-9۰-۹]{3,}/, /(?:^|\s)رمز(?:$|\s)/, /پاسخ/, /کدِ در/];
    const issues = inspectTrack(CUTSCENE_CUES, forbidden);
    expect(issues.forbidden).toEqual([]);

    for (const window of CUTSCENE_BEAT_WINDOWS) {
      expect(window.labelFa).not.toMatch(/[0-9۰-۹]{3,}/);
      expect(window.labelFa).not.toMatch(/(?:^|\s)رمز(?:$|\s)|پاسخ|کدِ در/);
    }
  });
});

describe('توالی فازهای بازی', () => {
  it('از کوچه به در، سالن و کاوش می‌رود و از فازها نمی‌جهد', () => {
    const phases = [
      resolveRoomPhase('alley_puzzle', 0),
      resolveRoomPhase('alley_puzzle', TOTAL_CUTSCENE_DURATION_MS),
      resolveRoomPhase('door_cutscene', 0),
      resolveRoomPhase('door_cutscene', DOOR_CUTSCENE_DURATION_MS - 1),
      resolveRoomPhase('door_cutscene', DOOR_CUTSCENE_DURATION_MS),
      resolveRoomPhase('theater_cutscene', TOTAL_CUTSCENE_DURATION_MS - 1),
      resolveRoomPhase('theater_cutscene', TOTAL_CUTSCENE_DURATION_MS),
      resolveRoomPhase('in_theater', 0),
    ];

    expect(phases).toEqual([
      'alley_puzzle',
      'alley_puzzle',
      'door_cutscene',
      'door_cutscene',
      'theater_cutscene',
      'theater_cutscene',
      'in_theater',
      'in_theater',
    ]);
  });
});

describe('اتصال بیت‌های داستان به موسیقی و افکت‌های صحنه', () => {
  it('بیت‌های صوتی کل ۷۴ ثانیه را بدون شکاف پوشش می‌دهند', () => {
    expect(CUTSCENE_BEAT_WINDOWS).toHaveLength(10);
    expect(CUTSCENE_BEAT_WINDOWS[0]?.startMs).toBe(0);

    for (let index = 1; index < CUTSCENE_BEAT_WINDOWS.length; index += 1) {
      expect(CUTSCENE_BEAT_WINDOWS[index]?.startMs).toBe(
        CUTSCENE_BEAT_WINDOWS[index - 1]?.endMs,
      );
    }

    expect(CUTSCENE_BEAT_WINDOWS[CUTSCENE_BEAT_WINDOWS.length - 1]?.endMs).toBe(
      TOTAL_CUTSCENE_DURATION_MS,
    );
  });

  it('موسیقی و افکت‌ها با رخداد روایی متناظر فعال می‌شوند', () => {
    const audioMoments: Array<[number, string]> = [
      [21_000, 'classical_music_curtain_dance'],
      [31_000, 'tall_dark_man_left_shadow'],
      [40_000, 'man_walks_claps_extends_hand'],
      [46_000, 'woman_sings_rejects_hand'],
      [50_000, 'red_filthy_inversion_terror'],
      [53_000, 'man_glares_pushes_players'],
      [56_000, 'choke_slams_shake_chandelier'],
      [67_000, 'vanish_dark_music_remains'],
    ];

    for (const [time, beat] of audioMoments) {
      expect(beatFromElapsedMs(time)).toBe(beat);
    }

    const expectedAudioCalls: Array<[string, string]> = [
      ['classical_music_curtain_dance', 'this.startClassical();'],
      ['tall_dark_man_left_shadow', 'this.playShadowUndertone();'],
      ['man_walks_claps_extends_hand', 'this.playSlowClaps(4, 0.95);'],
      ['woman_sings_rejects_hand', 'this.startSoprano();'],
      ['red_filthy_inversion_terror', 'this.startHorrorAmbience(0.45);'],
      ['man_glares_pushes_players', 'this.playSeatShockwave();'],
      ['choke_slams_shake_chandelier', 'this.startRoomRumble();'],
      ['vanish_dark_music_remains', 'this.startHorrorAmbience(1);'],
    ];

    for (const [beat, call] of expectedAudioCalls) {
      expect(audioCase(beat)).toContain(call);
    }

    expect(cutsceneSource).toContain('engine.syncToElapsedMs(clampedElapsed);');
    expect(cutsceneSource).toContain('engine.playHandRejection();');
    expect(cutsceneSource).toContain('engine.playBodySlam(impact.surface');
    expect(cutsceneSource).toContain('engine.playChandelierFall(');
  });
});
