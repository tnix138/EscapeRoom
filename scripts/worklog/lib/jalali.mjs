/**
 * Jalali (Solar Hijri) calendar helpers + Iran timezone formatting.
 *
 * The team convention is that every log id / date is expressed in **Iran
 * local time** (Asia/Tehran) and in the Jalali calendar, while the canonical
 * machine timestamp is stored as UTC ISO-8601.  Keeping both in sync is the
 * whole point of this module.
 *
 * The conversion algorithm is the well-known jalaali-js (Borkowski) algorithm,
 * ported here to avoid adding a runtime dependency.
 */

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
  2192, 2262, 2324, 2394, 2456, 3178,
];

const div = (a, b) => Math.trunc(a / b);
const mod = (a, b) => a - Math.trunc(a / b) * b;

function jalCal(jy, withoutLeap) {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;

  if (jy < jp || jy >= BREAKS[bl - 1]) {
    throw new Error(`Invalid Jalali year ${jy}`);
  }

  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  let leap = 0;
  if (!withoutLeap) {
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
  }

  return { leap, gy, march };
}

/** Gregorian date -> Julian Day Number. */
export function gregorianToJdn(gy, gm, gd) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/** Julian Day Number -> Gregorian date. */
export function jdnToGregorian(jdn) {
  let j = 4 * jdn + 139361631;
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function jalaliToJdn(jy, jm, jd) {
  const r = jalCal(jy, true);
  return (
    gregorianToJdn(r.gy, 3, r.march) +
    (jm - 1) * 31 -
    div(jm, 7) * (jm - 7) +
    jd -
    1
  );
}

/** Jalali date -> Gregorian date. */
export function jalaliToGregorian(jy, jm, jd) {
  return jdnToGregorian(jalaliToJdn(jy, jm, jd));
}

/** Gregorian date -> Jalali date. */
export function toJalali(gy, gm, gd) {
  const jdn = gregorianToJdn(gy, gm, gd);
  const gregorianYear = jdnToGregorian(jdn).gy;
  let jy = gregorianYear - 621;
  const r = jalCal(jy, false);
  const jdn1f = jalaliToJdn(jy, 1, 1);
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }

  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export function isJalaliLeapYear(jy) {
  return jalCal(jy, false).leap === 0;
}

const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export function jalaliMonthName(jm) {
  return JALALI_MONTHS[jm - 1] ?? '';
}

const tehranFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Break a Date into Iran-local Gregorian + Jalali components.
 * @param {Date} date
 */
export function tehranParts(date) {
  const parts = Object.fromEntries(
    tehranFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  const gy = Number(parts.year);
  const gm = Number(parts.month);
  const gd = Number(parts.day);
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const { jy, jm, jd } = toJalali(gy, gm, gd);

  return {
    gy,
    gm,
    gd,
    hour,
    minute,
    second,
    jy,
    jm,
    jd,
    date: `${gy}-${pad2(gm)}-${pad2(gd)}`,
    time: `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`,
    jalali: `${jy}-${pad2(jm)}-${pad2(jd)}`,
  };
}

/** ISO-8601 UTC timestamp (always with milliseconds and Z). */
export function toIsoUtc(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${input}`);
  }
  return date.toISOString();
}

/** `1405-07-29` + `16:10:45` from an ISO timestamp. */
export function jalaliStamp(input) {
  const parts = tehranParts(input instanceof Date ? input : new Date(input));
  return { jalali: parts.jalali, time: parts.time };
}

/** `۱۴۰۵/۰۷/۲۹` (Persian digits, slash separated). */
export function jalaliDisplay(jalali) {
  return toPersianDigits(jalali.replaceAll('-', '/'));
}

export function toPersianDigits(value) {
  return String(value).replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
}

/**
 * Parse `1405-07-29` + `16:10:45` (Iran time) into a UTC ISO string.
 * Used by the validator to prove that the Jalali/Tehran fields match UTC.
 */
export function jalaliTehranToIso(jalali, time) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(jalali).trim());
  const timeMatch = /^(\d{2}):(\d{2}):(\d{2})$/.exec(String(time).trim());
  if (!dateMatch || !timeMatch) {
    throw new Error(`Invalid Jalali date/time: ${jalali} ${time}`);
  }

  const [, jy, jm, jd] = dateMatch.map(Number);
  const [, hour, minute, second] = timeMatch.map(Number);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error(`Invalid time: ${time}`);
  }

  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  // Iran has used a fixed UTC+03:30 offset with no DST since 2022.
  const candidate = new Date(
    Date.UTC(gy, gm - 1, gd, hour, minute, second) - 3.5 * 60 * 60 * 1000,
  );

  // Verify with the timezone database (guards against DST-era edge cases).
  const check = tehranParts(candidate);
  if (
    check.jalali !== jalali ||
    check.time !== time
  ) {
    throw new Error(
      `Jalali/Tehran round-trip mismatch for ${jalali} ${time} -> ${check.jalali} ${check.time}`,
    );
  }

  return toIsoUtc(candidate);
}
