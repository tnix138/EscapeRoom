#!/usr/bin/env node
/**
 * generate-pwa-icons.mjs — ساخت آیکن‌های PWA از نشانِ متنی برند (✳)
 * ------------------------------------------------------------------
 * پروژه فایل لوگوی بیت‌مپی ندارد و نشانِ برند همان مُهرِ ✳ روی پردهٔ زرشکی است.
 * برای نصب روی صفحهٔ خانه (iOS/Android) به PNG واقعی نیاز است، پیش از این فقط
 * SVG وجود داشت که Safari برای `apple-touch-icon` نمی‌پذیرد. این اسکریپت همان
 * نشان را با ریاضیِ ساده روی بوم پیکسلی می‌کشد و PNG را با zlib می‌نویسد تا
 * هیچ وابستگی تصویری به پروژه اضافه نشود.
 *
 * اجرا: `node scripts/generate-pwa-icons.mjs`
 * خروجی: `public/icons/` (۱۹۲، ۵۱۲، ماسک‌دار ۵۱۲ و apple-touch-icon ۱۸۰)
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'icons');

const PAPER = [18, 13, 16];
const WINE = [143, 33, 50];
const GOLD = [212, 175, 99];
const GOLD_LIGHT = [242, 215, 152];

/** فاصلهٔ نقطه از پارهٔ خط (a→b) */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * نشان: هشت‌پرِ طلایی درون حلقهٔ نازک، روی زمینهٔ زرشکیِ شعاعی.
 * `safe` نسبت ناحیهٔ امن است (برای آیکن ماسک‌دار کوچک‌تر می‌کشیم).
 */
function renderIcon(size, { safe = 1 } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const ringRadius = size * 0.4 * safe;
  const starRadius = size * 0.28 * safe;
  const stroke = Math.max(1.4, size * 0.014) * safe;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const distance = Math.hypot(px - center, py - center);

      // زمینه: زرشکیِ شعاعی روی مشکیِ گرم
      const glow = Math.max(0, 1 - distance / (size * 0.62));
      let color = mix(PAPER, WINE, Math.pow(glow, 1.7) * 0.9);

      // حلقهٔ نازک طلایی
      const ringEdge = Math.abs(distance - ringRadius);
      if (ringEdge < stroke) {
        const alpha = 1 - ringEdge / stroke;
        color = mix(color, GOLD, Math.min(1, alpha * 0.85));
      }

      // هشت‌پر (✳): چهار پارهٔ قطری که از مرکز می‌گذرند
      for (let spoke = 0; spoke < 4; spoke += 1) {
        const angle = (Math.PI / 4) * spoke;
        const amplitude = spoke % 2 === 0 ? starRadius : starRadius * 0.78;
        const ax = center - Math.cos(angle) * amplitude;
        const ay = center - Math.sin(angle) * amplitude;
        const bx = center + Math.cos(angle) * amplitude;
        const by = center + Math.sin(angle) * amplitude;
        const d = distanceToSegment(px, py, ax, ay, bx, by);
        const spokeWidth = stroke * 1.25;
        if (d < spokeWidth) {
          const alpha = 1 - d / spokeWidth;
          color = mix(color, spoke % 2 === 0 ? GOLD_LIGHT : GOLD, Math.min(1, alpha));
        }
      }

      // نقطهٔ مرکزی
      if (distance < size * 0.032 * safe) color = mix(color, GOLD_LIGHT, 0.95);

      const offset = (y * size + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  // هر ردیف با فیلتر نوع ۰ (None)
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  { name: 'icon-192.png', size: 192, safe: 1 },
  { name: 'icon-512.png', size: 512, safe: 1 },
  // آیکن ماسک‌دار: نشان در ۸۰٪ مرکز می‌ماند تا دایره/گوشهٔ برش آن را نبُرد
  { name: 'maskable-512.png', size: 512, safe: 0.72 },
  { name: 'apple-touch-icon-180.png', size: 180, safe: 0.94 },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const target of targets) {
  const png = encodePng(target.size, renderIcon(target.size, { safe: target.safe }));
  writeFileSync(join(OUT_DIR, target.name), png);
  console.log('نوشته شد:', `public/icons/${target.name}`, `${(png.length / 1024).toFixed(1)}KB`);
}
