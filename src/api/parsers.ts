import type {
  CommonFileItem,
  CourseLesson,
  CourseTableData,
  ExamItem,
  GradeData,
  MenuCategory,
  MenuFunction,
  NoticeItem,
  PrecautionItem,
  ProgramCourse,
  ProgramData,
  ProgramModule,
  Semester,
  StudentInfoDetail,
  StudentInfoSection,
  TutorSelectResult,
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

/** 解析常用文件列表 JSON：{ commonFiles: [{ fileInfo: { key, name }, commonFileType: { nameZh }, publishDate }] } */
export function parseCommonFiles(raw: string): CommonFileItem[] {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = Array.isArray(d.commonFiles) ? (d.commonFiles as Array<Record<string, unknown>>) : [];
  return list.map((f) => {
    const fileInfo = (f.fileInfo ?? {}) as Record<string, unknown>;
    const type = (f.commonFileType ?? null) as Record<string, unknown> | null;
    const publishDate = f.publishDate != null ? String(f.publishDate).replace(/T/, ' ').slice(0, 19) : '';
    return {
      name: String(fileInfo.name ?? ''),
      key: String(fileInfo.key ?? ''),
      typeName: type && type.nameZh != null ? String(type.nameZh) : '',
      publishTime: publishDate,
    };
  });
}

/** 将单个学籍信息表格区块解析为 label/value 字段列表 */
function parseInfoBlock(html: string): Array<{ label: string; value: string }> {
  const fields: Array<{ label: string; value: string }> = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html))) {
    const tds: string[] = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tdm: RegExpExecArray | null;
    while ((tdm = tdRe.exec(m[1]))) tds.push(stripHtml(tdm[1]));
    if (!tds.length) continue;
    // 3 组「标签 值 标签 值 标签 值」的 bisection 布局
    if (tds.length >= 6) {
      for (let i = 0; i + 1 < tds.length; i += 2) {
        const label = tds[i];
        const value = tds[i + 1];
        if (label && value) fields.push({ label, value });
      }
    } else if (tds.length >= 2) {
      fields.push({ label: tds[0], value: tds[1] });
    }
  }
  return fields;
}

/** 解析学籍信息页面 HTML：按「基本信息/录取信息/…」区块分组 */
export function parseStudentInfoDetail(html: string): StudentInfoDetail {
  const sections: StudentInfoSection[] = [];
  // 以「<div id="xxx"」为区块起点，每个区块内容截取到下一个区块起点
  const ids = [...html.matchAll(/<div id="([\w-]+)"/g)].map((m) => m.index as number);
  for (let i = 0; i < ids.length; i++) {
    const idM = html.slice(ids[i]).match(/^<div id="([\w-]+)"/);
    if (!idM) continue;
    const key = idM[1];
    const start = ids[i];
    const end = i + 1 < ids.length ? ids[i + 1] : html.length;
    const block = html.slice(start, end);
    const titleM = block.match(/<h4>([\s\S]*?)<\/h4>/);
    if (!titleM) continue;
    const title = stripHtml(titleM[1]);
    // 经历区块是 div 布局而非表格，单独解析
    const expFields = parseExperienceBlock(block);
    if (expFields.length) {
      sections.push({ key, title, fields: expFields });
      continue;
    }
    const table = block.match(/<table[\s\S]*?<\/table>/);
    if (!table) continue;
    const fields = parseInfoBlock(table[0]);
    if (fields.length) sections.push({ key, title, fields });
  }
  return { sections };
}

/** 解析「学习工作经历」等 div 布局区块（时间段/学校/学位/证明人等） */
function parseExperienceBlock(html: string): Array<{ label: string; value: string }> {
  const fields: Array<{ label: string; value: string }> = [];
  const wrapperRe = /work-experience-header[\s\S]*?work-experience-header|work-experience-header[\s\S]*?(?=<div class="work-experience-wrapper|$)/g;
  // 直接按 header 分组：先切出所有 header，再找其后续 content
  const headers: Array<{ start: number; text: string }> = [];
  for (const m of html.matchAll(/<span class="lightGrey">([\s\S]*?)<\/span>[\s\S]*?<span style="font-weight: bold;">([\s\S]*?)<\/span>[\s\S]*?<span style="font-weight: bold;">([\s\S]*?)<\/span>/g)) {
    const time = stripHtml(m[1]);
    const school = stripHtml(m[2]);
    const major = stripHtml(m[3]);
    const hdr = [time, school, major].filter(Boolean).join(' · ');
    if (!hdr) continue;
    fields.push({ label: school || '经历', value: [time, major].filter(Boolean).join(' · ') || hdr });
    headers.push({ start: m.index as number, text: hdr });
  }
  // 从每个 header 起，提取其后面的「学位/证明人/备注」标签值
  for (let i = 0; i < headers.length; i++) {
    const segStart = headers[i].start;
    const segEnd = i + 1 < headers.length ? headers[i + 1].start : html.length;
    const seg = html.slice(segStart, segEnd);
    const kvRe = /<div class="lightGrey[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div class="col-sm-11"[^>]*>([\s\S]*?)<\/div>/g;
    for (const kv of seg.matchAll(kvRe)) {
      const label = stripHtml(kv[1]);
      const value = stripHtml(kv[2]);
      if (label && value) fields.push({ label: `${label}（${stripHtml(headers[i].text.split(' · ')[1] || '')}）`, value });
    }
  }
  return fields;
}

/** 解析学业预警页面 HTML：仅取表格行 */
export function parsePrecautionHtml(html: string): PrecautionItem[] {
  const items: PrecautionItem[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html))) {
    const tds: string[] = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tdm: RegExpExecArray | null;
    while ((tdm = tdRe.exec(m[1]))) tds.push(stripHtml(tdm[1]));
    if (tds.length < 8) continue;
    const index = Number(tds[0]);
    if (!Number.isFinite(index)) continue;
    items.push({
      index,
      courseCode: tds[1],
      courseName: tds[2],
      compulsory: tds[3],
      credits: tds[4],
      score: tds[5],
      gradePoint: tds[6],
      checkResult: tds[7],
    });
  }
  return items;
}

interface RawModule {
  id?: unknown;
  nameZh?: unknown;
  requireInfo?: { requiredCredits?: unknown } | null;
  children?: RawModule[];
  planCourses?: Array<Record<string, unknown>>;
  type?: { nameZh?: unknown } | null;
}

function getI18nName(obj: { nameZh?: unknown; nameEn?: unknown } | null | undefined): string {
  if (!obj) return '';
  return String(obj.nameZh ?? obj.nameEn ?? '');
}

function periodStr(periodInfo: Record<string, unknown> | null | undefined, key: string): string {
  if (!periodInfo || periodInfo[key] == null) return '';
  const unit = String(periodInfo[`${key}Unit`] ?? '');
  const value = String(periodInfo[key]);
  if (unit === 'WEEK') return `${value}周`;
  if (unit === 'DAY') return `${value}天`;
  return value;
}

/** 递归构建培养方案模块树 */
function buildModule(mod: RawModule): ProgramModule {
  const children = Array.isArray(mod.children) ? mod.children.map(buildModule) : [];
  const courses: ProgramCourse[] = Array.isArray(mod.planCourses)
    ? mod.planCourses.map((pc) => {
        const course = (pc.course ?? {}) as Record<string, unknown>;
        const periodInfo = (pc.periodInfo ?? {}) as Record<string, unknown>;
        const readableTerms = Array.isArray(pc.readableTerms) ? pc.readableTerms.join(',') : '';
        return {
          code: String(course.code ?? ''),
          nameZh: getI18nName(course),
          courseProperty: getI18nName((pc.courseProperty ?? null) as Record<string, unknown> | null),
          credits: typeof course.credits === 'number' ? course.credits : undefined,
          periodTotal: periodInfo.total != null ? String(periodInfo.total) : undefined,
          theory: periodStr(periodInfo, 'theory'),
          experiment: periodStr(periodInfo, 'experiment'),
          practice: periodStr(periodInfo, 'focusPractice'),
          test: periodStr(periodInfo, 'test'),
          machine: periodStr(periodInfo, 'machine'),
          design: periodStr(periodInfo, 'design'),
          extra: periodStr(periodInfo, 'extra'),
          terms: readableTerms,
          compulsory: pc.compulsory === true,
          examMode: getI18nName((pc.examMode ?? null) as Record<string, unknown> | null),
          openDepartment: getI18nName((pc.openDepartment ?? null) as Record<string, unknown> | null),
        };
      })
    : [];
  const requireInfo = mod.requireInfo;
  return {
    id: Number(mod.id ?? 0),
    nameZh: mod.nameZh != null ? String(mod.nameZh) : getI18nName(mod.type),
    requiredCredits: requireInfo && requireInfo.requiredCredits != null ? String(requireInfo.requiredCredits) : undefined,
    children,
    courses,
  };
}

/** 解析「我的培养方案」root-module-json 返回的模块树 */
export function parseProgramJson(raw: string): ProgramData {
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    throw new Error('培养方案数据异常');
  }
  const root = (d ?? {}) as RawModule;
  return { root: buildModule(root) };
}

/** 解析导师互选结果查询页面：表格行 */
export function parseTutorSelectResultHtml(html: string): TutorSelectResult[] {
  const items: TutorSelectResult[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html))) {
    const tds: string[] = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tdm: RegExpExecArray | null;
    while ((tdm = tdRe.exec(m[1]))) tds.push(stripHtml(tdm[1]));
    if (tds.length < 9) continue;
    const stdNo = tds[0];
    if (!/\d{6,}/.test(stdNo)) continue;
    items.push({
      stdNo,
      studentName: tds[1],
      grade: tds[2],
      college: tds[3],
      major: tds[4],
      tutorType: tds[5],
      tutorName: tds[6],
      tutorDept: tds[7],
      termYears: tds[8],
    });
  }
  return items;
}

