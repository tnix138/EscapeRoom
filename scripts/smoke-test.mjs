#!/usr/bin/env node
// scripts/smoke-test.mjs — اسمک‌تست مسیر اصلی بازی روی یک سرور در حال اجرا
// (فاز ۱۵ — توحید). در CI بعد از deploy و در انتشار دستی استفاده می‌شود.
//
// استفاده:
//   node scripts/smoke-test.mjs                     # http://localhost:3000
//   BASE_URL=https://... node scripts/smoke-test.mjs
//
// خروجی: هر مرحله یک خط فارسی؛ در اولین شکست با کد ۱ خارج می‌شود.
import process from 'node:process';

const BASE_URL = (process.env.BASE_URL ?? process.env.PRODUCTION_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 10_000);

let passed = 0;

function log(step, ok, detail = '') {
  const mark = ok ? '✅' : '❌';
  console.log(`${mark} ${step}${detail ? ` — ${detail}` : ''}`);
}

async function request(path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${BASE_URL}${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function assert(condition, step, detail) {
  if (condition) {
    passed++;
    log(step, true, detail);
    return;
  }
  log(step, false, detail);
  console.error(`\n❌ اسمک‌تست شکست خورد در: ${step}`);
  process.exit(1);
}

async function main() {
  console.log(`🔎 اسمک‌تست ${BASE_URL}\n`);

  // ۱) سلامت سرور و درایور ذخیره‌سازی
  const health = await request('/api/health');
  const healthBody = await health.json().catch(() => null);
  assert(
    health.ok && healthBody?.ok === true,
    'سلامت سرور (/api/health)',
    `درایور: ${healthBody?.data?.storageDriver ?? 'نامشخص'}`,
  );

  // ۲) صفحهٔ اصلی
  const home = await request('/');
  const homeHtml = await home.text();
  assert(home.ok && homeHtml.includes('تماشاخانه'), 'صفحهٔ اصلی', `HTTP ${home.status}`);

  // ۳) ساخت اتاق ۳ نفره
  const created = await request('/api/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      playerCount: 3,
      playerNames: ['بازیکن آزمون یک', 'بازیکن آزمون دو', 'بازیکن آزمون سه'],
    }),
  });
  const createdBody = await created.json().catch(() => null);
  const room = createdBody?.data;
  assert(
    created.ok && typeof room?.roomCode === 'string' && room.invites?.length === 3,
    'ساخت اتاق و لینک‌های دعوت',
    `اتاق ${room?.roomCode ?? '—'}`,
  );

  const [first, second] = room.invites;

  // ۴) خواندن وضعیت اتاق با توکن صندلی
  const view = await request(`/api/rooms/${room.roomCode}`, {
    headers: { 'x-seat-token': first.seatToken },
  });
  const viewBody = await view.json().catch(() => null);
  assert(
    view.ok && viewBody?.data?.roomView?.phase === 'alley_puzzle',
    'خواندن وضعیت اتاق با توکن صندلی',
    `فاز: ${viewBody?.data?.roomView?.phase ?? '—'}`,
  );

  // ۵) رد توکن نامعتبر
  const invalid = await request(`/api/rooms/${room.roomCode}`, {
    headers: { 'x-seat-token': 'z'.repeat(48) },
  });
  const invalidBody = await invalid.json().catch(() => null);
  assert(
    invalid.status === 401 && invalidBody?.error?.code === 'INVALID_SEAT_TOKEN',
    'رد توکن صندلی نامعتبر',
    `HTTP ${invalid.status}`,
  );

  // ۶) ثبت حضور (فاز ۰۳)
  const presence = await request(`/api/rooms/${room.roomCode}/presence`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-seat-token': second.seatToken },
    body: JSON.stringify({
      position: { x: 1.5, y: 1.65, z: -3 },
      yaw: 0.42,
      phase: 'alley_puzzle',
    }),
  });
  const presenceBody = await presence.json().catch(() => null);
  assert(
    presence.ok && presenceBody?.data?.accepted === true,
    'ثبت حضور بازیکن',
    `تعداد snapshot: ${presenceBody?.data?.presences?.length ?? 0}`,
  );

  // ۷) رد موقعیت خارج از محدوده
  const outOfBounds = await request(`/api/rooms/${room.roomCode}/presence`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-seat-token': second.seatToken },
    body: JSON.stringify({ position: { x: 500, y: 1.65, z: 0 }, yaw: 0, phase: 'alley_puzzle' }),
  });
  assert(outOfBounds.status === 400, 'رد موقعیت خارج از محدوده', `HTTP ${outOfBounds.status}`);

  // ۸) استریم SSE رویداد اول را می‌فرستد
  const controller = new AbortController();
  const streamTimer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let firstChunk = '';
  try {
    const stream = await fetch(`${BASE_URL}/api/rooms/${room.roomCode}/stream?token=${first.seatToken}`, {
      signal: controller.signal,
    });
    const reader = stream.body?.getReader();
    if (reader) {
      const { value } = await reader.read();
      firstChunk = new TextDecoder().decode(value ?? new Uint8Array());
      await reader.cancel().catch(() => {});
    }
  } catch {
    firstChunk = '';
  } finally {
    clearTimeout(streamTimer);
  }
  assert(
    firstChunk.includes('event: room_update'),
    'استریم بلادرنگ SSE',
    firstChunk ? 'رویداد room_update دریافت شد' : 'هیچ رویدادی نیامد',
  );

  console.log(`\n🎉 اسمک‌تست کامل شد: ${passed} مرحله سبز.`);
}

main().catch((err) => {
  console.error('❌ خطای اسمک‌تست:', err?.message ?? err);
  process.exit(1);
});
