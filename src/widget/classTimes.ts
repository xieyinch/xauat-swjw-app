import type { CourseLesson } from '../types';

export type Campus = 'yanta' | 'caotang';
export type UnitTime = { start: string; end: string };

// 两校区上课节次时间表：雁塔校区 5 月至 9 月使用夏季下午时段。
const YANTA_MORNING: Record<number, UnitTime> = {
  1: { start: '08:00', end: '08:50' },
  2: { start: '09:00', end: '09:50' },
  3: { start: '10:10', end: '11:00' },
  4: { start: '11:10', end: '12:00' },
};
const YANTA_WINTER: Record<number, UnitTime> = {
  7: { start: '14:00', end: '14:50' }, 8: { start: '15:00', end: '15:50' },
  9: { start: '16:00', end: '16:50' }, 10: { start: '17:00', end: '17:50' },
  11: { start: '19:30', end: '20:20' }, 12: { start: '20:30', end: '21:20' },
};
const YANTA_SUMMER: Record<number, UnitTime> = {
  7: { start: '14:30', end: '15:20' }, 8: { start: '15:30', end: '16:20' },
  9: { start: '16:30', end: '17:20' }, 10: { start: '17:30', end: '18:20' },
  11: { start: '20:00', end: '20:50' }, 12: { start: '21:00', end: '21:50' },
};
const CAOTANG: Record<number, UnitTime> = {
  1: { start: '08:30', end: '09:15' }, 2: { start: '09:20', end: '10:05' },
  3: { start: '10:25', end: '11:10' }, 4: { start: '11:15', end: '12:00' },
  5: { start: '12:10', end: '12:55' }, 6: { start: '13:00', end: '13:45' },
  7: { start: '14:00', end: '14:45' }, 8: { start: '14:50', end: '15:35' },
  9: { start: '15:45', end: '16:30' }, 10: { start: '16:35', end: '17:20' },
  11: { start: '19:30', end: '20:15' }, 12: { start: '20:20', end: '21:05' },
};

export function campusForLesson(lesson: CourseLesson): Campus | undefined {
  if (lesson.campus) return lesson.campus;
  const text = `${lesson.placeText} ${lesson.scheduleText}`;
  if (/雁塔/.test(text)) return 'yanta';
  if (/草堂/.test(text)) return 'caotang';
  return undefined;
}

export function dominantCampus(lessons: CourseLesson[]): Campus | undefined {
  let yanta = 0;
  let caotang = 0;
  for (const lesson of lessons) {
    const campus = campusForLesson(lesson);
    if (campus === 'yanta') yanta++;
    if (campus === 'caotang') caotang++;
  }
  return yanta > caotang ? 'yanta' : caotang > yanta ? 'caotang' : undefined;
}

export function unitTime(campus: Campus | undefined, unit: number, date: Date): UnitTime | undefined {
  if (campus === 'caotang') return CAOTANG[unit];
  if (campus === 'yanta') {
    const summer = date.getMonth() >= 4 && date.getMonth() <= 8;
    return YANTA_MORNING[unit] ?? (summer ? YANTA_SUMMER : YANTA_WINTER)[unit];
  }
  return undefined;
}
