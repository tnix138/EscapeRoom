// src/engine3d/characters/human-textures.ts — پوست، مو، پارچه و چشمِ انسان با بافت رویه‌ای
//
// چرا بافت؟ هیچ مدل سه‌بعدیِ ساخته‌شده از کپسول و کره «انسان» به نظر نمی‌رسد، چون
// پوست انسان بی‌نقص نیست: لک، رگ، چین، منافذ، تیرگی زیر چشم، عدم تقارن ابرو.
// اینجا همهٔ این‌ها را روی بوم می‌کشیم و روی همان UV‌ای می‌چسبانیم که هندسهٔ
// human-head-shape از آن استفاده می‌کند.
//
// نکتهٔ SSR/Node: بدون document خروجی null است تا تست‌های Vitest و رندر سروری
// هرگز به Canvas وابسته نشوند.

import * as THREE from 'three';
import type { HumanLook } from './human-presets';
import {
  headDirectionToUv,
  resolveBrowArc,
  resolveHeadAnchors,
  type HeadAnchors,
} from './human-head-shape';

export interface HumanTextureSet {
  faceMap: THREE.CanvasTexture | null;
  faceBump: THREE.CanvasTexture | null;
  faceRough: THREE.CanvasTexture | null;
  bodyBump: THREE.CanvasTexture | null;
  clothMap: THREE.CanvasTexture | null;
  clothBump: THREE.CanvasTexture | null;
  hairMap: THREE.CanvasTexture | null;
  hairBump: THREE.CanvasTexture | null;
  irisMap: THREE.CanvasTexture | null;
  eyeMap: THREE.CanvasTexture | null;
  dispose(): void;
}

const FACE_WIDTH = 1024;
const FACE_HEIGHT = 512;
const SURFACE_SIZE = 512;

function makeRandom(seed: number): () => number {
  let state = (seed || 0x9e3779b9) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createCanvas(width: number, height: number): {
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

function toTexture(canvas: HTMLCanvasElement, options: { srgb?: boolean; repeat?: boolean } = {}): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = options.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  if (options.repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  return texture;
}

function css(hex: number, alpha = 1): string {
  const color = new THREE.Color(hex);
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
}

function shade(hex: number, lightnessDelta: number, saturationDelta = 0): string {
  const color = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL(
    hsl.h,
    THREE.MathUtils.clamp(hsl.s + saturationDelta, 0, 1),
    THREE.MathUtils.clamp(hsl.l + lightnessDelta, 0, 1),
  );
  return `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
}

/** نقطهٔ بوم از UV سه‌بعدی (canvas با Y رو به پایین و texture با flipY). */
function uvPoint(u: number, v: number, width: number, height: number): { x: number; y: number } {
  return { x: ((u % 1) + 1) % 1 * width, y: (1 - v) * height };
}

function projectDirection(
  direction: THREE.Vector3,
  width: number,
  height: number,
): { x: number; y: number } {
  const uv = headDirectionToUv(direction);
  return uvPoint(uv.x, uv.y, width, height);
}

/** شعاع نرم با مرکز و اندازهٔ نسبی؛ برای لک، رژگونه و سایه. */
function softBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(0.5, radius));
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, radius), 0, Math.PI * 2);
  ctx.fill();
}

function strokeArc(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  color: string,
  width: number,
): void {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i]!;
    const next = points[i + 1]!;
    ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  const last = points[points.length - 1]!;
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function arcPoints(
  from: THREE.Vector3,
  to: THREE.Vector3,
  arch: number,
  steps: number,
  width: number,
  height: number,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const dir = new THREE.Vector3()
      .copy(from)
      .lerp(to, t)
      .normalize();
    // قوس ابرو/لب: کمی بالا در میانه
    const lift = Math.sin(t * Math.PI) * arch;
    dir.y += lift;
    dir.normalize();
    points.push(projectDirection(dir, width, height));
  }
  return points;
}

// ─────────────────────────────────────────────────────────────
// بافت صورت
// ─────────────────────────────────────────────────────────────

function paintFace(look: HumanLook): { color: HTMLCanvasElement; bump: HTMLCanvasElement; rough: HTMLCanvasElement } | null {
  const base = createCanvas(FACE_WIDTH, FACE_HEIGHT);
  const bumpCanvas = createCanvas(FACE_WIDTH, FACE_HEIGHT);
  const roughCanvas = createCanvas(FACE_WIDTH, FACE_HEIGHT);
  if (!base || !bumpCanvas || !roughCanvas) return null;

  const { ctx, canvas } = base;
  const random = makeRandom(look.hairHex ^ look.skinHex ^ Math.round(look.age * 1000));
  const anchors = resolveHeadAnchors(look.head);
  const W = FACE_WIDTH;
  const H = FACE_HEIGHT;
  const P = (direction: THREE.Vector3) => projectDirection(direction, W, H);

  // ۱) پوست پایه + تغییرات بزرگ‌مقیاس (پیشانی روشن‌تر، اطراف دهان تیره‌تر)
  ctx.fillStyle = shade(look.skinHex, 0);
  ctx.fillRect(0, 0, W, H);

  const cheekL = P(anchors.cheekL);
  const cheekR = P(anchors.cheekR);
  const forehead = P(anchors.forehead);
  const noseTip = P(anchors.noseTip);
  const chin = P(anchors.chin);
  const underEyeL = P(anchors.underEyeL);
  const underEyeR = P(anchors.underEyeR);
  const jawL = P(anchors.jawL);
  const jawR = P(anchors.jawR);

  for (let i = 0; i < 260; i++) {
    const x = random() * W;
    const y = H * 0.12 + random() * H * 0.88;
    const radius = 18 + random() * 50;
    const warm = random() < 0.5;
    softBlob(
      ctx,
      x,
      y,
      radius,
      warm ? 'rgba(196, 90, 70, 0.022)' : 'rgba(120, 90, 140, 0.018)',
    );
  }

  softBlob(ctx, forehead.x, forehead.y, 120, 'rgba(255, 235, 210, 0.10)');
  softBlob(ctx, cheekL.x, cheekL.y + 6, 64, 'rgba(198, 84, 76, 0.07)');
  softBlob(ctx, cheekR.x, cheekR.y + 6, 64, 'rgba(198, 84, 76, 0.07)');
  softBlob(ctx, noseTip.x, noseTip.y, 26, 'rgba(206, 96, 84, 0.16)');
  softBlob(ctx, chin.x, chin.y, 44, 'rgba(160, 96, 84, 0.10)');

  // سایهٔ زیر فک روی گردن (عمق طبیعی)
  softBlob(ctx, jawL.x, jawL.y, 110, 'rgba(40, 24, 26, 0.30)');
  softBlob(ctx, jawR.x, jawR.y, 110, 'rgba(40, 24, 26, 0.30)');
  softBlob(ctx, chin.x, chin.y + 46, 110, 'rgba(40, 24, 26, 0.20)');

  // ۲) کاسهٔ چشم: سایهٔ گرم + تیرگی ملایم زیر چشم (خستگی، بسیار انسانی)
  const eyeL = P(anchors.eyeL);
  const eyeR = P(anchors.eyeR);
  for (const eye of [eyeL, eyeR]) {
    softBlob(ctx, eye.x, eye.y - 1, 26, 'rgba(78, 46, 40, 0.26)');
    softBlob(ctx, eye.x, eye.y - 9, 18, 'rgba(255, 226, 200, 0.08)');
    softBlob(ctx, eye.x, eye.y + 9, 16, 'rgba(92, 60, 90, 0.16)');
  }
  softBlob(ctx, underEyeL.x, underEyeL.y, 24, 'rgba(96, 62, 92, 0.20)');
  softBlob(ctx, underEyeR.x, underEyeR.y, 24, 'rgba(96, 62, 92, 0.20)');

  // ۳) ابروها: صدها تار مو به‌جای یک مستطیل
  const browThickness = look.feminine ? 5 : 8;
  const browColor = css(look.hairHex, 0.85);
  const browAngle = look.marks.asymmetricBrow * 0.035;
  const browArc = resolveBrowArc(look.head);
  for (const side of [-1, 1] as const) {
    const inner = side < 0 ? browArc.inner : browArc.inner.clone().setX(-browArc.inner.x);
    const outer = side < 0 ? browArc.outer : browArc.outer.clone().setX(-browArc.outer.x);
    const archPoints = arcPoints(inner, outer, browArc.arch, 16, W, H);
    strokeArc(ctx, archPoints, 'rgba(40, 26, 20, 0.20)', browThickness + 3);
    for (let i = 0; i < 110; i++) {
      const t = random();
      const index = Math.min(archPoints.length - 1, Math.floor(t * archPoints.length));
      const anchor = archPoints[index]!;
      const taper = Math.sin(Math.PI * (0.12 + t * 0.86));
      const length = (3 + random() * 8) * taper;
      const sweep = (random() - 0.5) * 0.55 + browAngle + side * 0.32;
      const x2 = anchor.x + Math.sin(sweep) * length;
      const y2 = anchor.y - Math.cos(sweep) * length * 0.9;
      ctx.strokeStyle = css(look.hairHex, 0.3 + random() * 0.45);
      ctx.lineWidth = 0.7 + random() * 1.1;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    strokeArc(ctx, archPoints.slice(1, -1), browColor, 0.9);
  }

  // ۴) چشم: فقط سایهٔ کاسه و خط مژهٔ نازک — خودِ کرهٔ چشم سه‌بعدی است
  for (const eye of [eyeL, eyeR]) {
    softBlob(ctx, eye.x, eye.y - 2, 15, 'rgba(58, 38, 34, 0.2)');
    // خط مژه: تیره‌ترین قسمتِ چهره بعد از مردمک؛ همان چیزی که نگاه را «زنده» می‌کند
    ctx.strokeStyle = 'rgba(24, 16, 14, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(eye.x, eye.y + 1, 10.5, 3.4, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40, 26, 22, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(eye.x, eye.y + 3.4, 10, 2.6, 0, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
  }
  // چین گوشهٔ چشم
  for (const [eye, side] of [[eyeL, -1], [eyeR, 1]] as const) {
    ctx.strokeStyle = 'rgba(92, 60, 48, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(eye.x + side * 13, eye.y - 3);
    ctx.quadraticCurveTo(eye.x + side * 20, eye.y - 1, eye.x + side * 22, eye.y + 4);
    ctx.stroke();
  }

  // ۵) بینی: سایهٔ دو طرف تیغه و سوراخ‌ها
  ctx.strokeStyle = 'rgba(120, 78, 60, 0.22)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(noseTip.x - 15, noseTip.y - 26);
  ctx.quadraticCurveTo(noseTip.x - 21, noseTip.y - 6, noseTip.x - 13, noseTip.y + 2);
  ctx.moveTo(noseTip.x + 15, noseTip.y - 26);
  ctx.quadraticCurveTo(noseTip.x + 21, noseTip.y - 6, noseTip.x + 13, noseTip.y + 2);
  ctx.stroke();
  const nostrilL = P(anchors.nostrilL);
  const nostrilR = P(anchors.nostrilR);
  softBlob(ctx, nostrilL.x, nostrilL.y, 6, 'rgba(44, 26, 24, 0.62)');
  softBlob(ctx, nostrilR.x, nostrilR.y, 6, 'rgba(44, 26, 24, 0.62)');
  softBlob(ctx, noseTip.x, noseTip.y - 6, 12, 'rgba(255, 232, 210, 0.16)');

  // ۶) دهان روی بافت کشیده نمی‌شود؛ لب‌ها مش سه‌بعدی دارند. فقط یک سایهٔ ملایم
  // زیر لب پایین برای عمق می‌گذاریم.
  const mouthAnchor = P(anchors.mouth);
  softBlob(ctx, mouthAnchor.x, mouthAnchor.y + 14, 22, 'rgba(120, 78, 62, 0.10)');

  // ۷) موی صورت: ته‌ریش، سبیل، ریش
  const mouth = mouthAnchor;
  const lipHeight = 4 + look.head.lipFullness * 6;
  const cornerL = P(anchors.mouthCornerL);
  const cornerR = P(anchors.mouthCornerR);
  const lipWidth = Math.abs(cornerR.x - cornerL.x) / 2 + 4;
  const beardRegion = (x: number, y: number) => {
    const jawY = (jawL.y + jawR.y) / 2;
    const top = mouth.y + lipHeight * 1.4;
    return y > top && y < jawY + 40 && Math.abs(x - W * 0.75) < W * 0.16;
  };
  if (look.facialHair === 'stubble' || look.facialHair === 'beard') {
    const density = look.facialHair === 'beard' ? 5200 : 2400;
    for (let i = 0; i < density; i++) {
      const x = W * 0.62 + random() * W * 0.26;
      const y = mouth.y - lipHeight + random() * (chin.y - mouth.y + lipHeight + 30);
      if (!beardRegion(x, y) || random() > 0.85) continue;
      ctx.fillStyle = css(look.hairHex, 0.12 + random() * 0.3);
      ctx.fillRect(x, y, 1 + random() * 1.6, 1 + random() * 2.2);
    }
  }
  if (look.facialHair === 'moustache' || look.facialHair === 'beard') {
    for (let i = 0; i < 900; i++) {
      const x = mouth.x - lipWidth + random() * lipWidth * 2;
      const y = mouth.y - lipHeight * 1.4 + random() * lipHeight * 1.1;
      ctx.fillStyle = css(look.hairHex, 0.16 + random() * 0.4);
      ctx.fillRect(x, y, 1 + random(), 2 + random() * 2);
    }
  }
  if (look.facialHair === 'beard') {
    softBlob(ctx, chin.x, chin.y, 70, css(look.hairHex, 0.22));
    softBlob(ctx, jawL.x, jawL.y - 26, 80, css(look.hairHex, 0.18));
    softBlob(ctx, jawR.x, jawR.y - 26, 80, css(look.hairHex, 0.18));
  }

  // ۸) کک‌ومک، خال و لک‌های طبیعی
  if (look.marks.freckles) {
    for (let i = 0; i < 150; i++) {
      const t = random();
      const x = cheekL.x + t * (cheekR.x - cheekL.x);
      const y = cheekL.y - 18 + random() * 42;
      ctx.fillStyle = `rgba(126, 74, 50, ${0.12 + random() * 0.2})`;
      ctx.fillRect(x, y, 1.4, 1.4);
    }
  }
  if (look.marks.mole) {
    const moleX = cheekR.x + (random() - 0.5) * 26;
    const moleY = cheekR.y + 14 + random() * 12;
    softBlob(ctx, moleX, moleY, 3.4, 'rgba(62, 34, 28, 0.9)');
  }

  // ۹) چین‌های سنی
  const age = THREE.MathUtils.clamp(look.age, 0, 1);
  if (age > 0.15) {
    ctx.strokeStyle = `rgba(96, 64, 52, ${0.10 + age * 0.2})`;
    ctx.lineWidth = 1 + age;
    for (let i = 0; i < 3; i++) {
      const y = forehead.y + 8 + i * 11;
      const half = 44 + i * 5;
      ctx.beginPath();
      ctx.moveTo(forehead.x - half, y);
      ctx.quadraticCurveTo(forehead.x, y - 6 - age * 4, forehead.x + half, y);
      ctx.stroke();
    }
    // چین کنار بینی و لب
    for (const [corner, side] of [[nasolabialPoint(anchors, -1, W, H), -1], [nasolabialPoint(anchors, 1, W, H), 1]] as const) {
      ctx.beginPath();
      ctx.moveTo(corner.x + side * 8, corner.y - 24);
      ctx.quadraticCurveTo(corner.x + side * 14, corner.y + 4, corner.x + side * 8, corner.y + 26);
      ctx.stroke();
    }
    // گردن
    ctx.strokeStyle = `rgba(100, 70, 58, ${0.06 + age * 0.16})`;
    ctx.beginPath();
    ctx.moveTo(W * 0.68, H * 0.9);
    ctx.quadraticCurveTo(W * 0.75, H * 0.94, W * 0.82, H * 0.9);
    ctx.stroke();
  }

  // ۱۰) موی سر روی پوست سر: کمی تیرگی برای اینکه کلاه‌گیس مصنوعی نباشد
  const scalp = uvPoint(0.75, 0.18, W, H);
  softBlob(ctx, scalp.x, scalp.y, 150, css(look.hairHex, 0.12));

  // ── بافت برجستگی (bump) ──
  const bctx = bumpCanvas.ctx;
  bctx.fillStyle = 'rgb(128, 128, 128)';
  bctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 22000; i++) {
    const x = random() * W;
    const y = H * 0.1 + random() * H * 0.9;
    const value = 118 + Math.floor(random() * 24);
    bctx.fillStyle = `rgb(${value}, ${value}, ${value})`;
    bctx.fillRect(x, y, 1, 1);
  }
  // منافذ بزرگ‌تر روی گونه و بینی
  for (let i = 0; i < 1800; i++) {
    const x = cheekL.x + random() * (cheekR.x - cheekL.x);
    const y = cheekL.y - 40 + random() * 90;
    bctx.fillStyle = 'rgba(96, 96, 96, 0.5)';
    bctx.fillRect(x, y, 1.6, 1.6);
  }
  // چین‌ها در bump
  bctx.strokeStyle = 'rgba(70, 70, 70, 0.7)';
  bctx.lineWidth = 1.2;
  bctx.beginPath();
  bctx.moveTo(cornerL.x, cornerL.y);
  bctx.quadraticCurveTo(mouth.x, mouth.y + 1.5, cornerR.x, cornerR.y);
  bctx.stroke();
  for (let i = 0; i < 40; i++) {
    const t = random();
    const x = cornerL.x + t * (cornerR.x - cornerL.x);
    bctx.beginPath();
    bctx.moveTo(x, mouth.y - lipHeight);
    bctx.lineTo(x, mouth.y + lipHeight);
    bctx.stroke();
  }
  if (age > 0.15) {
    bctx.strokeStyle = 'rgba(84, 84, 84, 0.55)';
    for (let i = 0; i < 3; i++) {
      const y = forehead.y + 8 + i * 11;
      bctx.beginPath();
      bctx.moveTo(forehead.x - 44 - i * 5, y);
      bctx.quadraticCurveTo(forehead.x, y - 6, forehead.x + 44 + i * 5, y);
      bctx.stroke();
    }
  }

  // ── زبری (roughness): پوست چرب T-zone، لب براق‌تر، گونه مات‌تر ──
  const rctx = roughCanvas.ctx;
  rctx.fillStyle = 'rgb(168, 168, 168)';
  rctx.fillRect(0, 0, W, H);
  softBlob(rctx, forehead.x, forehead.y, 150, 'rgba(120,120,120,0.55)');
  softBlob(rctx, noseTip.x, noseTip.y - 22, 90, 'rgba(110,110,110,0.6)');
  softBlob(rctx, cheekL.x, cheekL.y, 90, 'rgba(196,196,196,0.5)');
  softBlob(rctx, cheekR.x, cheekR.y, 90, 'rgba(196,196,196,0.5)');
  softBlob(rctx, mouth.x, mouth.y, 34, 'rgba(92,92,92,0.75)');
  softBlob(rctx, underEyeL.x, underEyeL.y, 30, 'rgba(188,188,188,0.5)');
  softBlob(rctx, underEyeR.x, underEyeR.y, 30, 'rgba(188,188,188,0.5)');

  return { color: canvas, bump: bumpCanvas.canvas, rough: roughCanvas.canvas };
}

function nasolabialPoint(
  anchors: HeadAnchors,
  side: -1 | 1,
  width: number,
  height: number,
): { x: number; y: number } {
  const base = side < 0 ? anchors.nasolabialL : anchors.nasolabialR;
  return projectDirection(base, width, height);
}

// ─────────────────────────────────────────────────────────────
// بافت پارچه، مو و چشم
// ─────────────────────────────────────────────────────────────

function paintCloth(): { color: HTMLCanvasElement; bump: HTMLCanvasElement } | null {
  const color = createCanvas(256, 256);
  const bump = createCanvas(256, 256);
  if (!color || !bump) return null;
  const random = makeRandom(91_733);
  const ctx = color.ctx;
  ctx.fillStyle = 'rgb(226, 226, 226)';
  ctx.fillRect(0, 0, 256, 256);

  // بافت پودی/تاریِ پارچهٔ کت (روشن نگه داشته می‌شود تا رنگ کت را تیره نکند)
  for (let y = 0; y < 256; y += 2) {
    const value = 214 + Math.floor(random() * 18);
    ctx.fillStyle = `rgba(${value},${value},${value},0.5)`;
    ctx.fillRect(0, y, 256, 1);
  }
  for (let x = 0; x < 256; x += 2) {
    const value = 232 + Math.floor(random() * 14);
    ctx.fillStyle = `rgba(${value},${value},${value},0.35)`;
    ctx.fillRect(x, 0, 1, 256);
  }
  for (let i = 0; i < 2400; i++) {
    const x = random() * 256;
    const y = random() * 256;
    const value = 190 + Math.floor(random() * 50);
    ctx.fillStyle = `rgba(${value},${value},${value},0.35)`;
    ctx.fillRect(x, y, 1 + random() * 2, 1);
  }

  const bctx = bump.ctx;
  bctx.fillStyle = 'rgb(128,128,128)';
  bctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    bctx.fillStyle = 'rgba(160,160,160,0.55)';
    bctx.fillRect(0, y, 256, 1);
  }
  for (let x = 0; x < 256; x += 2) {
    bctx.fillStyle = 'rgba(96,96,96,0.45)';
    bctx.fillRect(x, 0, 1, 256);
  }
  return { color: color.canvas, bump: bump.canvas };
}

function paintHair(baseColor: number): { color: HTMLCanvasElement; bump: HTMLCanvasElement } | null {
  const color = createCanvas(256, 256);
  const bump = createCanvas(256, 256);
  if (!color || !bump) return null;
  const random = makeRandom(baseColor ^ 0x51ab);
  const ctx = color.ctx;
  ctx.fillStyle = shade(baseColor, -0.02);
  ctx.fillRect(0, 0, 256, 256);

  // تارهای مو هم‌راستا با V (از ریشه به نوک)
  for (let i = 0; i < 2600; i++) {
    const x = random() * 256;
    const y0 = random() * 256;
    const length = 18 + random() * 70;
    const bend = (random() - 0.5) * 10;
    const light = random() < 0.5;
    const hsl = { h: 0, s: 0, l: 0 };
    const base = new THREE.Color(baseColor);
    base.getHSL(hsl);
    const tint = new THREE.Color().setHSL(
      hsl.h + (random() - 0.5) * 0.03,
      hsl.s,
      THREE.MathUtils.clamp(hsl.l + (light ? 0.1 + random() * 0.14 : -0.06), 0.02, 0.85),
    );
    ctx.strokeStyle = `rgba(${Math.round(tint.r * 255)},${Math.round(tint.g * 255)},${Math.round(tint.b * 255)},${0.25 + random() * 0.5})`;
    ctx.lineWidth = 0.6 + random() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.quadraticCurveTo(x + bend, y0 + length * 0.5, x + bend * 0.4, y0 + length);
    ctx.stroke();
  }

  const bctx = bump.ctx;
  bctx.fillStyle = 'rgb(118,118,118)';
  bctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = random() * 256;
    const y = random() * 256;
    bctx.strokeStyle = random() < 0.5 ? 'rgba(190,190,190,0.5)' : 'rgba(70,70,70,0.5)';
    bctx.lineWidth = 0.8;
    bctx.beginPath();
    bctx.moveTo(x, y);
    bctx.lineTo(x + (random() - 0.5) * 6, y + 12 + random() * 30);
    bctx.stroke();
  }
  return { color: color.canvas, bump: bump.canvas };
}

function paintIris(baseColor: number): HTMLCanvasElement | null {
  const made = createCanvas(256, 256);
  if (!made) return null;
  const { ctx } = made;
  const random = makeRandom(baseColor ^ 0x1f3d);
  const center = 128;

  ctx.clearRect(0, 0, 256, 256);
  const gradient = ctx.createRadialGradient(center, center, 8, center, center, 126);
  const hsl = { h: 0, s: 0, l: 0 };
  const base = new THREE.Color(baseColor);
  base.getHSL(hsl);
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const tint = new THREE.Color().setHSL(
      hsl.h + (t - 0.5) * 0.05,
      THREE.MathUtils.clamp(hsl.s * (0.7 + t * 0.6), 0, 1),
      THREE.MathUtils.clamp(0.16 + t * 0.5 + (random() - 0.5) * 0.05, 0.04, 0.82),
    );
    gradient.addColorStop(t, `rgb(${Math.round(tint.r * 255)},${Math.round(tint.g * 255)},${Math.round(tint.b * 255)})`);
  }
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, 126, 0, Math.PI * 2);
  ctx.fill();

  // رشته‌های عنبیه
  for (let i = 0; i < 900; i++) {
    const angle = random() * Math.PI * 2;
    const inner = 18 + random() * 30;
    const outer = 70 + random() * 56;
    const light = random() < 0.45;
    ctx.strokeStyle = light ? 'rgba(255,240,215,0.14)' : 'rgba(12,10,8,0.20)';
    ctx.lineWidth = 0.6 + random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
    ctx.lineTo(center + Math.cos(angle + 0.06) * outer, center + Math.sin(angle + 0.06) * outer);
    ctx.stroke();
  }
  // حلقهٔ تیرهٔ دور عنبیه
  ctx.strokeStyle = 'rgba(10, 8, 8, 0.85)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(center, center, 118, 0, Math.PI * 2);
  ctx.stroke();
  // مردمک
  ctx.fillStyle = 'rgba(6, 5, 6, 0.98)';
  ctx.beginPath();
  ctx.arc(center, center, 52, 0, Math.PI * 2);
  ctx.fill();
  // انعکاس نور پنجره (چشم زنده و براق)
  const glint = ctx.createRadialGradient(center - 26, center - 30, 2, center - 26, center - 30, 26);
  glint.addColorStop(0, 'rgba(255,255,255,0.92)');
  glint.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glint;
  ctx.beginPath();
  ctx.arc(center - 26, center - 30, 26, 0, Math.PI * 2);
  ctx.fill();
  return made.canvas;
}

function paintSkinNoise(): { bump: HTMLCanvasElement } | null {
  const made = createCanvas(256, 256);
  if (!made) return null;
  const { ctx } = made;
  ctx.fillStyle = 'rgb(128,128,128)';
  ctx.fillRect(0, 0, 256, 256);
  const random = makeRandom(4_231);
  for (let i = 0; i < 9000; i++) {
    const value = 108 + Math.floor(random() * 40);
    ctx.fillStyle = `rgba(${value},${value},${value},0.6)`;
    ctx.fillRect(random() * 256, random() * 256, 1, 1);
  }
  return { bump: made.canvas };
}

export function createHumanTextures(look: HumanLook): HumanTextureSet {
  const face = paintFace(look);
  const cloth = paintCloth();
  const hair = paintHair(look.hairHex);
  const skin = paintSkinNoise();
  const iris = paintIris(look.eyeHex);

  const textures: THREE.Texture[] = [];
  const keep = <T extends THREE.Texture | null>(texture: T): T => {
    if (texture) textures.push(texture);
    return texture;
  };

  const faceMap = keep(face ? toTexture(face.color) : null);
  const faceBump = keep(face ? toTexture(face.bump, { srgb: false }) : null);
  const faceRough = keep(face ? toTexture(face.rough, { srgb: false }) : null);
  const bodyBump = keep(skin ? toTexture(skin.bump, { srgb: false, repeat: true }) : null);
  const clothMap = keep(cloth ? toTexture(cloth.color) : null);
  const clothBump = keep(cloth ? toTexture(cloth.bump, { srgb: false, repeat: true }) : null);
  const hairMap = keep(hair ? toTexture(hair.color, { repeat: true }) : null);
  const hairBump = keep(hair ? toTexture(hair.bump, { srgb: false, repeat: true }) : null);
  const irisMap = keep(iris ? toTexture(iris) : null);
  const eyeMap = null;

  if (bodyBump) bodyBump.repeat.set(2, 2);
  if (clothBump) clothBump.repeat.set(3, 3);
  if (clothMap) clothMap.repeat.set(3, 3);
  if (hairMap) hairMap.repeat.set(2, 2);
  if (hairBump) hairBump.repeat.set(2, 2);

  if (faceBump) faceBump.repeat.set(1, 1);

  return {
    faceMap,
    faceBump,
    faceRough,
    bodyBump,
    clothMap,
    clothBump,
    hairMap,
    hairBump,
    irisMap,
    eyeMap,
    dispose() {
      for (const texture of textures) texture.dispose();
      textures.length = 0;
    },
  };
}

/** عرض خام بوم صورت برای هم‌ترازی تست‌ها و ابزار ادمین */
export const FACE_TEXTURE_SIZE = { width: FACE_WIDTH, height: FACE_HEIGHT, surface: SURFACE_SIZE } as const;
