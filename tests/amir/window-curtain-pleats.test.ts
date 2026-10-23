import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CURTAIN,
  buildCurtainGeometry,
  createCurtainFabricMaps,
  curtainDepth,
  curtainFacing,
  curtainPleat,
  curtainShade,
} from '@/engine3d/alley-window-curtain';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';

/**
 * خواستۀ امیر — سه پنجرۀ بالای ورودیِ اصلیِ تماشاخانه:
 *   ۱. پردۀ سرخشان باید «پر از چین‌چینِ عمودیِ ریز» باشد، نه مستطیلِ صاف
 *   ۲. بالا و پایین پردۀ قرمز «به سمت سیاهی» برود: دو سر قرمزِ تیره، وسط قرمزِ معمولی
 *   ۳. تغییررنگ باید «حاله‌ای و محو» باشد، نه یک خطِ برنده
 * پیش‌تر این سه پنجره سه جعبۀ `BoxGeometry` با یک متریال یکدستِ 0x5c111c و
 * emissive ثابت بودند؛ یعنی یک قرمزِ صافِ بی‌بافت که هیچ‌وقت پرده نبود.
 */

function rowLuma(texture: THREE.DataTexture) {
  const data = texture.image.data as Uint8Array;
  const n = Math.sqrt(data.length / 4);
  const out = new Float64Array(n);
  for (let py = 0; py < n; py++) {
    let sum = 0;
    for (let px = 0; px < n; px++) {
      const o = (py * n + px) * 4;
      sum += (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
    }
    out[py] = sum / n;
  }
  return { values: out, n };
}

//** میانگینِ متحرک: موجک‌های ریزِ چین در پروفیلِ ارتفاعی نویز حساب می‌شوند */
function smooth(values: Float64Array, radius: number): Float64Array {
  const n = values.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = i + k;
      if (j < 0 || j >= n) continue;
      sum += values[j];
      count++;
    }
    out[i] = sum / count;
  }
  return out;
}

function colLuma(texture: THREE.DataTexture) {
  const data = texture.image.data as Uint8Array;
  const n = Math.sqrt(data.length / 4);
  const out = new Float64Array(n);
  for (let px = 0; px < n; px++) {
    let sum = 0;
    for (let py = 0; py < n; py++) {
      const o = (py * n + px) * 4;
      sum += (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
    }
    out[px] = sum / n;
  }
  return { values: out, n };
}

/** شمارشِ چرخه‌ها با گذر از یک آستانه (برای سیگنالِ صاف‌شدهٔ قله که اوجِ تیز ندارد) */
function countCycles(values: ArrayLike<number>, level = 0.5): number {
  const n = values.length;
  let crossings = 0;
  for (let i = 0; i < n; i++) {
    if (values[i] > level && values[(i - 1 + n) % n] <= level) crossings++;
  }
  return crossings;
}

describe('پردۀ پنجره‌ها — چین‌چینِ عمودی', () => {
  it('میدانِ پارچه متناهی، نرمال‌شده و دوره‌ای است (بدون NaN، بدون درز)', () => {
    let min = 1;
    let max = 0;
    for (let i = 0; i < 2048; i++) {
      const u = i / 2048 - 0.31;
      const v = (i % 37) / 36;
      const f = curtainFacing(u, v);
      expect(Number.isFinite(f)).toBe(true);
      expect(curtainPleat(u, v)).toBeGreaterThanOrEqual(0);
      min = Math.min(min, f);
      max = Math.max(max, f);
      // دوره‌ای در u ⇒ جابه‌جاییِ UVِ هر پنجره درز نمی‌سازد
      expect(curtainFacing(u + 1, v)).toBeCloseTo(f, 12);
    }
    expect(min).toBeCloseTo(0, 1);
    expect(max).toBeGreaterThan(0.95);
  });

  it('چین‌ها ریز و زیادند: هر پنجره پر از چین است، نه چند نوارِ درشت', () => {
    const n = 4096;
    const pleat = new Float64Array(n);
    const facing = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      pleat[i] = curtainPleat(i / n, 0.5);
      facing[i] = curtainFacing(i / n, 0.5);
    }
    const peaks = countCycles(pleat, 0.6);
    expect(peaks).toBe(CURTAIN.pleats);
    const pitch = CURTAIN.curtainWidth / CURTAIN.pleats;
    // «پر از چین‌چینِ ریز»: هر چین حداکثر ~۱۲ سانتی‌متر
    expect(pitch).toBeLessThan(0.12);
    // ریزچین‌ها فقط در نقشه‌اند و در چینِ مشی نیستند ⇒ بافتِ پُرتر از سیلوئ
    let diff = 0;
    for (let i = 0; i < n; i++) diff = Math.max(diff, Math.abs(facing[i] - pleat[i]));
    expect(diff).toBeGreaterThan(0.02);
    expect(countCycles(facing, 0.6)).toBeGreaterThanOrEqual(peaks);
  });

  it('چین‌ها خط‌کش‌کشیده و تکراری نیستند: پهنا و جای هر فرق مختلف است', () => {
    const n = 2048;
    const rowA = new Float64Array(n);
    const rowB = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      rowA[i] = curtainFacing(i / n, 0.16);
      rowB[i] = curtainFacing(i / n, 0.78);
    }
    let shift = 0;
    for (let i = 0; i < n; i++) shift = Math.max(shift, Math.abs(rowA[i] - rowB[i]));
    // مِآندر ⇒ پرده در ارتفاع‌های different شکلِ خودش را دارد
    expect(shift).toBeGreaterThan(0.05);
    // فاصلۀ چین‌های مجاور یکسان نیست (پردۀ دست‌چین)
    const gaps: number[] = [];
    let last = -1;
    for (let i = 0; i < n; i++) {
      if (rowA[i] > 0.98) {
        if (last >= 0) gaps.push(i - last);
        last = i;
      }
    }
    expect(gaps.length).toBeGreaterThan(3);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const spread = gaps.reduce((a, b) => a + Math.abs(b - mean), 0) / gaps.length;
    expect(spread / mean).toBeGreaterThan(0.05);
  });

  it('رأس‌های مش همان چین را می‌خوانند و هیچ‌وقت از شیشه بیرون نمی‌زنند', () => {
    for (let vi = 0; vi < CURTAIN.variants.length; vi++) {
      const geo = buildCurtainGeometry(
        CURTAIN.curtainWidth,
        CURTAIN.curtainHeight,
        CURTAIN.variants[vi],
      );
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      let minZ = 0;
      let maxZ = 0;
      for (let i = 0; i < pos.count; i++) {
        expect(Number.isFinite(pos.getZ(i))).toBe(true);
        minZ = Math.min(minZ, pos.getZ(i));
        maxZ = Math.max(maxZ, pos.getZ(i));
        const u = uv.getX(i);
        expect(u).toBeGreaterThanOrEqual(CURTAIN.variants[vi].phase - 1e-6);
        expect(u).toBeLessThanOrEqual(CURTAIN.variants[vi].phase + CURTAIN.variants[vi].scale + 1e-6);
      }
      // قله روی صفحه است و دره فقط عقب می‌رود ⇒ تداخلِ Z با قابِ برنجی نداریم
      expect(maxZ).toBeLessThanOrEqual(1e-6);
      expect(minZ).toBeGreaterThanOrEqual(-CURTAIN.foldDepth - 1e-6);
      expect(maxZ - minZ).toBeGreaterThan(CURTAIN.foldDepth * 0.5);
      geo.dispose();
    }
    expect(curtainDepth(0, 0.5)).toBeLessThanOrEqual(0);
  });

  it('سه پنجره سه کپی نیستند (فاز و مقیاسِ چین متفاوت)', () => {
    const a = buildCurtainGeometry(
      CURTAIN.curtainWidth,
      CURTAIN.curtainHeight,
      CURTAIN.variants[0],
    );
    const b = buildCurtainGeometry(
      CURTAIN.curtainWidth,
      CURTAIN.curtainHeight,
      CURTAIN.variants[1],
    );
    const pa = (a.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const pb = (b.attributes.position as THREE.BufferAttribute).array as Float32Array;
    expect(pa.length).toBe(pb.length);
    let diff = 0;
    for (let i = 2; i < pa.length; i += 3) diff = Math.max(diff, Math.abs(pa[i] - pb[i]));
    expect(diff).toBeGreaterThan(0.002);
    const uvA = (a.attributes.uv as THREE.BufferAttribute).getX(0);
    const uvB = (b.attributes.uv as THREE.BufferAttribute).getX(0);
    expect(Math.abs(uvA - uvB)).toBeGreaterThan(0.1);
    a.dispose();
    b.dispose();
  });
});

describe('پردۀ پنجره‌ها — تیرگیِ حاله‌ایِ بالا و پایین', () => {
  it('نوارِ میانی قرمزِ معمولی است و دو سر به سیاهی می‌رسد', () => {
    expect(curtainShade(0.5)).toBeGreaterThan(0.97);
    const edge = 1 - CURTAIN.endDarken;
    expect(Math.abs(curtainShade(0) - edge)).toBeLessThan(0.02);
    expect(Math.abs(curtainShade(1) - edge)).toBeLessThan(0.02);
    // داخلِ نوارِ میانی تقریباً دست‌نخورده می‌ماند
    const band = CURTAIN.litBand * 0.45;
    expect(curtainShade(0.5 - band)).toBeGreaterThan(0.96);
    expect(curtainShade(0.5 + band)).toBeGreaterThan(0.9);
    // ولی تا لبه که می‌رسیم نصف نور کم می‌شود
    expect(curtainShade(0.06)).toBeLessThan(0.55);
    expect(curtainShade(0.94)).toBeLessThan(0.55);
    // لبۀ بالا کمی تیره‌تر از لبۀ پایین است (سایۀ سرِ پرده)
    expect(curtainShade(0.98)).toBeLessThan(curtainShade(0.02));
  });

  it('گذار محو و پیوسته است: هیچ پرشِ تندی در پروفیل نیست', () => {
    const n = 512;
    let maxStep = 0;
    let prev = curtainShade(0);
    for (let i = 1; i < n; i++) {
      const cur = curtainShade(i / (n - 1));
      maxStep = Math.max(maxStep, Math.abs(cur - prev));
      prev = cur;
    }
    expect(maxStep).toBeLessThan(0.02);
    // و پروفیل تک‌موج است: یک بار تاریک→روشن و یک بار روشن→تاریک
    const { values: luma } = rowLuma(createCurtainFabricMaps().colorMap);
    const values = smooth(luma, 25);
    // تک‌موجِ حاله‌ای: اوج در میانه و از دو طرف یکنواخت کم می‌شود
    let peak = 0;
    for (let i = 1; i < values.length; i++) if (values[i] > values[peak]) peak = i;
    expect(peak).toBeGreaterThan(values.length * 0.35);
    expect(peak).toBeLessThan(values.length * 0.65);
    let dip = 0;
    for (let i = 1; i < peak; i++) dip = Math.max(dip, values[i - 1] - values[i]);
    expect(dip).toBeLessThan(0.004);
    let rise = 0;
    for (let i = peak + 1; i < values.length; i++) rise = Math.max(rise, values[i] - values[i - 1]);
    expect(rise).toBeLessThan(0.004);
    expect(values[0]).toBeLessThan(0.45 * values[Math.floor(values.length / 2)]);
    expect(values[values.length - 1]).toBeLessThan(0.55 * values[Math.floor(values.length / 2)]);
  });
});

describe('پردۀ پنجره‌ها — نقشه‌ها', () => {
  const maps = createCurtainFabricMaps();
  {
    const { colorMap, normalMap, roughnessMap, glowMap } = maps;

    it('چهار نقشه از یک میدان ساخته می‌شود و جهتِ wrap درست است', () => {
      for (const tex of [colorMap, normalMap, roughnessMap, glowMap]) {
        expect(tex).toBeInstanceOf(THREE.DataTexture);
        const d = tex.image.data as Uint8Array;
        expect(d.length).toBe(CURTAIN.textureSize * CURTAIN.textureSize * 4);
        // u = فازِ چین ⇒ باید تکرار شود (بی‌درز)؛ v = ارتفاع ⇒ باید کلید (clamp)
        // شود تا دو سرِ پرده محو بماند و از لبه به آن سرِ دیگر جهش نکند
        expect(tex.wrapS).toBe(THREE.RepeatWrapping);
        expect(tex.wrapT).toBe(THREE.ClampToEdgeWrapping);
      }
      expect(normalMap.colorSpace).toBe(THREE.NoColorSpace);
      expect(colorMap.colorSpace).toBe(THREE.SRGBColorSpace);
    });

    it('رنگ: دو سر تیرۀ سرخ، وسط قرمزِ معمولی و چین‌ها در بافت خوانا هستند', () => {
      const data = colorMap.image.data as Uint8Array;
      const n = CURTAIN.textureSize;
      const mid = Math.floor(n / 2);
      const at = (px: number, py: number) => {
        const o = (py * n + px) * 4;
        return { r: data[o], g: data[o + 1], b: data[o + 2] };
      };
      let midRed = 0;
      for (let px = 0; px < n; px++) midRed += at(px, mid).r;
      midRed /= n;
      let topRed = 0;
      let botRed = 0;
      for (let px = 0; px < n; px++) {
        topRed += at(px, n - 2).r;
        botRed += at(px, 1).r;
      }
      topRed /= n;
      botRed /= n;
      expect(midRed).toBeGreaterThan(80);
      expect(midRed).toBeLessThan(215);
      expect(topRed).toBeLessThan(0.45 * midRed);
      expect(botRed).toBeLessThan(0.55 * midRed);
      // سرخ غالب است (مخمل، نه بنفش/قهوه‌ای) و سبزِ کم
      const c = at(Math.round(n * 0.31), mid);
      expect(c.r).toBeGreaterThan(c.g * 2.2);
      expect(c.r).toBeGreaterThan(c.b * 1.5);
      // چین‌چین در نقشه هست: نوسانِ ستون‌های میانی زیاد ولی نرم است
      const cols = colLuma(colorMap);
      const mean = cols.values.reduce((a, b) => a + b, 0) / cols.n;
      const varr = cols.values.reduce((a, b) => a + (b - mean) ** 2, 0) / cols.n;
      expect(Math.sqrt(varr) / mean).toBeGreaterThan(0.14);
    });

    it('نرمال و زبری: قله صاف‌تر و دره مات است؛ پرزِ مخمل هم هست', () => {
      const nd = normalMap.image.data as Uint8Array;
      let zMin = 1;
      let sum = 0;
      let sumSq = 0;
      let count = 0;
      for (let i = 0; i < nd.length; i += 4) {
        const nx = nd[i] / 255 - 0.5;
        const nz = nd[i + 2] / 255;
        zMin = Math.min(zMin, nz);
        sum += nx;
        sumSq += nx * nx;
        count++;
      }
      expect(zMin).toBeGreaterThan(0.25); // هیچ نرمالِ واژگون/خرابی نداریم
      // شیبِ چین در نورمل ثبت شده: انحرافِ معیارِ مؤلفۀ x باید چشمگیر باشد
      expect(Math.sqrt(Math.max(0, sumSq / count - (sum / count) ** 2))).toBeGreaterThan(0.1);

      const rd = roughnessMap.image.data as Uint8Array;
      let rMin = 1;
      let rMax = 0;
      let rSum = 0;
      for (let i = 0; i < rd.length; i += 4) {
        const val = rd[i] / 255;
        rMin = Math.min(rMin, val);
        rMax = Math.max(rMax, val);
        rSum += val;
      }
      expect(rMin).toBeGreaterThan(0.6);
      expect(rMax).toBeLessThan(1.0);
      expect(rSum / (rd.length / 4)).toBeGreaterThan(0.8);
    });

    it('نورِ پشتِ پرده در دو سر خاموش می‌شود (وگرنه سیاهیِ لبه‌ها می‌سوزد)', () => {
      const { values } = rowLuma(glowMap);
      const n = values.length;
      const mid = values[Math.floor(n / 2)];
      expect(mid).toBeGreaterThan(0.3);
      expect(values[0]).toBeLessThan(0.08 * mid);
      expect(values[n - 1]).toBeLessThan(0.1 * mid);
      let maxStep = 0;
      for (let i = 1; i < n; i++) maxStep = Math.max(maxStep, Math.abs(values[i] - values[i - 1]));
      expect(maxStep).toBeLessThan(0.03);
    });
    it('نقشه‌ها قابلِ آزادکردن‌اند و در حلقۀ geometry هم دفع می‌شوند', () => {
      expect(typeof maps.dispose).toBe('function');
      const source = readFileSync('src/engine3d/alley-geometry.ts', 'utf8');
      expect(source).toMatch(/curtainMaps\.dispose\(\);/);
      maps.dispose();
    });
  }
});

describe('پردۀ پنجره‌ها — اتصال به هندسۀ کوچه', () => {
  const scene = createAlleyGeometry();
  const curtains: THREE.Mesh[] = [];
  const recesses: THREE.Mesh[] = [];
  scene.group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (typeof mesh.name === 'string' && mesh.name.startsWith('TheaterCurtain_')) curtains.push(mesh);
    if ((mesh.material as THREE.MeshStandardMaterial)?.name === 'TheaterCrimsonRecess') {
      recesses.push(mesh);
    }
  });

  it('سه پرده روی سه پنجرۀ بالای ورودی نشسته است', () => {
    expect(curtains.length).toBe(3);
    const xs = curtains.map((m) => m.position.x).sort((a, b) => a - b);
    expect(xs).toEqual(CURTAIN.windowXs);
    for (const m of curtains) {
      const mat = m.material as THREE.MeshStandardMaterial;
      expect(mat.name).toBe('TheaterCurtainVelvet');
      expect(mat.map).toBeTruthy();
      expect(mat.normalMap).toBeTruthy();
      expect(mat.roughnessMap).toBeTruthy();
      expect(mat.emissiveMap).toBeTruthy();
      expect(mat.emissiveIntensity).toBeGreaterThan(0.2);
      expect(mat.emissiveIntensity).toBeLessThan(0.9);
      // مخمل برقِ محیطی ندارد (درسِ کفِ خشکِ علیرضا: بازتابِ تیز = پلاستیک)
      expect(mat.envMapIntensity).toBeLessThanOrEqual(0.1);
      expect(mat.roughness).toBeGreaterThan(0.9);
    }
  });

  it('هیچ پرده‌ای با جعبۀ سرخِ پشتش و با قابِ برنجی تلاقیِ Z ندارد', () => {
    expect(recesses.length).toBe(3);
    for (const curtain of curtains) {
      const pos = curtain.geometry.attributes.position as THREE.BufferAttribute;
      let minZ = 0;
      let maxZ = 0;
      for (let i = 0; i < pos.count; i++) {
        minZ = Math.min(minZ, pos.getZ(i));
        maxZ = Math.max(maxZ, pos.getZ(i));
      }
      const near = recesses.reduce((best, r) =>
        Math.abs(r.position.x - curtain.position.x) < Math.abs(best.position.x - curtain.position.x) ? r : best,
      );
      const halfDepth = (near.geometry as THREE.BoxGeometry).parameters.depth / 2;
      const front = near.position.z + halfDepth;
      expect(curtain.position.z + minZ).toBeGreaterThan(front + 0.005);
      expect(curtain.position.z + maxZ).toBeLessThan(front + CURTAIN.foldDepth + 0.05);
    }
  });

  it('پردۀ صافِ یکدستِ قدیمی دیگر در کوچه نمانده است', () => {
    let bareCrimsonBoxes = 0;
    scene.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.name !== 'TheaterCrimsonRecess' && mat.map === undefined) {
        const color = mat.color ? mat.color.getHex() : -1;
        if (color === 0x5c111c) bareCrimsonBoxes++;
      }
    });
    expect(bareCrimsonBoxes).toBe(0);
  });
});
