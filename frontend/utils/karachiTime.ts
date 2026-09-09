/**
 * karachiTime.ts – angry little helpers that pin the UI to Pakistan Standard
 * Time (Asia/Karachi, UTC+5, no DST) no matter what timezone the device is in.
 */

export interface KarachiParts {
  year: number;
  month: number;          // 0-11
  day: number;
  weekday: number;        // 0 = Sunday
  hour24: number;
  hour12: number;
  minute: number;
  second: number;
  ampm: 'AM' | 'PM';
}

const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Wall-clock parts of `date` expressed in Karachi time. */
export function karachiParts(date: Date = new Date()): KarachiParts {
  const pk = new Date(date.getTime() + KARACHI_OFFSET_MS);
  const h24 = pk.getUTCHours();
  return {
    year:    pk.getUTCFullYear(),
    month:   pk.getUTCMonth(),
    day:     pk.getUTCDate(),
    weekday: pk.getUTCDay(),
    hour24:  h24,
    hour12:  h24 % 12 || 12,
    minute:  pk.getUTCMinutes(),
    second:  pk.getUTCSeconds(),
    ampm:    h24 < 12 ? 'AM' : 'PM',
  };
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export const KARACHI_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const KARACHI_DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Live 12-hour clock, e.g. "09:07:42 PM". */
export function formatKarachiClock(parts: KarachiParts, withSeconds = true): string {
  const base = `${pad2(parts.hour12)}:${pad2(parts.minute)}${withSeconds ? ':' + pad2(parts.second) : ''}`;
  return `${base} ${parts.ampm}`;
}

/** Today in Karachi as YYYY-MM-DD. */
export function karachiDateStr(parts: KarachiParts = karachiParts()): string {
  return `${parts.year}-${pad2(parts.month + 1)}-${pad2(parts.day)}`;
}

/** Compact label, e.g. "09 Sep 2026". */
export function karachiDateLabel(parts: KarachiParts = karachiParts()): string {
  return `${pad2(parts.day)} ${KARACHI_MONTHS[parts.month]} ${parts.year}`;
}