import { inWeek } from './parsers';
import { schoolDateKey } from './semester';
import type { CourseTableData, CourseLesson } from '../types';

export function currentTeachingWeek(table: CourseTableData) {
  if (table.semester?.startDate) return weekForDate(table, schoolDateKey());
  return Number.isFinite(table.currentWeek) && table.currentWeek >= 1 ? Math.floor(table.currentWeek) : null;
}
export function weekForDate(table: CourseTableData, date: string): number | null {
  const start = table.semester?.startDate?.slice(0,10);
  if (!start) {
    const today = schoolDateKey();
    const day = new Date(today + 'T00:00:00Z').getUTCDay();
    const offset = table.semester?.weekStartOnSunday ? day : (day+6)%7;
    return table.currentWeek + Math.floor(((Date.parse(date)-Date.parse(today))/86400000 + offset)/7);
  }
  const stamp = Date.parse(start);
  if (!Number.isFinite(stamp)) return null;
  const day = new Date(stamp).getUTCDay();
  const offset = table.semester?.weekStartOnSunday ? day : (day+6)%7;
  const week = Math.floor((Date.parse(date) - stamp + offset*86400000) / (7*86400000)) + 1;
  return week >= 1 && week <= table.totalWeeks ? week : null;
}
export function nextCourseDay(table: CourseTableData, date: string) {
  for (let i=1; i<=35; i++) {
    const key = new Date(Date.parse(date)+i*86400000).toISOString().slice(0,10);
    const week = weekForDate(table,key);
    const day = new Date(key).getUTCDay() || 7;
    const lessons = week ? lessonsForDay(table.lessons,week,day) : [];
    if (lessons.length) return {date:key, week, lessons};
  }
  return null;
}
export function lessonsForDay(lessons: CourseLesson[], week: number, day: number) {
  return lessons.filter(l => l.dayOfWeek === day && inWeek(l.weekText, week))
    .sort((a,b) => (a.startUnit ?? 99) - (b.startUnit ?? 99));
}
export function todaySchedule(table: CourseTableData, date = schoolDateKey()) {
  const day = new Date(date + 'T00:00:00Z').getUTCDay() || 7;
  const week = table.semester?.startDate ? weekForDate(table,date) : currentTeachingWeek(table);
  const unparsed = table.lessons.filter(l => !l.dayOfWeek || !l.weekText || !l.startUnit);
  return { day, week, date, unparsed, lessons: week ? lessonsForDay(table.lessons,week,day) : [] };
}
