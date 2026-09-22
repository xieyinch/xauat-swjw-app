import type { CourseTableData } from '../types';
import { fetchBestCourseTable, fetchCourseUnitTimes } from '../api/data';
import { inWeek } from '../api/parsers';
import { updateCourseWidget, type CourseWidgetPayload, type WidgetCourseSlot, type WidgetDay } from '../../modules/course-widget';

const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function dayOfWeek(d: Date): number {
  const g = d.getDay();
  return g === 0 ? 7 : g;
}

function fmtDate(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

const SLOT_COUNT = 3;

type UnitTimes = Record<number, { start: string; end: string }>;

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayCourses(table: CourseTableData, date: Date, week: number, times: UnitTimes): WidgetCourseSlot[] {
  const day = dayOfWeek(date);
  const lessons = table.lessons
    .filter((l) => l.dayOfWeek === day && inWeek(l.weekText, week))
    .sort((a, b) => (a.startUnit ?? 99) - (b.startUnit ?? 99));
  return lessons.map((l) => {
    const tag =
      l.startUnit && l.endUnit && l.endUnit !== l.startUnit
        ? `${l.startUnit}-${l.endUnit}节`
        : l.startUnit
          ? `第${l.startUnit}节`
          : '';
    const endTime = times[l.endUnit ?? l.startUnit ?? 0]?.end;
    const match = endTime?.match(/^(\d{2}):(\d{2})$/);
    const endAt = match
      ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(match[1]), Number(match[2])).getTime()
      : undefined;
    return { head: tag ? `${tag} ${l.nameZh}` : l.nameZh, sub: l.placeText || l.timeText || '', endAt };
  });
}

export function buildCourseWidgetPayload(table: CourseTableData, times: UnitTimes = {}, now = new Date()): CourseWidgetPayload {
  const week = Math.max(1, table.currentWeek || 1);
  const today = dayOfWeek(now);
  const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrow = dayOfWeek(tomorrowDate);
  const days: WidgetDay[] = Array.from({ length: 8 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dayWeek = week + Math.floor((today - 1 + offset) / 7);
    return { date: dateKey(date), week: dayWeek, slots: dayCourses(table, date, dayWeek, times) };
  });
  const left = days[0].slots.filter((slot) => !slot.endAt || slot.endAt > now.getTime());
  const right = days[1].slots;
  const header = `${fmtDate(now)} · ${WEEK_LABELS[today - 1]}`;
  const parts = [`第${week}周`];
  parts.push(`今 ${left.length > 0 ? `${left.length} 门` : '无课'}`);
  parts.push(`明 ${right.length > 0 ? `${right.length} 门` : '无课'}`);
  return {
    header,
    sub: parts.join(' · '),
    leftTitle: `今天 · ${WEEK_LABELS[today - 1]}`,
    rightTitle: `明天 · ${WEEK_LABELS[tomorrow - 1]}`,
    left: left.slice(0, SLOT_COUNT),
    right: right.slice(0, SLOT_COUNT),
    days,
  };
}

export async function refreshCourseWidget(table: CourseTableData): Promise<void> {
  const times = await fetchCourseUnitTimes(table.semesterId).catch(() => ({}));
  return updateCourseWidget(buildCourseWidgetPayload(table, times));
}

let lastAuto = 0;

/** 拉取「最新有课学期」的课表并自动更新桌面组件；带节流，静默失败 */
export async function autoRefreshCourseWidget(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastAuto < 10 * 60 * 1000) return;
  lastAuto = now;
  try {
    const best = await fetchBestCourseTable();
    if (best) await refreshCourseWidget(best.table);
  } catch {
    lastAuto = 0;
  }
}
