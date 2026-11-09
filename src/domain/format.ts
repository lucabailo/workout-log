/** "1:05:09" for long durations, "12:04" for short ones. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "1 h 5 min" or "42 min" between two ISO timestamps. */
export function formatDuration(startIso: string, endIso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Weights without useless decimals: 60, 62.5, 1,250. */
export function formatKg(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Parses what the user typed in a number field; commas are accepted as decimal separators. */
export function parseNumber(text: string): number {
  const value = Number(text.replace(',', '.').trim());
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/** "6–8" for a range, "8" for a fixed number of reps. */
export function formatReps(min: number, max: number): string {
  return max > min ? `${min}–${max}` : `${min}`;
}

/** Reads "8", "6-8" or "6–8". Returns null when it is not a valid rep count. */
export function parseReps(text: string): { min: number; max: number } | null {
  const m = text.trim().match(/^(\d+)\s*(?:[-–]\s*(\d+))?$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  if (a < 1) return null;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/** "2:30" or "45 s" for a rest time in seconds. */
export function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Reads "2:30", "150" (seconds) or "2" (minutes when ≤ 10). Returns null if invalid. */
export function parseRest(text: string): number | null {
  const t = text.trim();
  const mmss = t.match(/^(\d+):(\d{1,2})$/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    return n <= 10 ? n * 60 : n;
  }
  return null;
}

/** "52 h" or "45 min" for a total training time. */
export function formatHours(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}

/** "6.2 t" for big volumes, "850 kg" for small ones. */
export function formatTonnes(kg: number): string {
  return kg >= 1000 ? `${formatKg(kg / 1000)} t` : `${formatKg(kg)} kg`;
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "14/03/1999" → "1999-03-14", or null if it is not a real date or is in the future. */
export function parseDate(text: string, now: Date = new Date()): string | null {
  const m = text.trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getMonth() !== mo - 1 || y < 1900 || date > now) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "14/03/1999" from "1999-03-14". */
export function formatDate(isoDay: string): string {
  const [y, m, d] = isoDay.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** "today", "yesterday", "Tue" within the last week, otherwise "6 Nov". */
export function formatRelativeDay(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days > 1 && days < 7) return date.toLocaleDateString('en-GB', { weekday: 'short' });
  return formatShortDate(iso);
}

/**
 * Formats what the user is typing in a date field as DD/MM/YYYY: only digits are kept and the
 * slashes are added automatically. A slash appears only once the next digit is typed, so
 * deleting with backspace never gets stuck on a slash.
 */
export function formatDateInput(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
