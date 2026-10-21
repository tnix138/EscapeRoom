'use client';

/**
 * alley-signs.ts — رندر متن واقعی و باکیفیت روی تابلوهای سه‌بعدی کوچه (علیرضا)
 * - پوستر اعلانات نمایش امشب روی دیوار چپ (Playbill)
 * - جدول برنجی تبدیل ردیف صندلی در گیشهٔ راست (Row Chart)
 * - سردر نورانی تماشاخانهٔ اُرفه‌ئو (Marquee)
 * - پلاک لعابی نام کوچه و پلاک‌های هشدار
 *
 * نکتهٔ معماری:
 * ۱) در مرورگر روی Canvas با رزولوشن بالا (1280×1536 / 1280×1024)، چیدمان راست‌به‌چپ
 *    و شکست خودکار خطوط رندر می‌شود و پس از آماده شدن فونت Vazirmatn دوباره بازترسیم
 *    می‌گردد تا هیچ حروف فارسی به‌هم‌ریخته یا بریده نشود.
 * ۲) در محیط تست Node (بدون document) یک DataTexture سبک برمی‌گرداند تا تست‌های واحد
 *    مستقیم روی createAlleyGeometry اجرا شوند.
 */

import * as THREE from 'three';

export interface AlleySignActItem {
  actNumber: number;
  sceneTitle: string;
  description: string;
}

export interface AlleySignRowItem {
  rowTitle: string;
  romanCode: string;
}

export interface AlleySignCluesData {
  playbill: readonly AlleySignActItem[];
  rowChart: readonly AlleySignRowItem[];
  punchedCount?: number;
  requiredCount?: number;
}

export const DEFAULT_ALLEY_SIGN_CLUES: AlleySignCluesData = {
  playbill: [
    {
      actNumber: 1,
      sceneTitle: 'ورود نقاب‌داران به تالار آینه‌ها',
      description: 'مهمانان با نقاب‌های طلایی وارد می‌شوند و نخستین آواز در تالار می‌پیچد.',
    },
    {
      actNumber: 2,
      sceneTitle: 'والس ویولنِ ترک‌خورده',
      description: 'نوازنده‌ای تنها زیر نور شمعدان‌ها والس فراموش‌شدهٔ اُرفه‌ئو را می‌نوازد.',
    },
    {
      actNumber: 3,
      sceneTitle: 'رقص قو بر دریاچهٔ مه',
      description: 'رقصنده‌ای با جامهٔ سفید بر مهِ صحنه می‌چرخد و رز سرخی بر زمین می‌افتد.',
    },
    {
      actNumber: 4,
      sceneTitle: 'زنگ خاموشی و پردهٔ سرخ',
      description: 'زنگ پرده برای آخرین بار می‌خورد و ساعت شنیِ تالار وارونه می‌شود.',
    },
  ],
  rowChart: [
    { rowTitle: 'ردیف طلاییِ پیشین', romanCode: 'I' },
    { rowTitle: 'ردیف مخملِ میانی', romanCode: 'II' },
    { rowTitle: 'ردیف نقره‌ایِ بالکن', romanCode: 'III' },
    { rowTitle: 'ردیف سایهٔ پسین', romanCode: 'IV' },
  ],
  punchedCount: 0,
  requiredCount: 3,
};

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function formatPersianDigits(value: number): string {
  if (!Number.isFinite(value)) return '۰';
  return String(Math.trunc(value)).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

function createFallbackDataTexture(hex: number, name: string): THREE.DataTexture {
  const c = new THREE.Color(hex);
  const data = new Uint8Array(16 * 16 * 4);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  for (let i = 0; i < 16 * 16; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, 16, 16, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  tex.name = name;
  return tex;
}

function makeCanvas2D(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        for (let j = i + 1; j < words.length; j++) {
          const rest = `${current} ${words[j]}`;
          if (ctx.measureText(rest).width <= maxWidth) {
            current = rest;
          } else {
            current = `${current}…`;
            break;
          }
        }
        lines.push(current);
        return lines;
      }
    }
  }
  lines.push(current);
  return lines.slice(0, maxLines);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export interface UpdatableSignTexture {
  readonly texture: THREE.Texture;
  redraw(data: AlleySignCluesData): void;
  dispose(): void;
}

/**
 * پوستر دیواری «اعلان نمایش امشب» (۱۲۸۰×۱۵۳۶) با حاشیهٔ کلاسیک ۱۹۲۴،
 * شمارهٔ هر پرده، عنوان درشت و توضیح کامل فارسی که مستقیم در فضای سه‌بعدی خوانده می‌شود.
 */
export function createPlaybillSignTexture(initialData: AlleySignCluesData): UpdatableSignTexture {
  const surface = makeCanvas2D(1280, 1536);
  if (!surface) {
    const fallback = createFallbackDataTexture(0xede0c4, 'PlaybillPosterFallback');
    return {
      texture: fallback,
      redraw: () => {},
      dispose: () => fallback.dispose(),
    };
  }

  const { canvas, ctx } = surface;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.name = 'PlaybillPosterCanvasTexture';

  let currentData = initialData;
  let disposed = false;

  const paint = (data: AlleySignCluesData) => {
    if (disposed) return;
    currentData = data;
    const W = canvas.width;
    const H = canvas.height;

    // پس‌زمینهٔ کاغذ پوستر قدیمی با تیرگی گوشه‌ها
    const paperGrad = ctx.createRadialGradient(W * 0.5, H * 0.42, 120, W * 0.5, H * 0.5, W * 0.85);
    paperGrad.addColorStop(0, '#f4e8cd');
    paperGrad.addColorStop(0.72, '#e6d3ad');
    paperGrad.addColorStop(1, '#c5ac80');
    ctx.fillStyle = paperGrad;
    ctx.fillRect(0, 0, W, H);

    // بافت ظریف کهنگی و لکه‌های رطوبت کاغذ (قطعی بدون تصادف)
    for (let i = 0; i < 42; i++) {
      const sx = ((i * 293) % 1180) + 50;
      const sy = ((i * 467) % 1430) + 50;
      const sr = 26 + ((i * 37) % 95);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(128, 96, 58, 0.045)' : 'rgba(255, 248, 232, 0.06)';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // قاب دوبل زرشکی و طلایی به سبک پوسترهای اپرای ایتالیایی ۱۹۲۴
    ctx.strokeStyle = '#5c141d';
    ctx.lineWidth = 14;
    ctx.strokeRect(36, 36, W - 72, H - 72);

    ctx.strokeStyle = '#9c7432';
    ctx.lineWidth = 5;
    ctx.strokeRect(58, 58, W - 116, H - 116);

    // پین‌های برنجی چهار گوشه
    for (const [px, py] of [
      [68, 68],
      [W - 68, 68],
      [68, H - 68],
      [W - 68, H - 68],
    ]) {
      ctx.fillStyle = '#8b692f';
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f0d596';
      ctx.beginPath();
      ctx.arc(px - 3, py - 3, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // سربرگ لاتین و فارسی
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6d1b24';
    ctx.font = '700 30px Georgia, serif';
    ctx.fillText('✦   STAGIONE 1924  ·  TEATRO ORFEO   ✦', W / 2, 128);

    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1b110b';
    ctx.font = '800 68px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText('تابلوی اعلانات نمایش امشب', W / 2, 218);

    // نوار عنوان میانی
    drawRoundedRect(ctx, 96, 248, W - 192, 64, 12);
    ctx.fillStyle = '#5c141d';
    ctx.fill();
    ctx.fillStyle = '#f8ead0';
    ctx.font = '700 32px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText('فهرست رسمی پرده‌ها  —  شمارهٔ پرده را از روی نام آن بیابید', W / 2, 291);

    // کارت‌های پرده‌ها
    const acts = data.playbill.length > 0 ? data.playbill : DEFAULT_ALLEY_SIGN_CLUES.playbill;
    const topStart = 342;
    const availableHeight = H - topStart - 128;
    const gap = 22;
    const cardHeight = Math.floor((availableHeight - gap * (acts.length - 1)) / Math.max(acts.length, 1));

    acts.forEach((act, idx) => {
      const cy = topStart + idx * (cardHeight + gap);
      const cx = 92;
      const cw = W - 184;

      drawRoundedRect(ctx, cx, cy, cw, cardHeight, 16);
      ctx.fillStyle = idx % 2 === 0 ? 'rgba(255, 250, 238, 0.72)' : 'rgba(235, 217, 184, 0.72)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(116, 78, 38, 0.58)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // مدالیون شمارهٔ پرده در سمت راست کارت (چیدمان راست‌به‌چپ)
      const badgeW = 190;
      const badgeH = cardHeight - 36;
      const badgeX = cx + cw - badgeW - 22;
      const badgeY = cy + 18;
      drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 12);
      ctx.fillStyle = '#4e121a';
      ctx.fill();
      ctx.strokeStyle = '#c9a259';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e7c987';
      ctx.font = '700 28px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText('پردهٔ', badgeX + badgeW / 2, badgeY + badgeH * 0.37);

      ctx.fillStyle = '#fff6e3';
      ctx.font = '900 76px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText(formatPersianDigits(act.actNumber), badgeX + badgeW / 2, badgeY + badgeH * 0.80);

      // عنوان و توضیح پرده
      const textRight = badgeX - 28;
      const maxTextWidth = textRight - (cx + 32);
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#170e09';
      ctx.font = '800 42px Vazirmatn, Tahoma, sans-serif';
      const titleLines = wrapTextLines(ctx, act.sceneTitle, maxTextWidth, 2);
      let lineY = cy + (titleLines.length > 1 ? 56 : 68);
      for (const line of titleLines) {
        ctx.fillText(line, textRight, lineY);
        lineY += 48;
      }

      ctx.fillStyle = '#3b281b';
      ctx.font = '600 28px Vazirmatn, Tahoma, sans-serif';
      const descLines = wrapTextLines(ctx, act.description, maxTextWidth, 2);
      lineY += 8;
      for (const line of descLines) {
        ctx.fillText(line, textRight, lineY);
        lineY += 38;
      }
    });

    // پانویس راهنما
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5c141d';
    ctx.font = '700 29px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText('✦  کوپنِ دست هم‌تیمی شما، نام پردهٔ مخصوص بلیط شما را مشخص می‌کند  ✦', W / 2, H - 72);

    texture.needsUpdate = true;
  };

  paint(initialData);

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    void document.fonts.ready.then(() => {
      if (!disposed) paint(currentData);
    });
  }

  return {
    texture,
    redraw: paint,
    dispose() {
      if (disposed) return;
      disposed = true;
      texture.dispose();
    },
  };
}

/**
 * تابلوی برنجی و لعابی گیشه (۱۲۸۰×۱۰۲۴):
 * ردیف صندلی روی بلیط هر بازیکن و کد رومی متناظر (I، II، III، IV) را با فونت بسیار درشت
 * و کنتراست طلایی-روشن روی زمینهٔ تیرهٔ گیشه نشان می‌دهد تا بدون هیچ دکمه‌ای خوانا باشد.
 */
export function createRowChartSignTexture(initialData: AlleySignCluesData): UpdatableSignTexture {
  const surface = makeCanvas2D(1280, 1024);
  if (!surface) {
    const fallback = createFallbackDataTexture(0x261f18, 'RowChartFallback');
    return {
      texture: fallback,
      redraw: () => {},
      dispose: () => fallback.dispose(),
    };
  }

  const { canvas, ctx } = surface;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.name = 'RowChartBoardCanvasTexture';

  let currentData = initialData;
  let disposed = false;

  const paint = (data: AlleySignCluesData) => {
    if (disposed) return;
    currentData = data;
    const W = canvas.width;
    const H = canvas.height;

    // صفحهٔ فلزی برنزی-سیاه لعاب‌خورده
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#221a13');
    bg.addColorStop(0.5, '#17120e');
    bg.addColorStop(1, '#201811');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // قاب برنجی پرچ‌دار
    ctx.strokeStyle = '#c8a258';
    ctx.lineWidth = 14;
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.strokeStyle = '#75592a';
    ctx.lineWidth = 4;
    ctx.strokeRect(50, 50, W - 100, H - 100);

    for (const [rx, ry] of [
      [58, 58],
      [W - 58, 58],
      [58, H - 58],
      [W - 58, H - 58],
    ]) {
      ctx.fillStyle = '#dfb96d';
      ctx.beginPath();
      ctx.arc(rx, ry, 11, 0, Math.PI * 2);
      ctx.fill();
    }

    // عنوان گیشه
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d3ae63';
    ctx.font = '700 27px Georgia, serif';
    ctx.fillText('⌘   BIGLIETTERIA  ·  TABELLA DELLE FILE   ⌘', W / 2, 108);

    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fdf2dc';
    ctx.font = '800 56px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText('گیشهٔ مکانیکی  —  جدول کد ردیف‌ها', W / 2, 184);

    // سرستون جدول
    drawRoundedRect(ctx, 82, 214, W - 164, 66, 10);
    ctx.fillStyle = '#382a1a';
    ctx.fill();
    ctx.strokeStyle = '#b99249';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#efd292';
    ctx.font = '700 32px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText('عنوان ردیف نوشته‌شده روی بلیط', W - 118, 258);

    ctx.textAlign = 'left';
    ctx.fillText('کد رومی پانچ', 118, 258);

    // سطرهای جدول
    const rows = data.rowChart.length > 0 ? data.rowChart : DEFAULT_ALLEY_SIGN_CLUES.rowChart;
    const startY = 302;
    const availH = H - startY - 122;
    const gap = 18;
    const rowH = Math.floor((availH - gap * (rows.length - 1)) / Math.max(rows.length, 1));

    rows.forEach((row, index) => {
      const y = startY + index * (rowH + gap);
      drawRoundedRect(ctx, 82, y, W - 164, rowH, 14);
      ctx.fillStyle = index % 2 === 0 ? 'rgba(54, 41, 28, 0.86)' : 'rgba(38, 29, 20, 0.90)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(200, 162, 88, 0.55)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // نام فارسی ردیف در سمت راست
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff7e7';
      ctx.font = '800 46px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText(row.rowTitle, W - 116, y + rowH * 0.63);

      // پلاک طلایی برجستهٔ کد رومی در سمت چپ
      const codeBoxW = 230;
      const codeBoxH = rowH - 26;
      const codeBoxX = 108;
      const codeBoxY = y + 13;
      const goldGrad = ctx.createLinearGradient(codeBoxX, codeBoxY, codeBoxX, codeBoxY + codeBoxH);
      goldGrad.addColorStop(0, '#f3d48c');
      goldGrad.addColorStop(1, '#b88b3c');
      drawRoundedRect(ctx, codeBoxX, codeBoxY, codeBoxW, codeBoxH, 10);
      ctx.fillStyle = goldGrad;
      ctx.fill();

      ctx.direction = 'ltr';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1b1208';
      ctx.font = '900 56px Georgia, serif';
      ctx.fillText(row.romanCode, codeBoxX + codeBoxW / 2, codeBoxY + codeBoxH * 0.72);
    });

    // شمارندهٔ زندهٔ بلیط‌های پانچ‌شده در پایین گیشه
    const punched = data.punchedCount ?? 0;
    const required = data.requiredCount ?? 3;
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e7c77f';
    ctx.font = '700 30px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText(
      `بلیط‌های تأییدشدهٔ گروه: ${formatPersianDigits(punched)} از ${formatPersianDigits(required)}   ·   پس از تکمیل همه، قفل درِ تماشاخانه باز می‌شود`,
      W / 2,
      H - 64,
    );

    texture.needsUpdate = true;
  };

  paint(initialData);

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    void document.fonts.ready.then(() => {
      if (!disposed) paint(currentData);
    });
  }

  return {
    texture,
    redraw: paint,
    dispose() {
      if (disposed) return;
      disposed = true;
      texture.dispose();
    },
  };
}

/** تابلوی سردر نورانی تماشاخانهٔ اُرفه‌ئو بالای در ورودی */
export function createTheaterMarqueeTexture(): UpdatableSignTexture {
  const surface = makeCanvas2D(1536, 384);
  if (!surface) {
    const fallback = createFallbackDataTexture(0x3a1418, 'TheaterMarqueeFallback');
    return {
      texture: fallback,
      redraw: () => {},
      dispose: () => fallback.dispose(),
    };
  }

  const { canvas, ctx } = surface;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.name = 'TheaterMarqueeCanvasTexture';

  let disposed = false;

  const paint = () => {
    if (disposed) return;
    const W = canvas.width;
    const H = canvas.height;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2a0c12');
    grad.addColorStop(0.5, '#42121b');
    grad.addColorStop(1, '#22090d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#dfb86a';
    ctx.lineWidth = 12;
    ctx.strokeRect(20, 20, W - 40, H - 40);

    // ردیف حباب‌های دور سردر روی بافت
    for (let x = 52; x <= W - 52; x += 64) {
      for (const y of [40, H - 40]) {
        ctx.fillStyle = '#ffe5a8';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe4a4';
    ctx.font = '800 58px Georgia, serif';
    ctx.fillText('✦   TEATRO  ORFEO   ✦', W / 2, 146);

    ctx.direction = 'rtl';
    ctx.fillStyle = '#fff5e0';
    ctx.font = '800 62px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText('تماشاخانهٔ اُرفه‌ئو  —  پردهٔ سرخ', W / 2, 244);

    ctx.fillStyle = '#e7c27d';
    ctx.font = '600 31px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText('ورود به سالن فقط با رمزِ بلیط‌های پانچ‌شدهٔ همهٔ هم‌تیمی‌ها', W / 2, 312);

    texture.needsUpdate = true;
  };

  paint();

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    void document.fonts.ready.then(() => {
      if (!disposed) paint();
    });
  }

  return {
    texture,
    redraw: () => paint(),
    dispose() {
      if (disposed) return;
      disposed = true;
      texture.dispose();
    },
  };
}

/** پلاک لعابی نام کوچه روی دیوار ساختمان نبش */
export function createStreetPlaqueTexture(): THREE.Texture {
  const surface = makeCanvas2D(640, 240);
  if (!surface) {
    return createFallbackDataTexture(0x1b3556, 'StreetPlaqueFallback');
  }
  const { canvas, ctx } = surface;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.name = 'StreetPlaqueTexture';

  const draw = () => {
    ctx.fillStyle = '#162c47';
    ctx.fillRect(0, 0, 640, 240);
    ctx.strokeStyle = '#e9e2d2';
    ctx.lineWidth = 10;
    ctx.strokeRect(16, 16, 608, 208);

    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f7f1e3';
    ctx.font = '800 58px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText('کوچهٔ اُرفه‌ئو', 320, 114);

    ctx.direction = 'ltr';
    ctx.fillStyle = '#c8d6e6';
    ctx.font = '700 28px Georgia, serif';
    ctx.fillText('VICOLO DEL TEATRO  ·  N° 14', 320, 178);
    tex.needsUpdate = true;
  };

  draw();
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    void document.fonts.ready.then(() => draw());
  }
  return tex;
}
