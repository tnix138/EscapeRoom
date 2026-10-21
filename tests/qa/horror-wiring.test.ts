// تست اتصال اتمسفر ترس به صحنهٔ واقعی بازی (فاز ۰۷ / Issue #80 و #90)
// پیاده‌سازی مه و صدای ترس تست داشت، ولی هیچ صحنه‌ای آن‌ها را mount نمی‌کرد؛
// این تست همان شکاف را می‌بندد: مه باید با سطح ترس در صحنهٔ کوچه زنده باشد،
// صدا فقط بعد از تعامل کاربر راه بیفتد و در unmount آزاد شود.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HORROR_LEVELS,
  horrorHeartbeatMs,
  horrorLevelIntensity,
} from '../../src/components/hud/horror/horror-signal';
import { heartbeatIntervalMs } from '../../src/audio/horror/horror-audio';
import { fearFogDensity } from '../../src/engine3d/horror/fear-fog';

const source = readFileSync(
  path.join(process.cwd(), 'src/components/alley/AlleyRoomThreeIntegration.tsx'),
  'utf8',
);

describe('#90 — مهِ ترس در صحنهٔ کوچه', () => {
  it('مه به صحنه افزوده و با سطح ترس HUD هم‌گام می‌شود', () => {
    expect(source).toContain("import { FearResponsiveFog } from '@/engine3d/horror/fear-fog'");
    expect(source).toContain('new FearResponsiveFog(engine.scene');
    expect(source).toContain('fog.update(delta)');
    expect(source).toContain('fogRef.current?.setFearLevel(horrorLevelIntensity(horrorLevel))');
    expect(source).toContain('fog.dispose()');
  });

  it('ترتیب چگالی مه با سه سطح ترس صعودی است', () => {
    const densities = HORROR_LEVELS.map((level) => fearFogDensity(horrorLevelIntensity(level)));
    expect(densities[0]).toBeLessThan(densities[1] as number);
    expect(densities[1]).toBeLessThan(densities[2] as number);
  });
});

describe('#90 — صدای ترس در صحنهٔ کوچه', () => {
  it('صدا فقط با تعامل کاربر راه می‌افتد و در unmount آزاد می‌شود', () => {
    expect(source).toContain("import { HorrorAudio } from '@/audio/horror/horror-audio'");
    expect(source).toContain('new HorrorAudio()');
    expect(source).toContain('await audio.init()');
    expect(source).toContain('audio.startAmbience()');
    expect(source).toContain('audio.startHeartbeat()');
    expect(source).toContain('void audio.dispose()');
    // init نباید در effect خودکار صدا شود؛ فقط در handler کلیک
    expect(source).toContain('void startHorrorAudio(); requestPointerLock();');
  });

  it('ضربان قلب با سطح ترس تندتر می‌شود و با مدل HUD هم‌خوان است', () => {
    const [calm, tense, panic] = HORROR_LEVELS;
    const intervals = [calm, tense, panic].map((level) => heartbeatIntervalMs(horrorLevelIntensity(level)));
    expect(intervals[0]).toBeGreaterThan(intervals[1] as number);
    expect(intervals[1]).toBeGreaterThan(intervals[2] as number);
    // مدل HUD و موتور صدا دو فرمول جدا دارند، ولی نباید در جهت مخالف هم باشند:
    // ضربان موتور صدا همیشه مساوی/تندتر از انیمیشن HUD است و اختلاف از ۴۰٪ بیشتر نمی‌شود.
    for (const level of HORROR_LEVELS) {
      const hud = horrorHeartbeatMs(level);
      const audio = heartbeatIntervalMs(horrorLevelIntensity(level));
      expect(audio).toBeLessThanOrEqual(hud);
      expect(audio / hud).toBeGreaterThan(0.6);
    }
  });
});
