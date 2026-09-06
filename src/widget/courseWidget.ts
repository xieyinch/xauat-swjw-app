import type { CourseTableData } from '../types';
import { fetchBestCourseTable } from '../api/data';
import { inWeek } from '../api/parsers';
import { updateCourseWidget, type CourseWidgetPayload, type WidgetCourseSlot } from '../../modules/course-widget';

const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function dayOfWeek(d: Date): number {
  const g = d.getDay();
  return g === 0 ? 7 : g;
}

function fmtDate(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

const SLOT_COUNT = 3;

function dayCourses(table: CourseTableData, day: number): { count: number; slots: WidgetCourseSlot[] } {
  const week = Math.max(1, table.currentWeek || 1);
  const lessons = table.lessons
    .filter((l) => l.dayOfWeek === day && inWeek(l.weekText, week))
    .sort((a, b) => (a.startUnit ?? 99) - (b.startUnit ?? 99));
  if (!lessons.length) return { count: 0, slots: [] };
  const slots: WidgetCourseSlot[] = lessons.slice(0, SLOT_COUNT).map((l) => {
    const tag =
      l.startUnit && l.endUnit && l.endUnit !== l.startUnit
        ? `${l.startUnit}-${l.endUnit}节`
        : l.startUnit
          ? `第${l.startUnit}节`
          : '';
    return { head: tag ? `${tag} ${l.nameZh}` : l.nameZh, sub: l.placeText || l.timeText || '' };
  });
  if (lessons.length > SLOT_COUNT) {
    slots[SLOT_COUNT - 1] = { head: `等共 ${lessons.length} 门课`, sub: slots[SLOT_COUNT - 1].sub };
  }
  return { count: lessons.length, slots };
}

export function buildCourseWidgetPayload(table: CourseTableData): CourseWidgetPayload {
  const week = Math.max(1, table.currentWeek || 1);
  const now = new Date();
  const today = dayOfWeek(now);
  const tomorrowDate = new Date(now.getTime() + 24 * 3600 * 1000);
  const tomorrow = dayOfWeek(tomorrowDate);
  const left = dayCourses(table, today);
  const right = dayCourses(table, tomorrow);
  const header = `${fmtDate(now)} · ${WEEK_LABELS[today - 1]}`;
  const parts = [`第${week}周`];
  parts.push(`今 ${left.count > 0 ? `${left.count} 门` : '无课'}`);
  parts.push(`明 ${right.count > 0 ? `${right.count} 门` : '无课'}`);
  return {
    header,
    sub: parts.join(' · '),
    leftTitle: `今天 · ${WEEK_LABELS[today - 1]}`,
    rightTitle: `明天 · ${WEEK_LABELS[tomorrow - 1]}`,
    left: left.slots,
    right: right.slots,
  };
}

export function refreshCourseWidget(table: CourseTableData): Promise<void> {
  return updateCourseWidget(buildCourseWidgetPayload(table));
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
