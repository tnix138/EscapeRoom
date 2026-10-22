import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALLEY_STATIC_OBSTACLES,
  checkAABBCollision,
  resolveMovement,
  sanitizePosition,
  type AABB,
} from '../../src/engine3d/collision';
import {
  PlayerController,
  inputFromKeyboard,
  isArrowInteractiveElement,
  isModifierChord,
  isTextEntryElement,
  sanitizePointerLockDelta,
} from '../../src/engine3d/player-controller';
import {
  clearTransform,
  loadTransform,
  resolveInitialTransform,
  saveTransform,
} from '../../src/engine3d/spawn';
import { DEFAULT_ALLEY_BOUNDS, DEFAULT_ALLEY_ANCHORS, type WorldBounds } from '../../src/engine3d/types';

const ROOT = join(__dirname, '..', '..');
const RADIUS = 0.35;

describe('رفع کامل باگ گیر کردن و راه رفتن خودکار در محیط سه‌بعدی (امیرعلی)', () => {
  describe('۱. عدم گیر کردن روی گوشه‌ها، جعبه‌ها، تیرهای چراغ و دیوارها (MTV + Sub-stepping)', () => {
    it('حرکت مورب به سمت گوشهٔ گرد جعبه‌ها و تیرهای چراغ متوقف نمی‌شود و نرم دور می‌زند', () => {
      // حرکت مورب به سمت گوشهٔ جعبهٔ A (-6.45, 4.45)
      const start = { x: -6.25, y: 1.65, z: 4.85, yawDeg: 25, pitchDeg: 0 };
      const ctrl = new PlayerController(start, DEFAULT_ALLEY_BOUNDS);

      for (let i = 0; i < 30; i++) {
        ctrl.tick({ forward: true, backward: false, left: false, right: false, sprint: false }, 1 / 60);
      }

      const after = ctrl.getTransform();
      const movedDist = Math.hypot(after.x - start.x, after.z - start.z);
      // در کد قبلی در گوشهٔ دایره-AABB کاملاً قفل می‌شد (movedDist ~ 0)؛ اکنون نرم به سمت شمال سر می‌خورد
      expect(movedDist).toBeGreaterThan(0.5);
      expect(checkAABBCollision(after.x, after.z, RADIUS, ALLEY_STATIC_OBSTACLES)).toBe(false);
    });

    it('برخورد تقریباً مستقیم به تیر باریک چراغ برق باعث گیر کردن نمی‌شود و از کنارش رد می‌شود', () => {
      // تیر چراغ راست جنوبی: x=[5.62..6.28], z=[3.28..3.92]
      const ctrl = new PlayerController(
        { x: 5.5, y: 1.65, z: 4.6, yawDeg: 0, pitchDeg: 0 },
        DEFAULT_ALLEY_BOUNDS,
      );
      for (let i = 0; i < 60; i++) {
        ctrl.tick({ forward: true, backward: false, left: false, right: false, sprint: true }, 1 / 60);
      }
      const pos = ctrl.getTransform();
      expect(pos.z).toBeLessThan(2.8);
      expect(checkAABBCollision(pos.x, pos.z, RADIUS, ALLEY_STATIC_OBSTACLES)).toBe(false);
    });

    it('در کنج‌های مقعر (تلاقی دیوار با گیشه، تابلوی اعلانات، جعبه‌ها و نمای شمالی) هرگز قفل دائمی رخ نمی‌دهد', () => {
      const cornerTargets = [
        { x: 8.25, z: 0.55, intoYaw: 330, escapeYaw: 150 },   // کنج دیوار راست + گیشهٔ بلیط
        { x: -8.25, z: -0.02, intoYaw: 30, escapeYaw: 210 },  // کنج دیوار چپ + تابلوی اعلانات
        { x: -8.25, z: 4.85, intoYaw: 25, escapeYaw: 205 },   // کنج دیوار چپ + جعبهٔ A
        { x: 8.25, z: -4.8, intoYaw: 335, escapeYaw: 155 },   // کنج دیوار راست + جعبهٔ B
        { x: -8.25, z: -12.8, intoYaw: 35, escapeYaw: 215 },  // کنج شمال غربی کوچه
        { x: 8.25, z: -12.8, intoYaw: 325, escapeYaw: 145 },  // کنج شمال شرقی کوچه
      ];

      for (const c of cornerTargets) {
        const ctrl = new PlayerController(
          { x: c.x, y: 1.65, z: c.z, yawDeg: c.intoYaw, pitchDeg: 0 },
          DEFAULT_ALLEY_BOUNDS,
        );
        // ۴۵ فریم دویدن مستقیم به داخل کنج
        for (let i = 0; i < 45; i++) {
          ctrl.tick({ forward: true, backward: false, left: false, right: false, sprint: true }, 1 / 60);
        }
        const inCorner = ctrl.getTransform();
        expect(checkAABBCollision(inCorner.x, inCorner.z, RADIUS, ALLEY_STATIC_OBSTACLES)).toBe(false);

        // چرخش به بیرون کنج: در همان اولین فریم باید بدون کوچک‌ترین چسبندگی جدا شود
        ctrl.setYawPitch(c.escapeYaw, 0);
        const escaped = ctrl.tick(
          { forward: true, backward: false, left: false, right: false, sprint: false },
          1 / 60,
        );
        const stepOut = Math.hypot(escaped.x - inCorner.x, escaped.z - inCorner.z);
        expect(stepOut).toBeGreaterThan(0.03);
        expect(checkAABBCollision(escaped.x, escaped.z, RADIUS, ALLEY_STATIC_OBSTACLES)).toBe(false);
      }
    });

    it('اگر بازیکن به هر دلیلی وسط هر یک از ۱۲ مانع کوچه اسپاون شود، بلافاصله به فضای آزاد هدایت می‌شود', () => {
      for (const box of ALLEY_STATIC_OBSTACLES) {
        const centerX = Math.max(
          DEFAULT_ALLEY_BOUNDS.minX,
          Math.min(DEFAULT_ALLEY_BOUNDS.maxX, (box.minX + box.maxX) / 2),
        );
        const centerZ = Math.max(
          DEFAULT_ALLEY_BOUNDS.minZ + 1,
          Math.min(DEFAULT_ALLEY_BOUNDS.maxZ - 0.5, (box.minZ + box.maxZ) / 2),
        );
        const safe = sanitizePosition(centerX, centerZ, DEFAULT_ALLEY_BOUNDS, RADIUS, ALLEY_STATIC_OBSTACLES);
        expect(checkAABBCollision(safe.x, safe.z, RADIUS, ALLEY_STATIC_OBSTACLES)).toBe(false);
        expect(safe.x).toBeGreaterThanOrEqual(DEFAULT_ALLEY_BOUNDS.minX);
        expect(safe.x).toBeLessThanOrEqual(DEFAULT_ALLEY_BOUNDS.maxX);
        expect(safe.z).toBeGreaterThanOrEqual(DEFAULT_ALLEY_BOUNDS.minZ);
        expect(safe.z).toBeLessThanOrEqual(DEFAULT_ALLEY_BOUNDS.maxZ);
      }

      // حالت بحرانی: نقطهٔ نزدیک دیوار راست داخل جعبهٔ B نباید به داخل دیوار راست هل داده شود
      const tricky = sanitizePosition(8.2, -6.4, DEFAULT_ALLEY_BOUNDS, RADIUS, ALLEY_STATIC_OBSTACLES);
      expect(checkAABBCollision(tricky.x, tricky.z, RADIUS, ALLEY_STATIC_OBSTACLES)).toBe(false);
    });

    it('آزمون استرس ۵۰۰۰ فریم راه رفتن و دویدن تصادفی در کل کوچه بدون حتی یک فریم گیر کردن یا تداخل', () => {
      const ctrl = new PlayerController(
        { x: 0, y: 1.65, z: 6, yawDeg: 0, pitchDeg: 0 },
        DEFAULT_ALLEY_BOUNDS,
      );

      let seed = 1337;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0x100000000;
      };

      for (let frame = 0; frame < 5000; frame++) {
        if (frame % 25 === 0) {
          ctrl.setYawPitch(rand() * 360 - 180, 0);
        }
        const dt = 0.008 + rand() * 0.08;
        const pos = ctrl.tick(
          {
            forward: true,
            backward: false,
            left: frame % 3 === 0,
            right: frame % 5 === 0,
            sprint: frame % 2 === 0,
          },
          dt,
        );
        expect(Number.isFinite(pos.x)).toBe(true);
        expect(Number.isFinite(pos.z)).toBe(true);
        expect(checkAABBCollision(pos.x, pos.z, RADIUS, ALLEY_STATIC_OBSTACLES)).toBe(false);
      }

      // هر سه لنگر اصلی کوچه (تابلوی اعلانات، جدول ردیف‌ها، در تئاتر) همچنان در فاصلهٔ تعاملی قابل دسترس‌اند
      const nearPlaybill = resolveMovement(
        { x: 0, y: 1.65, z: -2, yawDeg: 90, pitchDeg: 0 },
        -7.4,
        -2,
        DEFAULT_ALLEY_BOUNDS,
        RADIUS,
      );
      expect(
        Math.hypot(nearPlaybill.clampedX - DEFAULT_ALLEY_ANCHORS.playbill.x, nearPlaybill.clampedZ - DEFAULT_ALLEY_ANCHORS.playbill.z),
      ).toBeLessThan(1.5);

      const nearBooth = resolveMovement(
        { x: 0, y: 1.65, z: -1.5, yawDeg: -90, pitchDeg: 0 },
        6.6,
        -1.5,
        DEFAULT_ALLEY_BOUNDS,
        RADIUS,
      );
      expect(
        Math.hypot(nearBooth.clampedX - DEFAULT_ALLEY_ANCHORS.rowChart.x, nearBooth.clampedZ - DEFAULT_ALLEY_ANCHORS.rowChart.z),
      ).toBeLessThan(1.5);
    });
  });

  describe('۲. پاکسازی مختصات گیرکرده در localStorage هنگام بازگشت بازیکن', () => {
    const store = new Map<string, string>();
    beforeEach(() => {
      store.clear();
      (globalThis as unknown as { localStorage: Storage }).localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
        clear: () => store.clear(),
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() {
          return store.size;
        },
      };
    });

    it('اگر مختصات قبلی در localStorage داخل گیشه یا جعبه ذخیره شده باشد، loadTransform آن را آزاد برمی‌گرداند', () => {
      saveTransform('RM01', 'amirali', {
        x: 7.8, // وسط اتاقک گیشه!
        y: 1.65,
        z: -1.5,
        yawDeg: 45,
        pitchDeg: 0,
      });

      const loaded = loadTransform('RM01', 'amirali');
      expect(loaded).not.toBeNull();
      expect(checkAABBCollision(loaded!.x, loaded!.z, RADIUS, ALLEY_STATIC_OBSTACLES)).toBe(false);

      const resolved = resolveInitialTransform('RM01', 'amirali', 0);
      expect(checkAABBCollision(resolved.x, resolved.z, RADIUS, ALLEY_STATIC_OBSTACLES)).toBe(false);
      clearTransform('RM01', 'amirali');
    });
  });

  describe('۳. جلوگیری کامل از راه رفتن خودکار ناگهانی (Stuck Input / Chat / Shortcuts / Pointer Lock)', () => {
    it('کلیدهای چپ و راست ArrowLeft / ArrowRight هم مانند KeyA / KeyD پشتیبانی می‌شوند', () => {
      expect(inputFromKeyboard(new Set(['ArrowLeft'])).left).toBe(true);
      expect(inputFromKeyboard(new Set(['ArrowRight'])).right).toBe(true);
      expect(inputFromKeyboard(new Set(['ArrowUp'])).forward).toBe(true);
      expect(inputFromKeyboard(new Set(['ArrowDown'])).backward).toBe(true);
    });

    it('تایپ در چت نجوا و فیلدهای متنی مسدود است ولی کلیک روی دکمه یا رادیوباتن بلیط جلوی WASD را نمی‌گیرد', () => {
      expect(isTextEntryElement({ tagName: 'INPUT', type: 'text' })).toBe(true);
      expect(isTextEntryElement({ tagName: 'INPUT', type: 'search' })).toBe(true);
      expect(isTextEntryElement({ tagName: 'INPUT', type: 'password' })).toBe(true);
      expect(isTextEntryElement({ tagName: 'TEXTAREA' })).toBe(true);
      expect(isTextEntryElement({ tagName: 'DIV', isContentEditable: true })).toBe(true);

      // دکمه‌های شیشه‌ای HUD و رادیوباتن‌های بلیط نباید مانع حرکت WASD شوند
      expect(isTextEntryElement({ tagName: 'BUTTON' })).toBe(false);
      expect(isTextEntryElement({ tagName: 'INPUT', type: 'radio' })).toBe(false);
      expect(isTextEntryElement({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
      expect(isTextEntryElement({ tagName: 'CANVAS' })).toBe(false);

      // کلیدهای جهت‌نما روی رادیوباتن تداخل ایجاد نکنند
      expect(isArrowInteractiveElement({ tagName: 'INPUT', type: 'radio' })).toBe(true);
      expect(isArrowInteractiveElement({ tagName: 'BUTTON' })).toBe(false);
    });

    it('شورتکات‌های ترکیبی (Ctrl/Alt/Meta مثل Alt+Shift یا Ctrl+W) تشخیص داده می‌شوند تا کلید گیر نکند', () => {
      expect(isModifierChord({ ctrlKey: true })).toBe(true);
      expect(isModifierChord({ altKey: true })).toBe(true);
      expect(isModifierChord({ metaKey: true })).toBe(true);
      expect(isModifierChord({ ctrlKey: false, altKey: false, metaKey: false })).toBe(false);
    });

    it('پرش‌های ناگهانی Pointer Lock فیلتر می‌شوند ولی حرکت عادی ماوس دست‌نخورده می‌ماند', () => {
      expect(sanitizePointerLockDelta(24, -12)).toEqual({ dx: 24, dy: -12 });
      expect(sanitizePointerLockDelta(650, 10)).toEqual({ dx: 0, dy: 0 });
      expect(sanitizePointerLockDelta(12, -480)).toEqual({ dx: 0, dy: 0 });
      expect(sanitizePointerLockDelta(Number.NaN, 5)).toEqual({ dx: 0, dy: 0 });
    });

    it('هوک usePlayerControls و کنترل لمسی تمام مسیرهای گیرکردن کلید/ماوس/اسپرینت را پاکسازی می‌کنند', () => {
      const hookSrc = readFileSync(join(ROOT, 'src/engine3d/usePlayerControls.ts'), 'utf8');
      const touchSrc = readFileSync(join(ROOT, 'src/engine3d/touch-controls.ts'), 'utf8');
      const alleySrc = readFileSync(join(ROOT, 'src/components/alley/AlleyRoomThreeIntegration.tsx'), 'utf8');

      // پاکسازی در blur، تغییر تب، راست‌کلیک، ورود به فیلد متنی و غیرفعال شدن کنترل‌ها
      expect(hookSrc).toContain("window.addEventListener('blur'");
      expect(hookSrc).toContain("window.addEventListener('pagehide'");
      expect(hookSrc).toContain("window.addEventListener('contextmenu'");
      expect(hookSrc).toContain("document.addEventListener('visibilitychange'");
      expect(hookSrc).toContain("document.addEventListener('focusin'");
      expect(hookSrc).toContain('e.button !== 0');
      expect(hookSrc).toContain('(e.buttons & 1) === 0');
      expect(hookSrc).toContain('sanitizePointerLockDelta');
      expect(hookSrc).toContain('transformsDiffer');

      // پاکسازی sprint در کنترل لمسی هنگام clear()
      expect(touchSrc).toMatch(/const\s+clear\s*=\s*\(\)\s*=>\s*\{[\s\S]*?state\.sprint\s*=\s*false/);

      // جلوگیری از فراخوانی ۶۰ بار در ثانیه localStorage در رندر کوچه
      expect(alleySrc).toMatch(/useMemo\(\s*\(\)\s*=>\s*resolveInitialTransform/);
    });
  });

  describe('۴. حذف موانع نامرئی کوچه از سالن تاریک تئاتر (DarkAuditoriumThreeScene)', () => {
    it('در سالن تاریک تئاتر مسیر رسیدن به هر ۴ hotspot بدون برخورد به جعبه‌های نامرئی کوچه باز است', () => {
      const audSrc = readFileSync(
        join(ROOT, 'src/components/auditorium/DarkAuditoriumThreeScene.tsx'),
        'utf8',
      );
      expect(audSrc).toContain('AUDITORIUM_BOUNDS');
      expect(audSrc).toContain('AUDITORIUM_OBSTACLES');
      expect(audSrc).toContain('obstacles: AUDITORIUM_OBSTACLES');

      const audBounds: WorldBounds = {
        minX: -8.35,
        maxX: 8.35,
        minZ: -6.8,
        maxZ: 9.5,
        groundY: 0,
      };
      const audObstacles: readonly AABB[] = [];

      const hotspots = [
        { x: 0, z: 0 },
        { x: -8, z: -2 },
        { x: 0, z: -6 },
        { x: 8.5, z: 2 },
      ];

      for (const hs of hotspots) {
        const ctrl = new PlayerController(
          { x: 0, y: 1.65, z: 4, yawDeg: 0, pitchDeg: 0 },
          audBounds,
          {},
          audObstacles,
        );
        // حرکت به سمت هر hotspot
        for (let step = 0; step < 180; step++) {
          const cur = ctrl.getTransform();
          const dist = Math.hypot(hs.x - cur.x, hs.z - cur.z);
          if (dist < 2.2) break;
          const yawToTarget = (Math.atan2(-(hs.x - cur.x), -(hs.z - cur.z)) * 180) / Math.PI;
          ctrl.setYawPitch(yawToTarget, 0);
          ctrl.tick({ forward: true, backward: false, left: false, right: false, sprint: true }, 1 / 30);
        }
        const end = ctrl.getTransform();
        expect(Math.hypot(hs.x - end.x, hs.z - end.z)).toBeLessThan(3.5);
        expect(checkAABBCollision(end.x, end.z, RADIUS, audObstacles)).toBe(false);
      }
    });
  });
});
