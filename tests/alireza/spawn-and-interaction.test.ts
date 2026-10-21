import { describe, it, expect } from 'vitest';
import { getSpawnForSeat, resolveInitialTransform } from '@/engine3d/spawn';
import { distance3D, isInInteractionRange } from '@/engine3d/interaction';
import { doorTransitionProgress } from '@/engine3d/transition';

describe('موج ۵ — اسپاون و گذار', () => {
  it('اسپاون هر صندلی کمی متفاوت است', () => {
    const s0 = getSpawnForSeat(0);
    const s1 = getSpawnForSeat(1);
    const s2 = getSpawnForSeat(2);
    expect(s0.position.x).not.toBe(s1.position.x);
    expect(s1.position.x).not.toBe(s2.position.x);
  });

  it('resolveInitialTransform بدون ذخیره، اسپاون پیش‌فرض می‌دهد', () => {
    const t = resolveInitialTransform('TEST', 'player-1', 0);
    expect(t.x).toBeDefined();
    expect(t.y).toBeCloseTo(1.65);
  });

  it('distance3D درست محاسبه می‌شود', () => {
    const d = distance3D({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 });
    expect(d).toBe(5);
  });

  it('isInInteractionRange فاصله را چک می‌کند', () => {
    const player = { x: 0, y: 0, z: 0 };
    const near = { x: 1, y: 0, z: 1 };
    const far = { x: 10, y: 0, z: 10 };
    expect(isInInteractionRange(player, near, 3)).toBe(true);
    expect(isInInteractionRange(player, far, 3)).toBe(false);
  });

  it('doorTransitionProgress بین ۰ و ۱', () => {
    expect(doorTransitionProgress(0)).toBe(0);
    expect(doorTransitionProgress(1100, 2200)).toBeCloseTo(0.5);
    expect(doorTransitionProgress(3000, 2200)).toBe(1);
  });
});
