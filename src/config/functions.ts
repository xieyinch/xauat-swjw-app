import type { MenuCategory, MenuFunction } from '../types';

/** 每个功能项在「全部」页展示的图标与颜色 */
export interface FunctionMeta {
  icon: string;
  color: string;
}

const ICONS: Record<string, FunctionMeta> = {
  'for-std-room-free:menu': { icon: 'business-outline', color: '#0EA5E9' },
  'for-std-lesson-search:menu': { icon: 'search-outline', color: '#6366F1' },
  'for-std-common-file:menu': { icon: 'download-outline', color: '#F59E0B' },
  'for-std-department-contact:menu': { icon: 'call-outline', color: '#10B981' },
  'for-std-student-info:menu': { icon: 'person-circle-outline', color: '#0A66C2' },
  'for-std-info-check-apply:menu': { icon: 'checkmark-done-circle-outline', color: '#12B76A' },
  'for-std-std-alteration-apply:menu': { icon: 'swap-horizontal-outline', color: '#F97316' },
  'for-std-major-diversion-apply:menu': { icon: 'git-branch-outline', color: '#8B5CF6' },
  'for-std-change-major-apply:menu': { icon: 'sync-outline', color: '#EF4444' },
  'for-std-minor-apply:menu': { icon: 'layers-outline', color: '#06B6D4' },
  'for-std-degree-apply:menu': { icon: 'ribbon-outline', color: '#EAB308' },
  'for-std-program:menu': { icon: 'reader-outline', color: '#0A66C2' },
  'for-std-program-completion-preview:menu': { icon: 'bar-chart-outline', color: '#12B76A' },
  'for-std-course-substitute-apply:menu': { icon: 'repeat-outline', color: '#8B5CF6' },
  'for-std-course-select:menu': { icon: 'cart-outline', color: '#EF4444' },
  'for-std-course-table:menu': { icon: 'calendar-outline', color: '#0A66C2' },
  'for-std-course-select-apply:menu': { icon: 'create-outline', color: '#F59E0B' },
  'for-std-exempt-study-apply:menu': { icon: 'shield-checkmark-outline', color: '#10B981' },
  'for-std-adminclass-course-table:menu': { icon: 'people-outline', color: '#6366F1' },
  'for-std-exam-delay-apply:menu': { icon: 'hourglass-outline', color: '#F97316' },
  'for-std-exam-arrange:menu': { icon: 'time-outline', color: '#0A66C2' },
  'for-std-other-exam-signup:menu': { icon: 'medal-outline', color: '#EAB308' },
  'for-std-grade-sheet:menu': { icon: 'school-outline', color: '#12B76A' },
  'for-std-grade-abandon-apply:menu': { icon: 'trash-outline', color: '#EF4444' },
  'for-std-precaution:menu': { icon: 'warning-outline', color: '#F59E0B' },
  'for-std-std-tutor-apply:menu': { icon: 'person-add-outline', color: '#8B5CF6' },
  'for-std-std-tutor-ware:menu': { icon: 'people-outline', color: '#06B6D4' },
  'for-std-std-tutor-select-result:menu': { icon: 'search-circle-outline', color: '#12B76A' },
  'for-std-evaluation-index-result:menu': { icon: 'star-outline', color: '#F59E0B' },
  'for-std-tutor-change-apply:menu': { icon: 'git-compare-outline', color: '#F97316' },
  'for-std-my-evaluation-result:menu': { icon: 'stats-chart-outline', color: '#6366F1' },
  'for-std-guidance-record:menu': { icon: 'chatbubbles-outline', color: '#0EA5E9' },
  'for-std-evaluation-timely:menu': { icon: 'flash-outline', color: '#F59E0B' },
  'for-std-evaluation:menu': { icon: 'clipboard-outline', color: '#0A66C2' },
  'for-std-std-vote:menu': { icon: 'thumbs-up-outline', color: '#12B76A' },
  'for-std-teaching-feedback:menu': { icon: 'chatbox-ellipses-outline', color: '#8B5CF6' },
  'for-std-thesis-selection:menu': { icon: 'document-attach-outline', color: '#06B6D4' },
  'for-std-thesis-flow:menu': { icon: 'document-text-outline', color: '#0A66C2' },
};

const DEFAULT_META: FunctionMeta = { icon: 'apps-outline', color: '#8A919F' };

export function metaFor(fn: MenuFunction): FunctionMeta {
  const key = fn.permCode ?? '';
  return ICONS[key] ?? DEFAULT_META;
}

/** 分类兜底图标（用于没有子功能图标时展示） */
export function categoryMeta(title: string): FunctionMeta {
  const map: Record<string, FunctionMeta> = {
    学籍: { icon: 'person-circle-outline', color: '#0A66C2' },
    培养方案: { icon: 'reader-outline', color: '#0A66C2' },
    课程与教材: { icon: 'book-outline', color: '#0A66C2' },
    考试: { icon: 'time-outline', color: '#0EA5E9' },
    成绩: { icon: 'school-outline', color: '#12B76A' },
    导师: { icon: 'people-outline', color: '#8B5CF6' },
    评教: { icon: 'clipboard-outline', color: '#F59E0B' },
    教学信息反馈: { icon: 'chatbox-ellipses-outline', color: '#8B5CF6' },
    毕业论文: { icon: 'document-text-outline', color: '#06B6D4' },
    公共服务: { icon: 'grid-outline', color: '#6366F1' },
  };
  for (const [k, v] of Object.entries(map)) {
    if (title.includes(k)) return v;
  }
  return { icon: 'albums-outline', color: '#8A919F' };
}

/** 网络获取菜单失败时的离线兜底（与线上菜单保持一致） */
export const FALLBACK_MENU: MenuCategory[] = [
  {
    id: '02',
    title: '公共服务与查询',
    functions: [
      { id: '02.03', parentId: '02', title: '空闲教室查询', href: '/student/for-std/room-free', permCode: 'for-std-room-free:menu' },
      { id: '02.04', parentId: '02', title: '全校开课查询', href: '/student/for-std/lesson-search', permCode: 'for-std-lesson-search:menu' },
      { id: '02.20', parentId: '02', title: '常用文件下载', href: '/student/for-std/common-file', permCode: 'for-std-common-file:menu' },
      { id: '02.27', parentId: '02', title: '学院联系方式', href: '/student/for-std/department-contact', permCode: 'for-std-department-contact:menu' },
    ],
  },
  {
    id: '10',
    title: '学籍',
    functions: [
      { id: '10.01', parentId: '10', title: '学籍信息', href: '/student/for-std/student-info', permCode: 'for-std-student-info:menu' },
      { id: '10.03', parentId: '10', title: '学生信息核对', href: '/student/for-std/std-info-check-apply', permCode: 'for-std-info-check-apply:menu' },
      { id: '10.07', parentId: '10', title: '学籍异动申请', href: '/student/for-std/std-alteration-apply', permCode: 'for-std-std-alteration-apply:menu' },
      { id: '10.09', parentId: '10', title: '大类分流申请', href: '/student/for-std/major-diversion-apply', permCode: 'for-std-major-diversion-apply:menu' },
      { id: '10.11', parentId: '10', title: '转专业申请', href: '/student/for-std/change-major-apply', permCode: 'for-std-change-major-apply:menu' },
      { id: '10.13', parentId: '10', title: '辅修/微专业申请', href: '/student/for-std/minor-apply', permCode: 'for-std-minor-apply:menu' },
      { id: '10.14', parentId: '10', title: '授予学士学位申请', href: '/student/for-std/degree-apply', permCode: 'for-std-degree-apply:menu' },
    ],
  },
  {
    id: '12',
    title: '培养方案',
    functions: [
      { id: '12.01', parentId: '12', title: '我的培养方案', href: '/student/for-std/program', permCode: 'for-std-program:menu' },
      { id: '12.03', parentId: '12', title: '培养方案完成情况', href: '/student/for-std/program-completion-preview', permCode: 'for-std-program-completion-preview:menu' },
      { id: '12.05', parentId: '12', title: '课程替代申请', href: '/student/for-std/course-substitute-apply', permCode: 'for-std-course-substitute-apply:menu' },
    ],
  },
  {
    id: '14',
    title: '课程与教材',
    functions: [
      { id: '14.01', parentId: '14', title: '选课', href: '/student/for-std/course-select', permCode: 'for-std-course-select:menu' },
      { id: '14.03', parentId: '14', title: '我的课表', href: '/student/for-std/course-table', permCode: 'for-std-course-table:menu' },
      { id: '14.05', parentId: '14', title: '个性化选课申请', href: '/student/for-std/course-select-apply', permCode: 'for-std-course-select-apply:menu' },
      { id: '14.09', parentId: '14', title: '免修申请', href: '/student/for-std/exempt-study-apply', permCode: 'for-std-exempt-study-apply:menu' },
      { id: '14.11', parentId: '14', title: '我的班级课表', href: '/student/for-std/adminclass-course-table', permCode: 'for-std-adminclass-course-table:menu' },
    ],
  },
  {
    id: '22',
    title: '考试',
    functions: [
      { id: '22.01', parentId: '22', title: '缓考申请', href: '/student/for-std/exam-delay-apply', permCode: 'for-std-exam-delay-apply:menu' },
      { id: '22.03', parentId: '22', title: '考试信息', href: '/student/for-std/exam-arrange', permCode: 'for-std-exam-arrange:menu' },
      { id: '22.15', parentId: '22', title: '等级考试', href: '/student/for-std/other-exam-signup', permCode: 'for-std-other-exam-signup:menu' },
    ],
  },
  {
    id: '24',
    title: '成绩',
    functions: [
      { id: '24.01', parentId: '24', title: '成绩信息', href: '/student/for-std/grade/sheet', permCode: 'for-std-grade-sheet:menu' },
      { id: '24.03', parentId: '24', title: '放弃成绩申请', href: '/student/for-std/grade-abandon-apply', permCode: 'for-std-grade-abandon-apply:menu' },
      { id: '24.07', parentId: '24', title: '学业预警', href: '/student/for-std/precaution', permCode: 'for-std-precaution:menu' },
    ],
  },
  {
    id: '33',
    title: '导师',
    functions: [
      { id: '33.01', parentId: '33', title: '选择意向导师', href: '/student/for-std/select/std-tutor-apply', permCode: 'for-std-std-tutor-apply:menu' },
      { id: '33.02', parentId: '33', title: '我的导师', href: '/student/for-std/select/std-tutor-ware', permCode: 'for-std-std-tutor-ware:menu' },
      { id: '33.03', parentId: '33', title: '导师互选结果查询', href: '/student/for-std/select/std-tutor-select-result', permCode: 'for-std-std-tutor-select-result:menu' },
      { id: '33.04', parentId: '33', title: '评价导师', href: '/student/for-std/evaluation-index-result', permCode: 'for-std-evaluation-index-result:menu' },
      { id: '33.05', parentId: '33', title: '导师变更申请', href: '/student/for-std/tutor-change-apply', permCode: 'for-std-tutor-change-apply:menu' },
      { id: '33.06', parentId: '33', title: '我的被评结果', href: '/student/for-std/my-evaluation-result', permCode: 'for-std-my-evaluation-result:menu' },
      { id: '33.07', parentId: '33', title: '指导过程查看', href: '/student/for-std/guidance-record', permCode: 'for-std-guidance-record:menu' },
    ],
  },
  {
    id: '35',
    title: '评教',
    functions: [
      { id: '35.02', parentId: '35', title: '学生即时性评价', href: '/student/for-std/evaluation/timely', permCode: 'for-std-evaluation-timely:menu' },
      { id: '35.03', parentId: '35', title: '学生总结性评教', href: '/student/for-std/evaluation/summative', permCode: 'for-std-evaluation:menu' },
      { id: '35.04', parentId: '35', title: '学生投票', href: '/student/for-std/std-vote', permCode: 'for-std-std-vote:menu' },
    ],
  },
  {
    id: '38',
    title: '教学信息反馈',
    functions: [
      { id: '38.01', parentId: '38', title: '教学信息反馈', href: '/student/for-std/teaching-feedback', permCode: 'for-std-teaching-feedback:menu' },
    ],
  },
  {
    id: '39',
    title: '毕业论文(设计)',
    functions: [
      { id: '39.03', parentId: '39', title: '毕业论文(设计)选题', href: '/student/for-std/thesis-selection', permCode: 'for-std-thesis-selection:menu' },
      { id: '39.05', parentId: '39', title: '毕业论文(设计)', href: '/student/for-std/thesis-flow', permCode: 'for-std-thesis-flow:menu' },
    ],
  },
];
