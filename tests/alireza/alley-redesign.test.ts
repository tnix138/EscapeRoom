import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import { computeStreetlampFlicker } from '@/engine3d/alley-props';
import { formatPersianDigits } from '@/engine3d/alley-signs';
import { ALLEY_STATIC_OBSTACLES, checkAABBCollision } from '@/engine3d/collision';
import { getSpawnForSeat } from '@/engine3d/spawn';
import { DEFAULT_ALLEY_ANCHORS, DEFAULT_MOVEMENT_CONFIG } from '@/engine3d/types';

describe('بازطراحی کامل کوچهٔ سه‌بعدی تماشاخانهٔ اُرفه‌ئو', () => {
  it('گنبد آسمان شبانه با fog غیرفعال، ابرهای متحرک و نقشهٔ بازتاب خیس ساخته می‌شود', () => {
    const alley = createAlleyGeometry();
    const skyDome = alley.group.getObjectByName('AlleySkyDome') as THREE.Mesh<
      THREE.SphereGeometry,
      THREE.ShaderMaterial
    >;

    expect(skyDome).toBeDefined();
    expect(skyDome.material.side).toBe(THREE.BackSide);
    expect(skyDome.material.fog).toBe(false);
    expect(skyDome.material.depthWrite).toBe(false);
    expect(alley.environmentMap.mapping).toBe(THREE.EquirectangularReflectionMapping);

    alley.update(0.016, 12.5);
    expect(skyDome.material.uniforms.uTime.value).toBeCloseTo(12.5);

    // حالت خطا: ورودی غیرمتناهی نباید شیدر آسمان را خراب کند
    alley.update(0.016, Number.NaN);
    expect(Number.isFinite(skyDome.material.uniforms.uTime.value)).toBe(true);

    alley.dispose();
  });

  it('کف‌سازی کامل شامل سنگ‌فرش PBR، پیاده‌رو، جدول، چاله‌های آب بازتابنده و فاضلاب است', () => {
    const alley = createAlleyGeometry();
    const ground = alley.group.getObjectByName('Ground') as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshStandardMaterial
    >;

    expect(ground).toBeDefined();
    expect(ground.material.map).not.toBeNull();
    expect(ground.material.normalMap).not.toBeNull();
    expect(ground.material.roughnessMap).not.toBeNull();
    expect(ground.material.aoMap).not.toBeNull();
    expect(ground.geometry.getAttribute('uv1')).toBeDefined();

    expect(alley.group.getObjectByName('SidewalkLeft')).toBeDefined();
    expect(alley.group.getObjectByName('SidewalkRight')).toBeDefined();
    expect(alley.group.getObjectByName('CurbLeft')).toBeDefined();
    expect(alley.group.getObjectByName('CurbRight')).toBeDefined();
    expect(alley.group.getObjectByName('RainPuddle_0')).toBeDefined();
    expect(alley.group.getObjectByName('ManholeCover')).toBeDefined();

    alley.dispose();
  });

  it('ساختمان‌های چندطبقه، جعبه‌های چوبی، تیرهای چراغ برق سوسوزن و کابل‌های هوایی وجود دارند', () => {
    const alley = createAlleyGeometry();

    expect(alley.group.getObjectByName('BuildingLeft_0')).toBeDefined();
    expect(alley.group.getObjectByName('BuildingRight_0')).toBeDefined();
    // خواستهٔ بازبینی: «نردهٔ پشت سر» برداشته شد؛ انتهای کوچه حالا به فرعیِ
    // L‌شکل و بن‌بستِ درِ چوبی ختم می‌شود، نه به دروازهٔ آهنی.
    expect(alley.group.getObjectByName('AlleyBackGate')).toBeUndefined();
    expect(alley.group.getObjectByName('BranchDeadEnd')).toBeDefined();
    expect(alley.group.getObjectByName('BranchDeadEndDoor')).toBeDefined();
    expect(alley.group.getObjectByName('TheaterMarqueeSign')).toBeDefined();

    // تیرهای چراغ برق (جفت‌های رو‌به‌روی هم؛ جفتِ امتدادِ جنوبی و فرعی هم اضافه
    // شده‌اند) + کابل‌های هوایی
    expect(alley.group.getObjectByName('UtilityPole_SouthLeft')).toBeDefined();
    expect(alley.group.getObjectByName('UtilityPole_SouthRight')).toBeDefined();
    expect(alley.group.getObjectByName('UtilityPole_NorthLeft')).toBeDefined();
    expect(alley.group.getObjectByName('UtilityPole_NorthRight')).toBeDefined();
    expect(alley.group.getObjectByName('UtilityPole_FarSouthLeft')).toBeDefined();
    // تیرِ شمالیِ فرعی که جلوی درِ ورودی بود حذف شده است
    expect(alley.group.getObjectByName('UtilityPole_BranchNorth')).toBeUndefined();
    expect(alley.group.getObjectByName('UtilityPole_BranchSouth')).toBeDefined();
    expect(alley.group.getObjectByName('OverheadPowerCable')).toBeDefined();

    // ۴ دسته جعبه‌های چوبی و بشکه
    expect(alley.group.getObjectByName('CrateCluster_LeftSouth')).toBeDefined();
    expect(alley.group.getObjectByName('CrateCluster_RightMid')).toBeDefined();
    expect(alley.group.getObjectByName('CrateCluster_LeftNorth')).toBeDefined();
    expect(alley.group.getObjectByName('CrateCluster_RightSouth')).toBeDefined();

    // بررسی سوسوزدن هم‌گام نور چراغ برق، حباب و پرتو مه
    const flickerLight = alley.group.getObjectByName('PoleSpotLight_NorthRight') as THREE.SpotLight;
    const flickerBulb = alley.group.getObjectByName('LampBulb_NorthRight') as THREE.Mesh<
      THREE.SphereGeometry,
      THREE.MeshStandardMaterial
    >;
    expect(flickerLight).toBeDefined();
    expect(flickerBulb).toBeDefined();

    const samples = new Set<number>();
    for (let i = 0; i < 60; i++) {
      alley.update(0.05, i * 0.13);
      samples.add(Number(flickerLight.intensity.toFixed(2)));
    }
    expect(samples.size).toBeGreaterThan(4);

    alley.dispose();
  });

  it('تابلوهای اعلانات و گیشه رو به داخل کوچه هستند و بدون نیاز به کلید E خوانده می‌شوند', () => {
    const alley = createAlleyGeometry();

    const posterMesh = alley.group.getObjectByName('PlaybillPosterTextMesh') as THREE.Mesh;
    const chartMesh = alley.group.getObjectByName('RowChartBoard') as THREE.Mesh;
    expect(posterMesh).toBeDefined();
    expect(chartMesh).toBeDefined();

    // پوستر دیوار چپ رو به +X و جدول گیشهٔ راست رو به -X (داخل کوچه) است
    expect(posterMesh.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(chartMesh.rotation.y).toBeCloseTo(-Math.PI / 2);

    // به‌روزرسانی پویا با تعداد بازیکنان و بلیط‌های پانچ‌شده
    alley.updateClues(
      { playbill: [], rowChart: [], punchedCount: 2, requiredCount: 4 },
      [
        { playerName: 'توحید', ticketPunched: true },
        { playerName: 'سارا', ticketPunched: true },
        { playerName: 'مانی', ticketPunched: false },
        { playerName: 'کیان', ticketPunched: false },
      ],
    );
    const lampGroup = alley.group.getObjectByName('DoorPlayerStatusLamps') as THREE.Group;
    expect(lampGroup.children).toHaveLength(4);

    // اطمینان از حذف پیغام قدیمی «E برای نمایش پوستر / جدول ردیف‌ها» در صحنهٔ سه‌بعدی
    const integrationSrc = readFileSync(
      path.join(process.cwd(), 'src/components/alley/AlleyRoomThreeIntegration.tsx'),
      'utf8',
    );
    expect(integrationSrc).not.toContain('E برای نمایش پوستر');
    expect(integrationSrc).not.toContain('E برای جدول ردیف‌ها');
    expect(integrationSrc).toContain('alleyRef.current?.update(delta, elapsed)');

    // فراخوانی مجدد dispose امن و بی‌خطا است
    alley.dispose();
    expect(() => alley.dispose()).not.toThrow();
  });

  it('برخورد جعبه‌ها و تیرها فعال است ولی اسپاون بازیکنان و نقاط خواندن تابلوها کاملاً باز است', () => {
    expect(DEFAULT_MOVEMENT_CONFIG.maxPitchDeg).toBeGreaterThanOrEqual(60);
    expect(DEFAULT_MOVEMENT_CONFIG.minPitchDeg).toBeLessThanOrEqual(-50);

    // جعبه‌ها مانع عبور بازیکن می‌شوند
    expect(checkAABBCollision(-7.45, 3.4, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(true);
    expect(checkAABBCollision(7.45, -6.4, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(true);

    // اسپاون هر ۸ صندلی آزاد است
    for (let seat = 0; seat < 8; seat++) {
      const sp = getSpawnForSeat(seat).position;
      expect(checkAABBCollision(sp.x, sp.z, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);
    }

    // ایستادن روبه‌روی هر دو تابلو و در تئاتر آزاد و در محدودهٔ تشخیص لنگر است
    expect(checkAABBCollision(-5.8, DEFAULT_ALLEY_ANCHORS.playbill.z, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);
    expect(checkAABBCollision(5.8, DEFAULT_ALLEY_ANCHORS.rowChart.z, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);
    expect(checkAABBCollision(0, -12.0, 0.35, ALLEY_STATIC_OBSTACLES)).toBe(false);

    // حالت خطا برای ورودی نامعتبر توابع کمکی
    expect(computeStreetlampFlicker(Number.NaN, 1, 'broken')).toBe(1);
    expect(formatPersianDigits(Number.POSITIVE_INFINITY)).toBe('۰');
  });
});
