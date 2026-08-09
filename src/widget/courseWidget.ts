import type { CourseTableData } from '../types';
import { inWeek } from '../api/parsers';
import { updateCourseWidget } from '../../modules/course-widget';

const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export function buildCourseWidgetPayload(table: CourseTableData): {
  header: string;
  rows: string[];
} {
  const currentWeek = Math.max(1, table.currentWeek || 1);
  const rows = WEEK_LABELS.map((_, index) => {
    const day = index + 1;
    const lessons = table.lessons
      .filter((l) => l.dayOfWeek === day && inWeek(l.weekText, currentWeek))
      .sort((a, b) => (a.startUnit ?? 0) - (b.startUnit ?? 0));
    if (lessons.length === 0) return '无课';
    return lessons
      .map((l) => {
        const unit = l.startUnit && l.endUnit ? `${l.startUnit}-${l.endUnit}节` : '';
        return unit ? `${l.nameZh} ${unit}` : l.nameZh;
      })
      .join('  ');
  });
  return { header: `第${currentWeek}周 · 本周课表`, rows };
}

export function refreshCourseWidget(table: CourseTableData): Promise<void> {
  return updateCourseWidget(buildCourseWidgetPayload(table));
}
