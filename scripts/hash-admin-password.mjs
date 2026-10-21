#!/usr/bin/env node
// scripts/hash-admin-password.mjs — ساخت هش scrypt برای رمز ادمین (فاز ۰۹ — توحید)
// امیر در سرور همین الگو را برای بررسی رمز استفاده می‌کند و توحید مقدار هش را
// در ADMIN_PASSWORD_HASH روی Vercel می‌گذارد؛ رمز خام هیچ‌وقت در Git نمی‌آید.
//
// استفاده:
//   node scripts/hash-admin-password.mjs 'رمز-دلخواه'
//   node scripts/hash-admin-password.mjs            # رمز را تعاملی می‌پرسد
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import process from 'node:process';

const SCRYPT_KEYLEN = 64;

export function hashAdminPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyAdminPassword(password, stored) {
  const [scheme, salt, expected] = String(stored ?? '').split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  const target = Buffer.from(expected, 'hex');
  return actual.length === target.length && timingSafeEqual(actual, target);
}

async function askPassword() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question('رمز ادمین: ')).trim();
  } finally {
    rl.close();
  }
}

async function main() {
  const password = (process.argv[2] ?? (await askPassword())).trim();
  if (password.length < 12) {
    console.error('❌ رمز ادمین باید دست‌کم ۱۲ کاراکتر باشد.');
    process.exit(1);
  }

  const stored = hashAdminPassword(password);
  if (!verifyAdminPassword(password, stored)) {
    console.error('❌ هش ساخته‌شده معتبر نیست؛ دوباره تلاش کن.');
    process.exit(1);
  }

  console.log('✅ هش آماده است. این خط را در env سرور بگذار (نه در Git):');
  console.log(`ADMIN_PASSWORD_HASH='${stored}'`);
}

// فقط وقتی مستقیم اجرا شود، نه هنگام import در تست
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌ خطا:', err);
    process.exit(1);
  });
}
