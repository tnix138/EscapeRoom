import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  COBBLE,
  COBBLE_GROUND_SEGMENTS,
  buildCobbleField,
  cobbleTable,
  cobblestoneSurfaceMaps,
  sampleCobbleHeight,
} from '@/engine3d/alley-cobblestone';
import { createCobblestoneMaps } from '@/engine3d/alley-materials';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import { alleyGroundCrownAt } from '@/engine3d/alley-ground-profile';

/**
 * خواستهٔ بازبینی امیر — سنگ‌فرش کف:
 *   ۱. کیفیت: بافتِ بزرگ‌تر، رنگ و تراشِ متفاوتِ هر سنگ، بندِ خاکی و باریک‌تر
 *   ۲. چینی باید **قرینه** باشد: چیدمانِ بی‌قوارهٔ دورِ محورِ کوچه خطای اصلی
 *      بود ⇒ تایل حولِ u=۰ آینه می‌شود و خطِّ تقارن دقیقاً روی x=۰ می‌افتد
 *   ۳. سنگ‌ها باید از هم **متفاوت** باشند: اندازه، رنگ، تراز و تراشِ هر سنگ
 *   ۲. سطحِ سنگ‌ها و فاصلهٔ چینششان باید **تفاوت ارتفاعیِ مشخص** داشته باشد و
 *      سنگ‌فرش کمی برجسته باشد ⇒ ترازِ هر سنگ هم در بافت و هم روی **رأس‌های
 *      واقعیِ کف** می‌نشیند، پس سنگ‌ها در نورِ مایل سایه و پله دارند.
 */

function channelStats(texture: THREE.DataTexture, channel = 0) {
  const data = texture.image.data as Uint8Array;
  const n = data.length / 4;
  let min = 255;
  let max = 0;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i + channel];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    sumSq += v * v;
  }
  const mean = sum / n;
  return { min, max, mean, std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)), n };
}

function groundMesh(alley: ReturnType<typeof createAlleyGeometry>) {
  alley.group.updateMatrixWorld(true);
  return alley.group.getObjectByName('Ground') as THREE.Mesh<THREE.PlaneGeometry>;
}

describe('سنگ‌فرش کف: چیدمانِ نامنظم و اختلاف ارتفاعیِ واقعی', () => {
  it('هیچ دو همسایه‌ای هم‌تراز نیستند: ترازِ سنگ‌ها پراکندگیِ مشخص دارد', () => {
    const table = cobbleTable();
    const levels = table.cells.map((cell) => cell.level);
    const spread = Math.max(...levels) - Math.min(...levels);
    const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
    const std = Math.sqrt(levels.reduce((a, b) => a + (b - mean) ** 2, 0) / levels.length);

    // یک کفِ واقعی بینِ «نشسته‌ترین» و «بلندترین» سنگش ~۷۰٪ بازه دارد
    expect(spread).toBeGreaterThan(0.5);
    expect(std).toBeGreaterThan(0.12);
    // و اختلافِ همسایه‌به‌همسایه زیاد است، نه یک گرادیانِ نرم و مصنوعی
    let neighbourDelta = 0;
    let pairs = 0;
    for (let row = 0; row < COBBLE.rows; row++) {
      for (let col = 0; col < COBBLE.cols; col++) {
        const here = table.cells[row * COBBLE.cols + col].level;
        neighbourDelta += Math.abs(here - table.cells[row * COBBLE.cols + ((col + 1) % COBBLE.cols)].level);
        neighbourDelta += Math.abs(here - table.cells[((row + 1) % COBBLE.rows) * COBBLE.cols + col].level);
        pairs += 2;
      }
    }
    expect(neighbourDelta / pairs).toBeGreaterThan(0.12);
  });

  it('فاصلهٔ چینش (پهنای بند) از سنگی به سنگ دیگر فرق می‌کند', () => {
    const table = cobbleTable();
    const jx = table.cells.map((cell) => cell.jx);
    const jy = table.cells.map((cell) => cell.jy);
    // بند از سنگی به سنگ دیگر فرق می‌کند، ولی در بازهٔ واقع‌گرایانۀ ۱ تا ۳ سانت
    expect(Math.max(...jx) - Math.min(...jx)).toBeGreaterThan(0.018);
    expect(Math.max(...jy) - Math.min(...jy)).toBeGreaterThan(0.018);
    const meterPerCell = 13.2 / (COBBLE.repeatX * COBBLE.cols);
    const widestJoint = 2 * Math.max(...jx) * meterPerCell;
    expect(widestJoint).toBeLessThan(0.035);
    // و هیچ‌کدام یا خیلی باریکِ غیرواقعی نیست یا به‌اندازهٔ خودِ سنگ
    expect(Math.min(...jx)).toBeGreaterThan(0.014);
    expect(Math.max(...jx)).toBeLessThan(0.2);
    // خانه‌هایی که به دو نیم‌سنگ تقسیم شده‌اند هم باید باشند (سنگِ پرکننده)
    expect(table.cells.filter((cell) => cell.subX === 2).length).toBeGreaterThan(4);
  });

  it('بند واقعاً فرورفته است: تاجِ سنگ تا کفِ بند ~۰٫۶۷ واحد فرق دارد', () => {
    const field = buildCobbleField(256);
    let topSum = 0;
    let topN = 0;
    let jointSum = 0;
    let jointN = 0;
    for (let i = 0; i < field.heights.length; i++) {
      if (field.mortar[i] > 0.995) {
        jointSum += field.heights[i];
        jointN++;
      } else if (field.mortar[i] < 0.005) {
        topSum += field.heights[i];
        topN++;
      }
    }
    expect(jointN).toBeGreaterThan(field.heights.length * 0.03);
    expect(topN).toBeGreaterThan(field.heights.length * 0.1);
    expect(topSum / topN - jointSum / jointN).toBeGreaterThan(0.45);
    // و روی تاجِ هر سنگ سطح صافِ بی‌نقص نیست: نویزِ تراش هست
    let belowMin = Infinity;
    let aboveMax = -Infinity;
    for (let i = 0; i < field.heights.length; i++) {
      if (field.mortar[i] < 0.005) {
        belowMin = Math.min(belowMin, field.heights[i]);
        aboveMax = Math.max(aboveMax, field.heights[i]);
      }
    }
    expect(aboveMax - belowMin).toBeGreaterThan(0.2);
  });

  it('بافت بی‌درز تایل می‌شود: u=0 و u=1 دقیقاً به هم می‌رسند', () => {
    const table = cobbleTable();
    const field = buildCobbleField(64);
    for (let i = 0; i < 24; i++) {
      const v = i / 24;
      const a = sampleCobbleHeight(0, v, table).h;
      const b = sampleCobbleHeight(1, v, table).h;
      expect(a).toBeCloseTo(b, 12);
      expect(field.sampleHeight(0, v)).toBeCloseTo(field.sampleHeight(1, v), 12);
      const c = sampleCobbleHeight(v, 0, table).h;
      const d = sampleCobbleHeight(v, 1, table).h;
      expect(c).toBeCloseTo(d, 12);
    }
  });

  it('چهار نقشهٔ PBR پرطرح‌اند: رنگ، زبری، نورمل و AO همه تنوع دارند', () => {
    const field = buildCobbleField(256);
    const maps = cobblestoneSurfaceMaps(field, COBBLE.repeatX, COBBLE.repeatY);

    const r = channelStats(maps.colorMap, 0);
    const g = channelStats(maps.colorMap, 1);
    const b = channelStats(maps.colorMap, 2);
    // سنگِ خاکستری-گرم، نه سیاه و نه شسته؛ کنتراستِ بالا بین بند و تاج
    const meanLum = (r.mean + g.mean + b.mean) / 3;
    expect(meanLum).toBeGreaterThan(52);
    expect(meanLum).toBeLessThan(150);
    expect(r.std).toBeGreaterThan(14);
    expect(r.min).toBeLessThan(64);
    expect(r.max).toBeGreaterThan(104);
    // کانال قرمز از آبی روشن‌تر است ⇒ گرمای سنگِ کهنه، نه خاکستریِ دیجیتال
    expect(r.mean).toBeGreaterThan(b.mean);

    const rough = channelStats(maps.roughnessMap);
    expect(rough.min / 255).toBeGreaterThanOrEqual(0.8);
    expect(rough.mean / 255).toBeGreaterThan(0.85);
    expect((rough.max - rough.min) / 255).toBeGreaterThan(0.05);

    const ao = channelStats(maps.aoMap);
    expect(ao.min / 255).toBeLessThan(0.35);
    expect(ao.max / 255).toBeGreaterThan(0.9);
    expect((ao.max - ao.min) / 255).toBeGreaterThan(0.5);

    const nx = channelStats(maps.normalMap, 0);
    const ny = channelStats(maps.normalMap, 1);
    // نورمل باید پرشیب باشد (تاج، پیچِ لبه، بند) و نه صفحهٔ تختِ (۱۲،۱۲۸)
    expect(nx.std).toBeGreaterThan(18);
    expect(ny.std).toBeGreaterThan(18);
    expect(Math.abs(nx.mean - 127.5)).toBeLessThan(6);
    let tilted = 0;
    const data = maps.normalMap.image.data as Uint8Array;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - 128) > 5 || Math.abs(data[i + 1] - 128) > 5) tilted++;
    }
    expect(tilted / (data.length / 4)).toBeGreaterThan(0.45);

    maps.dispose();
    maps.dispose();
  });

  it('کیفیتِ اندازه: تکسچر ۱۰۲ است و هر سنگ ~۹۳ پیکسل و ~۳۰ سانتی‌مترِ واقعی', () => {
    expect(COBBLE.textureSize).toBeGreaterThanOrEqual(1024);
    const pxPerStone = COBBLE.textureSize / COBBLE.cols;
    expect(pxPerStone).toBeGreaterThanOrEqual(64);
    const worldWide = 13.2 / (COBBLE.repeatX * COBBLE.cols);
    const worldLong = 42 / (COBBLE.repeatY * COBBLE.rows);
    expect(worldWide).toBeGreaterThan(0.18);
    expect(worldWide).toBeLessThan(0.42);
    expect(worldLong).toBeGreaterThan(0.18);
    expect(worldLong).toBeLessThan(0.42);
  });

  it('بافت نوارِ عمودی (کُردُرو) ندارد و کنتراستش از قبل بیشتر است', () => {
    // خطِّ تراش باید داخلِ هر سنگ تمام شود؛ اگر نویزِ تراش سراسری باشد، ستون‌های
    // روشن/تاریکِ دوره‌ای کل کف را مثل پارچه می‌کنند. معیار: انحرافِ معیارِ
    // میانگینِ *ستون‌ها* باید نسبت به انحرافِ خودِ پیکسل‌ها کوچک بماند.
    const field = buildCobbleField(COBBLE.textureSize);
    const maps = cobblestoneSurfaceMaps(field, COBBLE.repeatX, COBBLE.repeatY);
    const data = maps.colorMap.image.data as Uint8Array;
    const n = field.size;
    const lum = (i: number) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const colMean = new Float64Array(n);
    const samples = new Float64Array(n * (n / 4));
    let sum = 0;
    let k = 0;
    for (let px = 0; px < n; px++) {
      let c = 0;
      for (let py = 0; py < n; py += 4) {
        const l = lum((py * n + px) * 4);
        c += l;
        samples[k++] = l;
      }
      colMean[px] = c / (n / 4);
      sum += c;
    }
    const mean = sum / samples.length;
    let colSq = 0;
    for (let px = 0; px < n; px++) colSq += (colMean[px] - mean) ** 2;
    let pxSq = 0;
    let min = 255;
    let max = 0;
    for (let i = 0; i < samples.length; i++) {
      pxSq += (samples[i] - mean) ** 2;
      if (samples[i] < min) min = samples[i];
      if (samples[i] > max) max = samples[i];
    }
    const colStd = Math.sqrt(colSq / n);
    const pxStd = Math.sqrt(pxSq / samples.length);
    expect(pxStd).toBeGreaterThan(24); // کنتراستِ رنگ (نسخۀ ۵۱۲: ~۲۱)
    expect(mean).toBeGreaterThan(70); // کفِ خاکستریِ تار نیست؛ از دور هم روشنایی دارد
    expect(colStd / pxStd).toBeLessThan(0.36);
    expect(max - min).toBeGreaterThan(96);
    maps.dispose();
  });

  it('چینی حولِ محورِ کوچه قرینه است: نیمهٔ راستِ تایل آینهٔ نیمهٔ چپ', () => {
    const field = buildCobbleField(COBBLE.textureSize);
    const maps = cobblestoneSurfaceMaps(field, COBBLE.repeatX, COBBLE.repeatY);
    const n = field.size;

    // ۱) میدانِ ارتفاع: خودِ پیکسل‌ها آینه‌اند (خطای صفر، نه تقریبی)
    let heightDiff = 0;
    for (let py = 0; py < n; py += 3) {
      for (let px = 0; px < n; px += 7) {
        const mirror = (n - px) % n;
        heightDiff = Math.max(
          heightDiff,
          Math.abs(field.heights[py * n + px] - field.heights[py * n + mirror]),
        );
      }
    }
    expect(heightDiff).toBe(0);

    // ۲) چهار نقشه: رنگ/زبری/AO قرینه و نورمل در x پَرشکسته (قرینۀ نرمال)
    const flat = (tex: THREE.DataTexture) => tex.image.data as Uint8Array;
    const color = flat(maps.colorMap);
    const normal = flat(maps.normalMap);
    const rough = flat(maps.roughnessMap);
    const ao = flat(maps.aoMap);
    let colorDiff = 0;
    let roughDiff = 0;
    let aoDiff = 0;
    let normalDiff = 0;
    for (let py = 0; py < n; py += 5) {
      for (let px = 1; px < n / 2; px += 3) {
        const a = (py * n + px) * 4;
        const b = (py * n + (n - px)) * 4;
        colorDiff = Math.max(
          colorDiff,
          Math.abs(color[a] - color[b]),
          Math.abs(color[a + 1] - color[b + 1]),
          Math.abs(color[a + 2] - color[b + 2]),
        );
        roughDiff = Math.max(roughDiff, Math.abs(rough[a] - rough[b]));
        aoDiff = Math.max(aoDiff, Math.abs(ao[a] - ao[b]));
        // برای نورمل قرینگی یعنی nx ← -nx ⇒ بایتِ x باید ۲۵۵ منهای طرفِ دیگر باشد
        normalDiff = Math.max(
          normalDiff,
          Math.abs(255 - normal[a] - normal[b]),
          Math.abs(normal[a + 1] - normal[b + 1]),
        );
      }
    }
    expect(colorDiff).toBe(0);
    expect(roughDiff).toBe(0);
    expect(aoDiff).toBe(0);
    expect(normalDiff).toBeLessThanOrEqual(1);

    // ۳) ترازِ هندسه هم قرینه است (نمونه‌گیرِ رأس‌ها همان آینه را می‌خواند)
    let levelDiff = 0;
    for (let k = 0; k < 300; k++) {
      const u = k / 300;
      const v = (k * 0.371) % 1;
      levelDiff = Math.max(
        levelDiff,
        Math.abs(field.sampleLevel(u * COBBLE.repeatX, v * COBBLE.repeatY) -
          field.sampleLevel((1 - u) * COBBLE.repeatX, v * COBBLE.repeatY)),
      );
    }
    expect(levelDiff).toBeLessThan(1e-9);

    // ۴) خطِّ تقارن باید روی محورِ کوچه بیفتد: تکرارِ افقیِ تایل زوج باشد
    expect(COBBLE.repeatX % 2).toBe(0);

    maps.dispose();
  });

  it('ترازِ سنگ‌ها روی خودِ هندسهٔ کف می‌نشیند: کف دیگر تخت نیست', () => {
    const alley = createAlleyGeometry();
    const ground = groundMesh(alley);
    const position = ground.geometry.getAttribute('position');
    const normal = ground.geometry.getAttribute('normal');
    expect(ground.geometry.type).toBe('PlaneGeometry');
    expect(ground.geometry.parameters.widthSegments).toBeGreaterThanOrEqual(COBBLE_GROUND_SEGMENTS.x);
    expect(ground.geometry.parameters.heightSegments).toBeGreaterThanOrEqual(COBBLE_GROUND_SEGMENTS.y);

    const world = new THREE.Vector3();
    const n = new THREE.Vector3();
    let min = Infinity;
    let max = -Infinity;
    let sloped = 0;
    let finite = true;
    for (let i = 0; i < position.count; i++) {
      world.fromBufferAttribute(position, i).applyMatrix4(ground.matrixWorld);
      finite = finite && Number.isFinite(world.x) && Number.isFinite(world.y) && Number.isFinite(world.z);
      const offset = world.y - alleyGroundCrownAt(world.x);
      min = Math.min(min, offset);
      max = Math.max(max, offset);
      n.fromBufferAttribute(normal, i).applyQuaternion(ground.quaternion);
      if (Math.abs(n.y) < 0.9995) sloped++;
    }

    // ~۳٫۴ سانتی‌متر اختلافِ واقعیِ تراز بینِ بلندترین و نشسته‌ترین سنگ
    expect(finite).toBe(true);
    expect(max - min).toBeGreaterThan(0.025);
    expect(min).toBeLessThan(-0.02);
    // و جهتِ جابه‌جایی فقط روپایین است: هیچ سنگی از سطحِ نامیِ کف بالا نمی‌زند،
    // پس چاله‌های آب، هالهٔ نورِ چراغ‌ها و درِ منهول روی کف می‌مانند
    expect(max).toBeLessThanOrEqual(1e-6);
    // نیمی از رأس‌ها شیبِ محسوس دارند ⇒ نورِ مایل روی کف موج می‌اندازد
    expect(sloped / position.count).toBeGreaterThan(0.25);

    // و قرینگیِ چینی روی *هندسهٔ واقعی* هم می‌نشیند: هر رأسِ x با رأسِ -x
    // هم‌ارتفاع است، پس دو طرفِ کوچه آینه‌اند (نه دو چینیِ بی‌ربط)
    const byColumn = new Map<number, Map<number, number>>();
    for (let i = 0; i < position.count; i++) {
      world.fromBufferAttribute(position, i).applyMatrix4(ground.matrixWorld);
      const col = Math.round(world.x * 10_000);
      const row = Math.round(world.z * 10_000);
      const bucket = byColumn.get(col) ?? new Map<number, number>();
      bucket.set(row, world.y - alleyGroundCrownAt(world.x));
      byColumn.set(col, bucket);
    }
    let mirrorWorst = 0;
    for (const [col, bucket] of byColumn) {
      const other = byColumn.get(-col);
      if (!other) continue;
      for (const [row, y] of bucket) {
        const y2 = other.get(row);
        if (y2 !== undefined) mirrorWorst = Math.max(mirrorWorst, Math.abs(y - y2));
      }
    }
    expect(mirrorWorst).toBeLessThan(1e-5);

    alley.dispose();
  });

  it('متریالِ کف همان خشکیِ مات را نگه می‌دارد و نورملِ قوی‌تری دارد', () => {
    const alley = createAlleyGeometry();
    const material = groundMesh(alley).material as THREE.MeshStandardMaterial;
    expect(material.roughness).toBeGreaterThanOrEqual(0.95);
    expect(material.metalness).toBeLessThanOrEqual(0.03);
    expect(material.envMapIntensity).toBeLessThanOrEqual(0.2);
    expect(material.normalScale.x).toBeGreaterThan(1.5);
    expect(material.aoMapIntensity).toBeGreaterThan(0.95);
    expect(material.map).toBeInstanceOf(THREE.DataTexture);
    expect((material.map as THREE.DataTexture).image.width).toBe(COBBLE.textureSize);
    alley.dispose();
  });

  it('حالت‌های مرزی: اندازهٔ کوچک و مختصاتِ خراب عددِ NaN به هندسه نمی‌دهد', () => {
    const tiny = buildCobbleField(16);
    expect(tiny.size).toBe(16);
    for (let i = 0; i < tiny.heights.length; i++) {
      expect(Number.isFinite(tiny.heights[i])).toBe(true);
      expect(tiny.heights[i]).toBeGreaterThanOrEqual(0);
      expect(tiny.heights[i]).toBeLessThanOrEqual(1);
    }
    // ورودیِ نامعتبر ⇒ ترازِ پیش‌فرضِ کف (۱)، نه NaN که کل شبکهٔ کف را خراب کند
    expect(tiny.sampleLevel(Number.NaN, 0.4)).toBe(1);
    expect(tiny.sampleLevel(0.5, Number.POSITIVE_INFINITY)).toBe(1);
    expect(tiny.sampleHeight(Number.NaN, Number.NaN)).toBe(1);
    expect(Number.isFinite(tiny.sampleHeight(-3.25, 7.9))).toBe(true);
    // میدان با هر اندازه‌ای باید نقشهٔ هم‌اندازه بدهد
    const maps = cobblestoneSurfaceMaps(tiny, 2, 3);
    expect((maps.colorMap.image as { width: number }).width).toBe(16);
    maps.dispose();
  });

  it('قطعی است و درِ ورودیِ قدیمی (createCobblestoneMaps) هم کار می‌کند', () => {
    const first = buildCobbleField(32);
    const second = buildCobbleField(32);
    expect(Array.from(first.heights)).toEqual(Array.from(second.heights));

    const legacy = createCobblestoneMaps(5, 13, 128);
    expect((legacy.colorMap.image as { width: number }).width).toBe(128);
    expect(legacy.colorMap.repeat.x).toBe(5);
    expect(legacy.colorMap.repeat.y).toBe(13);
    expect(legacy.colorMap.wrapS).toBe(THREE.RepeatWrapping);
    expect(legacy.normalMap.colorSpace).toBe(THREE.NoColorSpace);
    const rough = channelStats(legacy.roughnessMap);
    expect(rough.min / 255).toBeGreaterThanOrEqual(0.8);
    expect(rough.mean / 255).toBeGreaterThan(0.85);
    legacy.dispose();
  });
});
