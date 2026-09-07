import type { Semester } from '../types';

/** School calendar always uses China time, independent of the device timezone. */
export function schoolDateKey(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}

function calendarDate(value?: string): string | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[T\s])/);
  if (!m) return null;
  const key = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const d = new Date(`${key}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === key ? key : null;
}

/** Exact school dates win. Month boundaries are a fallback, not a claimed school calendar. */
export function resolveCurrentSemester(semesters: Semester[], now = new Date()): Semester | null {
  const today = schoolDateKey(now);
  const candidates = semesters.map(semester => ({ semester, start: calendarDate(semester.startDate), end: calendarDate(semester.endDate) }));
  const active = candidates.filter(s => s.start && s.end && s.start <= today && today <= s.end)
    .sort((a, b) => b.start!.localeCompare(a.start!) || a.semester.id - b.semester.id);
  if (active.length) return active[0].semester;

  const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
  const firstYear = month >= 9 ? year : year - 1;
  const term = month >= 9 || month === 1 ? 1 : 2;
  const match = candidates.filter(({ semester }) => {
    const label = semester.nameZh.replace(/[\s学年学期]/g, '').replace(/[—–－~～/]/g, '-');
    return label === `${firstYear}-${firstYear + 1}-${term}`;
  }).sort((a, b) => a.semester.id - b.semester.id);
  if (match.length && (!match[0].start || match[0].start <= today)) return match[0].semester;

  // Between dated terms (holidays), retain the latest term that has actually started.
  const dated = candidates.filter(s => s.start && s.end && s.start <= s.end && s.start <= today)
    .sort((a, b) => b.start!.localeCompare(a.start!) || a.semester.id - b.semester.id);
  return dated[0]?.semester ?? null;
}
