import type {
  CourseLesson,
  CourseTableData,
  ExamItem,
  GradeData,
  MenuCategory,
  MenuFunction,
  NoticeItem,
  Semester,
} from '../types';

const WEEK_CN: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 7,
  天: 7,
};

const UNIT_CN: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function cnNumberToInt(s: string): number {
  if (!s) return 0;
  if (s === '十') return 10;
  if (s.startsWith('十')) return 10 + (UNIT_CN[s[1]] ?? 0);
  if (s.endsWith('十')) return (UNIT_CN[s[0]] ?? 1) * 10;
  let sum = 0;
  for (const ch of s) {
    if (ch === '十') {
      sum = sum === 0 ? 10 : sum * 10;
    } else {
      sum += UNIT_CN[ch] ?? 0;
    }
  }
  return sum;
}

export function stripHtmlSafe(html: string): string {
  return stripHtml(html);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstNonEmpty(...parts: (string | null | undefined)[]): string {
  for (const p of parts) {
    if (p && p.trim()) return p.trim();
  }
  return '';
}

const WEEK_RE = /([0-9~\-－～,，、;；()（）\u5355\u53cc]+周)/;
const DAY_RE = /(?:星期|周)([一二三四五六日天])/;

/** 解析「第7-8节」「第七节~第八节」「1-2节」「第3节」等节次写法 */
function parseUnitRange(text: string): { startUnit?: number; endUnit?: number } {
  const toInt = (s?: string): number | undefined =>
    s == null || s === ''
      ? undefined
      : /[一二三四五六七八九十]/.test(s)
        ? cnNumberToInt(s)
        : Number(s);
  const m =
    text.match(/(?:第)?([0-9一二三四五六七八九十]+)(?:节)?(?:[-~～至])(?:第)?([0-9一二三四五六七八九十]+)节/) ||
    text.match(/(?:第)?([0-9一二三四五六七八九十]+)节/);
  if (!m) return {};
  const start = toInt(m[1]);
  const end = toInt(m[2]) ?? start;
  return { startUnit: start, endUnit: end };
}

/** 从多个候选字段中挑出「像课程名」的值：跳过班级合并名（含分号）、纯编号、无汉字文本 */
function pickCourseName(...cands: (string | undefined | null)[]): string {
  for (const c of cands) {
    const s = (c ?? '').trim();
    if (!s) continue;
    if (/[;；]/.test(s)) continue;
    if (/^\d/.test(s)) continue;
    if (!/[\u4e00-\u9fa5]/.test(s)) continue;
    return s;
  }
  for (const c of cands) {
    const s = (c ?? '').trim();
    if (s) return s;
  }
  return '';
}

/** 清理地点文本中残留的时间片段，避免「周二 第7-8节 1-16周」混入地点 */
function cleanPlaceText(text: string): string {
  return text
    .replace(WEEK_RE, '')
    .replace(
      /(?:第)?[0-9一二三四五六七八九十]+节?(?:[-~～至])(?:第)?[0-9一二三四五六七八九十]+节|(?:第)?[0-9一二三四五六七八九十]+节/g,
      '',
    )
    .replace(DAY_RE, '')
    .replace(/[;；]\s*$/, '')
    .trim();
}

/** 从「时间 地点 老师」段中剥离时间和地点，提取教师名 */
function extractTeacher(personText: string, timeText: string, placeSeg: string): string {
  let t = personText;
  if (timeText) t = t.replace(timeText, '');
  const place = cleanPlaceText(placeSeg);
  if (place) t = t.replace(place, '');
  return t.replace(/[;；\s]+/g, ' ').trim();
}

export function parseCourseTableJson(raw: string): CourseTableData {
  const d = JSON.parse(raw);
  if (d.error) throw new Error(d.message || '课表数据异常');
  const lessons: CourseLesson[] = [];
  for (const lesson of (d.lessons ?? []) as Array<Record<string, unknown>>) {
    const st = (lesson.scheduleText ?? {}) as Record<string, { textZh?: string } | undefined>;
    const timeFull = firstNonEmpty(st.dateTimeText?.textZh);
    const placeFull = firstNonEmpty(st.dateTimePlaceText?.textZh);
    const personFull = firstNonEmpty(st.dateTimePlacePersonText?.textZh);
    // 一条记录可能含多个时间段（如「周二 第1-2节;周五 第9-10节」），按分号/换行拆分
    const splitSegs = (s: string) =>
      s
        .split(/[;；\n]/)
        .map((x) => x.trim())
        .filter(Boolean);
    const timeSegs = splitSegs(timeFull);
    const placeSegs = splitSegs(placeFull);
    const personSegs = splitSegs(personFull);
    // dateTimePlaceText 是逐段细分的（同周次不同教室会拆开），优先以其段数为主遍历
    const segSource = placeSegs.length ? placeSegs : timeSegs.length ? timeSegs : [''];

    const nameZh = pickCourseName(
      (lesson.course as { nameZh?: string } | undefined)?.nameZh,
      lesson.lessonNameZh as string,
      lesson.nameZh as string,
      lesson.name as string,
      lesson.courseName as string,
    );
    const code = firstNonEmpty(
      (lesson.course as { code?: string } | undefined)?.code,
      lesson.code as string,
    );

    segSource.forEach((seg, idx) => {
      const placeRaw = cleanPlaceText(seg);
      const placeText = placeRaw.replace(/\S{2,4}校区/g, '').trim();
      const timeText = (placeRaw ? seg.replace(placeRaw, '') : seg)
        .replace(/[;；\s]+/g, ' ')
        .trim();
      const teacher = extractTeacher(personSegs[idx] ?? '', timeText, seg);
      const weekMatch = timeText.match(WEEK_RE);
      const dayMatch = timeText.match(DAY_RE);
      const unit = parseUnitRange(timeText);
      lessons.push({
        id: lesson.id as number,
        nameZh,
        code,
        scheduleText: timeText,
        timeText,
        placeText,
        teacher,
        weekText: weekMatch ? weekMatch[1] : '',
        dayOfWeek: dayMatch ? WEEK_CN[dayMatch[1]] : undefined,
        startUnit: unit.startUnit,
        endUnit: unit.endUnit,
      });
    });
  }
  return {
    semesterId: d.semesterId as number,
    totalWeeks: Math.max(1, Array.isArray(d.weekIndices) ? d.weekIndices.length : Number(d.totalWeeks ?? 1) || 1),
    currentWeek: Number(d.currentWeek ?? 1),
    lessons,
  };
}

export function parseGradeJson(raw: string, semesterId: number): GradeData {
  const d = JSON.parse(raw);
  const semesterName =
    (d.id2semesters && d.id2semesters[semesterId]?.nameZh) ||
    (Array.isArray(d.semesters) && d.semesters.find((s: Semester) => s.id === semesterId)?.nameZh) ||
    '';
  const map = d.semesterId2studentGrades ?? {};
  const list = map[semesterId] ?? [];
  const items = list.map((g: Record<string, unknown>) => {
    const course = (g.course ?? {}) as { nameZh?: string; code?: string; credits?: number };
    const courseName =
      course.nameZh || (g.lessonNameZh as string) || '';
    return {
      courseName,
      courseCode: course.code,
      credits: typeof course.credits === 'number' ? course.credits : undefined,
      score: g.gaGrade != null ? String(g.gaGrade) : '未公布',
      gradePoint: typeof g.gp === 'number' ? g.gp : undefined,
      passed: g.passed as boolean,
      published: g.published as boolean,
      courseType: g.courseType as string,
      semesterName,
    };
  });
  return { semesterId, semesterName, items };
}

export function parseExamHtml(html: string): ExamItem[] {
  const items: ExamItem[] = [];
  const trRe = /<tr>([\s\S]*?)<\/tr>/g;
  let trm: RegExpExecArray | null;
  while ((trm = trRe.exec(html))) {
    const tr = trm[1];
    if (!/<td/.test(tr)) continue;
    const tds: string[] = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tdm: RegExpExecArray | null;
    while ((tdm = tdRe.exec(tr))) tds.push(tdm[1]);
    if (tds.length < 5) continue;
    const courseName = stripHtml(tds[0]);
    const dateTime = stripHtml(tds[1]);
    const place = stripHtml(tds[2]);
    const seat = stripHtml(tds[3]);
    const building = stripHtml(tds[4]);
    const campus = stripHtml(tds[5] ?? '');
    if (!courseName) continue;
    items.push({
      courseName,
      dateTime,
      place,
      building,
      campus,
      seatNo: seat || undefined,
    });
  }
  return items;
}

export function parseNoticeHtml(html: string, listUrl: string): NoticeItem[] {
  const items: NoticeItem[] = [];
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/g;
  let m: RegExpExecArray | null;
  while ((m = liRe.exec(html))) {
    const li = m[1];
    const a = li.match(/<a[^>]*href="([^"]*)"[^>]*title="([^"]*)"/) || li.match(/<a[^>]*href="([^"]*)"[^>]*>/);
    if (!a) continue;
    const href = a[1];
    if (!href || !/news|\.jsp|\.htm|\.html/i.test(href)) continue;
    const title = stripHtml(a[2] ?? li);
    const titleM = li.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    const titleText = titleM ? stripHtml(titleM[1]) : title;
    const dateM = li.match(/<span[^>]*>(\d{4}-\d{2}-\d{2})<\/span>/);
    const date = dateM ? dateM[1] : '';
    if (!titleText) continue;
    const url = new URL(href, listUrl).href;
    const idM = url.match(/wbnewsid=(\d+)/);
    items.push({ id: idM ? idM[1] : url, title: titleText, date, href, url });
  }
  return items;
}

/** 解析「/student/home/menu」返回的菜单 JSON，按一级分类分组 */
export function parseMenu(raw: string): MenuCategory[] {
  let arr: Array<Record<string, unknown>>;
  try {
    arr = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const all = arr.map((m, idx) => ({
    id: String(m.id ?? `m${idx}`),
    parentId: String(m.parentId ?? ''),
    title: String(m.title ?? ''),
    href: (m.href as string) || null,
    permCode: (m.permCode as string) || null,
  }));
  const categories: MenuCategory[] = [];
  for (const m of all) {
    if (!m.parentId && !m.href) {
      const functions = all
        .filter((f) => f.parentId === m.id && f.href)
        .map((f) => ({ id: f.id, parentId: f.parentId, title: f.title, href: f.href, permCode: f.permCode }));
      if (functions.length) categories.push({ id: m.id, title: m.title, functions });
    }
  }
  return categories;
}

export function parseSemestersFromCourseTable(html: string): Semester[] {  const m = html.match(/semesters = JSON\.parse\(\s*'([^']+)'\s*\)/);
  if (!m) return [];
  const raw = m[1].replace(/\\"/g, '"');
  let arr: Array<Record<string, unknown>> = [];
  try {
    arr = JSON.parse(raw);
  } catch {
    return [];
  }
  return arr.map((s) => ({
    id: Number(s.id),
    nameZh: String(s.nameZh ?? s.name ?? ''),
    startDate: (s.startDate as string) ?? undefined,
    endDate: (s.endDate as string) ?? undefined,
  }));
}

export function extractStudentId(html: string): number | null {
  const m = html.match(/var studentId\s*=\s*(\d+)/) || html.match(/studentId['"]\s*:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

export function extractStudentNameStdNo(html: string): { name: string; stdNo: string } | null {
  const m = html.match(/<h2[^>]*class="info-title"[^>]*>([\s\S]*?)<\/h2>/);
  if (!m) return null;
  const text = stripHtml(m[1]);
  const m2 = text.match(/([\u4e00-\u9fa5]+)\((\d+)\)/);
  return m2 ? { name: m2[1], stdNo: m2[2] } : null;
}

interface WeekRange {
  from: number;
  to: number;
  odd?: boolean;
  even?: boolean;
}

/** 解析「1-16周」「12~14(双),15周」为周次区间集合 */
export function parseWeekRanges(weekText: string): WeekRange[] {
  const text = (weekText || '').replace(/周/g, '').replace(/[（）]/g, (m) => (m === '（' ? '(' : ')'));
  const segs = text.split(/[,，、;；]/);
  const ranges: WeekRange[] = [];
  for (const seg of segs) {
    const m = seg.trim().match(/^(\d+)(?:[-~—](\d+))?(?:[()]*(\u5355|\u53cc)[()]*)?$/);
    if (!m) continue;
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    const parity = m[3];
    ranges.push({ from, to, odd: parity === '单', even: parity === '双' });
  }
  return ranges;
}

export function inWeek(weekText: string, week: number): boolean {
  return parseWeekRanges(weekText).some(
    (r) => week >= r.from && week <= r.to && (!r.odd || week % 2 === 1) && (!r.even || week % 2 === 0),
  );
}

