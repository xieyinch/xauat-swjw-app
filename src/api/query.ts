import type {
  AdminClassCourse,
  CommonFileItem,
  EvaluationResult,
  ExamArrangeItem,
  ExamScoreItem,
  ExamSignupItem,
  GuidanceRecord,
  LessonSearchItem,
  PrecautionItem,
  ProgramCompletion,
  ProgramCourse,
  ProgramModule,
  RoomFreeItem,
  RoomFreeQuery,
  StudentInfoEntry,
  StudentInfoGroup,
  DegreeApplyRecord,
  TutorChangeApply,
  TutorEvaluation,
  TutorInfo,
  TutorSelectResult,
} from '../types';
import { SITE } from '../config/site';
import { isLoginPageText, webFetch } from './bridge';
import { getStudentInfoCached } from './data';
import { stripHtmlSafe } from './parsers';

function guardSession(raw: string): string {
  if (isLoginPageText(raw)) throw new Error('登录已过期，请重新登录');
  return raw;
}

function parseJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('数据解析失败');
  }
}

// ---------- 22.03 考试安排 ----------

export async function fetchExamArrange(): Promise<ExamArrangeItem[]> {
  const info = await getStudentInfoCached();
  const raw = guardSession(await webFetch(`/student/for-std/exam-arrange/info/${info.studentId}`));
  return parseExamArrangeHtml(raw);
}

export function parseExamArrangeHtml(html: string): ExamArrangeItem[] {
  const items: ExamArrangeItem[] = [];
  // 座位号来自内联 JS 变量 studentExamList（seatNo），按 id 关联
  const seatMap = new Map<number, string>();
  const listM = html.match(/var\s+studentExamList\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (listM) {
    try {
      const list = JSON.parse(listM[1].replace(/'/g, '"')) as Array<Record<string, unknown>>;
      for (const e of list) {
        if (typeof e.id === 'number' && e.seatNo != null) seatMap.set(e.id, String(e.seatNo));
      }
    } catch {
      // 忽略座位号解析失败
    }
  }
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(clean))) {
    const tr = m[1];
    if (!/<td/.test(tr)) continue;
    const tds = Array.from(tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map((x) => x[1]);
    if (tds.length < 6) continue;
    const idM = tr.match(/id="seat-(\d+)"/);
    const id = idM ? Number(idM[1]) : 0;
    items.push({
      id,
      courseName: stripHtmlSafe(tds[0]),
      timeText: stripHtmlSafe(tds[1]),
      place: stripHtmlSafe(tds[2]),
      seatNo: seatMap.get(id),
      building: stripHtmlSafe(tds[4]),
      campus: stripHtmlSafe(tds[5]),
    });
  }
  return items;
}

// ---------- 02.03 空闲教室查询 ----------

export interface RoomCampusOption {
  text: string;
  value: number;
}

export interface RoomUnitOption {
  value: string;
  name: string;
  time?: string;
  dayPart?: string;
}

export interface RoomFreeResult {
  items: RoomFreeItem[];
  byWeek: boolean;
}

export async function fetchRoomCampusList(): Promise<RoomCampusOption[]> {
  const raw = guardSession(await webFetch('/student/for-std/room-free'));
  const m = raw.match(/var\s+_campusList\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!m) return [];
  // SSR 输出的是 JS 单引号字面量，非 JSON：{ 'text': '默认校区', 'value': 1 }
  try {
    return JSON.parse(m[1].replace(/'/g, '"')) as RoomCampusOption[];
  } catch {
    return [];
  }
}

export async function fetchRoomUnits(campusId: number): Promise<RoomUnitOption[]> {
  const raw = guardSession(
    await webFetch(`/student/ws/room-borrow/get-unit-campus?campusId=${encodeURIComponent(campusId)}`),
  );
  try {
    const d = JSON.parse(raw);
    return (Array.isArray(d) ? d : d.data ?? []) as RoomUnitOption[];
  } catch {
    return [];
  }
}

export async function fetchRoomFree(query: RoomFreeQuery): Promise<RoomFreeItem[]> {
  const cmd: Record<string, unknown> = {
    startDateTime: query.date,
    endDateTime: query.date,
    startTime: '',
    endTime: '',
    weekdays: [],
    units: query.units,
  };
  if (query.byWeek) {
    delete cmd.startDateTime;
    delete cmd.endDateTime;
    cmd.weeks = query.weeks ?? [];
  }
  const body = {
    buildingId: query.building ?? '',
    campusId: query.campusId != null ? String(query.campusId) : '',
    roomId: '',
    dateTimeSegmentCmd: cmd,
    roomType: query.roomType != null && query.roomType !== '' ? Number(query.roomType) : undefined,
    seatsForLessonGte: '',
    hasDataPermission: false,
  };
  const raw = guardSession(
    await webFetch('/student/ws/room-borrow/free-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  const d = parseJson<{ roomList?: Array<Record<string, unknown>> }>(raw);
  const rooms = d.roomList ?? [];
  return rooms.map((r) => {
    const building = (r.building as Record<string, string> | undefined)?.nameZh ?? '';
    const roomType = (r.roomType as Record<string, string> | undefined)?.nameZh ?? '';
    const buildingObj = r.building as { campus?: Record<string, string> } | undefined;
    const campus = buildingObj?.campus?.nameZh ?? '';
    const name = (r.nameZh as string) ?? '';
    return {
      campus: campus || (r.campusName as string) || '',
      building: building || (r.buildingName as string) || '',
      name: name || '',
      roomType: roomType || '',
      capacity: typeof r.seatsForLesson === 'number' ? r.seatsForLesson : undefined,
      timeText: '',
    };
  });
}

// ---------- 02.04 全校开课查询 ----------

export interface LessonSearchResult {
  semesters: Array<{ id: number; nameZh: string }>;
  items: LessonSearchItem[];
}

export async function fetchLessonSearch(
  semesterId: number,
  studentId: number,
  keyword?: string,
): Promise<LessonSearchItem[]> {
  const params = new URLSearchParams();
  if (keyword) params.set('query', keyword);
  const raw = guardSession(
    await webFetch(
      `/student/for-std/lesson-search/semester/${semesterId}/search/${studentId}${
        params.toString() ? `?${params.toString()}` : ''
      }`,
    ),
  );
  const d = parseJson<{ data?: Array<Record<string, unknown>> }>(raw);
  return (d.data ?? []).map((l) => {
    const nameZh = (l.nameZh as string) ?? (l.lessonNameZh as string) ?? '';
    const code = (l.code as string) ?? '';
    const credits =
      (l.requiredPeriodInfo as Record<string, unknown> | undefined)?.total != null
        ? Number((l.requiredPeriodInfo as Record<string, unknown>).total)
        : (l.credits as number);
    const scheduleText =
      ((l.scheduleText as Record<string, unknown> | undefined)?.dateTimeText as Record<string, string> | undefined)
        ?.textZh ?? '';
    const placeText =
      ((l.scheduleText as Record<string, unknown> | undefined)?.dateTimePlaceText as Record<string, string> | undefined)
        ?.textZh ?? '';
    const teachers = Array.isArray(l.teachers) ? (l.teachers as string[]) : [];
    const classes = Array.isArray(l.classes) ? (l.classes as string[]).join(';') : (l.classNameZh as string) ?? '';
    return {
      id: l.id as number,
      code,
      nameZh,
      classes,
      credits: typeof credits === 'number' ? credits : undefined,
      teachers,
      scheduleText,
      placeText,
    };
  });
}

// ---------- 02.20 常用文件下载 ----------

export interface CommonFileCategory {
  id: number;
  nameZh: string;
}

export async function fetchCommonFiles(categoryId?: number): Promise<CommonFileItem[]> {
  const params = new URLSearchParams({ identity: 'STUDENT', fileNameLike: '' });
  if (categoryId != null) params.set('commonFileTypeAssoc', String(categoryId));
  const raw = guardSession(await webFetch(`/student/common-file/search/download-data?${params.toString()}`));
  const d = parseJson<{ commonFiles?: Array<Record<string, unknown>> }>(raw);
  return (d.commonFiles ?? []).map((f) => {
    const fileInfo = (f.fileInfo ?? {}) as Record<string, unknown>;
    const type = (f.commonFileType ?? {}) as Record<string, unknown>;
    return {
      id: f.id as number,
      name: (fileInfo.name as string) ?? '',
      category: (type.nameZh as string) ?? '',
      publishDate: (f.publishDate as string) ?? '',
      sizeText: fileInfo.sizeOfKb != null ? `${fileInfo.sizeOfKb} KB` : undefined,
      downloadUrl: `/student/common-file/download-by-key/${fileInfo.key ?? ''}`,
    };
  });
}

export async function fetchCommonFileCategories(): Promise<CommonFileCategory[]> {
  const raw = guardSession(await webFetch('/student/common-file/search/download-data?identity=STUDENT&fileNameLike='));
  const d = parseJson<{ commonFiles?: Array<Record<string, unknown>> }>(raw);
  const seen = new Map<number, string>();
  for (const f of d.commonFiles ?? []) {
    const type = (f.commonFileType ?? {}) as Record<string, unknown>;
    const id = type.id as number;
    if (id != null && type.nameZh) seen.set(id, type.nameZh as string);
  }
  return Array.from(seen.entries()).map(([id, nameZh]) => ({ id, nameZh }));
}

// ---------- 10.01 学籍信息 ----------

export async function fetchStudentInfoDetail(): Promise<StudentInfoGroup[]> {
  const raw = guardSession(await webFetch(`${SITE.swjw}/student/for-std/student-info`));
  return parseStudentInfoHtml(raw);
}

// ---------- 12.01 我的培养方案 ----------

export interface ProgramData {
  root: ProgramModule;
  courses: ProgramCourse[];
}

export async function fetchProgram(studentId: number): Promise<ProgramData> {
  const raw = guardSession(await webFetch(`/student/for-std/program/root-module-json/${studentId}`));
  const d = parseJson<Record<string, unknown>>(raw);
  return parseProgramJson(d);
}

// ---------- 12.03 培养方案完成情况 ----------

export async function fetchProgramCompletion(studentId: number): Promise<ProgramCompletion> {
  const raw = guardSession(await webFetch(`/student/for-std/program-completion-preview/json/${studentId}`));
  const d = parseJson<Record<string, unknown>>(raw);
  return parseProgramCompletionJson(d);
}

// ---------- 14.11 我的班级课表 ----------

export interface AdminClassTable {
  className: string;
  code: string;
  grade: string;
  department: string;
  major: string;
  courses: AdminClassCourse[];
}

export async function fetchAdminClassTable(semesterId: number, studentId: number): Promise<AdminClassTable> {
  const raw = guardSession(
    await webFetch(
      `/student/for-std/adminclass-course-table/print-data?studentId=${studentId}&semesterId=${semesterId}&bizTypeId=2`,
    ),
  );
  const d = parseJson<Record<string, unknown>>(raw);
  const activities = Array.isArray(d.activities) ? (d.activities as Array<Record<string, unknown>>) : [];
  const lessons: AdminClassCourse[] = [];
  for (const a of activities) {
    const schedule =
      `${(a.weeksStr as string) ?? ''} 周${(a.weekday as number) ?? ''} 第${(a.startUnit as number) ?? ''}-${(a.endUnit as number) ?? ''}节 ${(a.campus as string) ?? ''} ${(a.room as string) ?? ''}`.trim();
    lessons.push({
      lessonName: (a.lessonName as string) ?? '',
      courseCode: (a.courseCode as string) ?? '',
      courseName: (a.courseName as string) ?? '',
      credits: typeof a.credits === 'number' ? a.credits : 0,
      teachers: Array.isArray(a.teachers) ? (a.teachers as string[]) : [],
      courseType: ((a.courseType as Record<string, string> | undefined)?.nameZh ?? '') as string,
      scheduleText: schedule,
    });
  }
  return {
    className: (d.name as string) ?? '',
    code: (d.code as string) ?? '',
    grade: (d.grade as string) ?? '',
    department: (d.department as string) ?? '',
    major: (d.major as string) ?? '',
    courses: lessons,
  };
}

// ---------- 22.15 等级考试 ----------

export interface ExamSignupData {
  signupItems: ExamSignupItem[];
  scoreItems: ExamScoreItem[];
}

export async function fetchExamSignup(): Promise<ExamSignupData> {
  const raw = guardSession(await webFetch('/student/for-std/other-exam-signup'));
  return parseExamSignupHtml(raw);
}

// ---------- 24.07 学业预警 ----------

export async function fetchPrecaution(): Promise<PrecautionItem[]> {
  const raw = guardSession(await webFetch('/student/for-std/precaution'));
  return parsePrecautionHtml(raw);
}

// ---------- 33.02 我的导师 ----------

export async function fetchTutor(): Promise<TutorInfo | null> {
  const raw = guardSession(await webFetch('/student/for-std/select/std-tutor-ware'));
  return parseTutorHtml(raw);
}

// ---------- 33.03 导师互选结果查询 ----------

export async function fetchTutorSelectResult(): Promise<TutorSelectResult[]> {
  const raw = guardSession(await webFetch('/student/for-std/select/std-tutor-select-result'));
  return parseTutorSelectResultHtml(raw);
}

// ---------- 33.06 我的被评结果 ----------

export async function fetchEvaluationResults(): Promise<EvaluationResult[]> {
  const info = await getStudentInfoCached();
  const raw = guardSession(await webFetch(`/student/for-std/my-evaluation-result/search/${info.studentId}`));
  return parseEvaluationResultHtml(raw);
}

// ---------- 33.04 评价导师 ----------

export async function fetchTutorEvaluations(): Promise<TutorEvaluation[]> {
  const info = await getStudentInfoCached();
  const raw = guardSession(await webFetch(`/student/for-std/evaluation-index-result/search/${info.studentId}`));
  return parseTutorEvaluationHtml(raw);
}

// ---------- 10.14 学位申请 ----------

export async function fetchDegreeApplyRecords(): Promise<DegreeApplyRecord[]> {
  const info = await getStudentInfoCached();
  const raw = guardSession(await webFetch(`/student/for-std/degree-apply/search/${info.studentId}`));
  return parseDegreeApplyHtml(raw);
}

// ---------- 33.05 导师变更申请 ----------

const TUTOR_CHANGE_STATE_MAP: Record<string, string> = {
  ACCEPTED: '通过',
  REJECTED: '未通过',
  NOT_SUBMITTED: '未提交',
  CANCELLED: '已撤回',
  SUBMITTED: '已提交',
  IN_PROGRESS: '审核中',
  RETURN_MODIFICATION: '退回修改',
};

export async function fetchTutorChangeApplies(): Promise<TutorChangeApply[]> {
  const info = await getStudentInfoCached();
  const raw = guardSession(await webFetch(`/student/for-std/tutor-change-apply/search?studentId=${info.studentId}`));
  return parseTutorChangeJson(raw);
}

export function parseTutorChangeJson(raw: string): TutorChangeApply[] {
  try {
    const json = JSON.parse(raw);
    const list = Array.isArray(json?.data) ? json.data : [];
    return list.map((item: Record<string, any>): TutorChangeApply => ({
      id: Number(item?.id ?? 0),
      semester: item?.semester?.nameZh ?? '',
      beforeTutor: item?.beforeTutor?.teacher?.person?.nameZh ?? '',
      afterTutor: item?.afterTutor?.teacher?.person?.nameZh ?? '',
      tutorType: item?.tutorType?.nameZh ?? '',
      applyTime: item?.submitTime ?? '',
      reason: item?.remark ?? '',
      auditState: TUTOR_CHANGE_STATE_MAP[item?.auditState ?? ''] ?? (item?.auditState ?? ''),
    }));
  } catch {
    return [];
  }
}

// ---------- 33.07 指导过程查看 ----------

export interface GuidanceData {
  totalCount: number;
  records: GuidanceRecord[];
}

export async function fetchGuidanceRecords(): Promise<GuidanceData> {
  const raw = guardSession(await webFetch('/student/for-std/guidance-record'));
  return parseGuidanceHtml(raw);
}

// ---------- HTML 解析器 ----------

export function parseStudentInfoHtml(html: string): StudentInfoGroup[] {
  const groupKeys = ['baseInfo', 'recruitInfo', 'registrationInfo', 'stdAlterInfo', 'graduateInfo', 'degreeInfo'];
  const groupNames: Record<string, string> = {
    baseInfo: '基本信息',
    recruitInfo: '录取信息',
    registrationInfo: '注册信息',
    stdAlterInfo: '异动信息',
    graduateInfo: '毕业信息',
    degreeInfo: '学位信息',
  };
  const groups: StudentInfoGroup[] = [];
  for (const key of groupKeys) {
    const m = html.match(new RegExp(`<div id="${key}"[^>]*>([\\s\\S]*?)(?:<div id="[a-zA-Z]+Info"|<script|<\\/body)`, 'i'));
    if (!m) continue;
    const block = m[1];
    const h4 = block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/);
    const entries: StudentInfoEntry[] = [];
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let tm: RegExpExecArray | null;
    while ((tm = trRe.exec(block))) {
      const tr = tm[1];
      if (!/<td/.test(tr)) continue;
      const tds = Array.from(tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map((x) => x[1]);
      // 每行按「标签-值」配对（一行最多 3 组）
      for (let i = 0; i + 1 < tds.length; i += 2) {
        const label = stripHtmlSafe(tds[i]);
        if (!label) continue;
        entries.push({ label, value: stripHtmlSafe(tds[i + 1]) });
      }
    }
    if (entries.length) {
      groups.push({ key, name: h4 ? stripHtmlSafe(h4[1]) : groupNames[key] ?? key, entries });
    }
  }
  return groups;
}

export function parseProgramJson(d: Record<string, unknown>): ProgramData {
  const courses: ProgramCourse[] = [];
  const walk = (node: Record<string, unknown>, depth: number): ProgramModule => {
    const childrenRaw = (node.children ?? []) as Array<Record<string, unknown>>;
    const sub = childrenRaw.map((c) => walk(c, depth + 1));
    const planCourses = (node.planCourses ?? []) as Array<Record<string, unknown>>;
    for (const pc of planCourses) {
      const course = (pc.course ?? {}) as Record<string, unknown>;
      const name = stripHtmlSafe(String((course.nameZh ?? course.name ?? '') as string));
      const credits = pc.credits != null ? Number(pc.credits) : Number(course.credits ?? 0);
      const courseType = ((course.courseType ?? {}) as Record<string, string>)?.nameZh ?? '';
      courses.push({
        code: (course.code as string) ?? '',
        name,
        credits,
        courseType,
      });
    }
    const typeName = ((node.type ?? {}) as Record<string, string>)?.nameZh ?? '';
    const rawName = String((node.nameZh ?? node.name ?? typeName ?? '') as string);
    const name = stripHtmlSafe(rawName) || (depth === 0 ? '培养方案' : '');
    return {
      id: node.id as number,
      name,
      typeName,
      requireCredits: (node.requireCredits as number) ?? undefined,
      passedCredits: (node.passedCredits as number) ?? undefined,
      children: sub,
    };
  };
  const root = walk(d, 0);
  return { root, courses };
}

export function parseProgramCompletionJson(d: Record<string, unknown>): ProgramCompletion {
  const summary = (d.completionSummary ?? {}) as Record<string, unknown>;
  const requireInfo = (d.requireInfo ?? {}) as Record<string, unknown>;
  const outerSummary = (d.outerCompletionSummary ?? {}) as Record<string, unknown>;
  const passedCourses: ProgramCourse[] = [];
  const failedCourses: ProgramCourse[] = [];
  const moduleRaw = (d.moduleList ?? d.children ?? []) as Array<Record<string, unknown>>;
  const walk = (node: Record<string, unknown>) => {
    const courseList = (node.courseList ?? []) as Array<Record<string, unknown>>;
    for (const c of courseList) {
      const passed = String(c.finalResultType ?? c.resultType ?? '') === 'PASSED';
      const name = stripHtmlSafe(String((c.nameZh ?? c.name ?? '') as string));
      const credits = c.credits != null ? Number(c.credits) : 0;
      const score = c.score != null ? String(c.score) : (c.gradeStr as string) ?? '';
      const item: ProgramCourse = {
        code: (c.code as string) ?? '',
        name,
        credits,
        courseType: ((c.courseTypeAssoc ?? {}) as Record<string, string>)?.nameZh ?? '',
        passed,
        score,
      };
      (passed ? passedCourses : failedCourses).push(item);
    }
    for (const child of (node.children ?? []) as Array<Record<string, unknown>>) walk(child);
  };
  moduleRaw.forEach(walk);
  return {
    passedCredits: Number(summary.passedCredits ?? 0),
    failedCredits: Number(summary.failedCredits ?? 0),
    requireCredits: Number(requireInfo.credits ?? 0),
    passedModules: Number(summary.passedSubModuleNum ?? 0),
    totalModules: Number(summary.failedSubModuleNum ?? 0) + Number(summary.passedSubModuleNum ?? 0),
    outerPassedCredits: Number(outerSummary.passedCredits ?? 0),
    passedCourses,
    failedCourses,
  };
}

export function parseExamSignupHtml(html: string): ExamSignupData {
  const tables = Array.from(html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)).map((m) => m[1]);
  const rowsFrom = (table: string): Array<string[]> => {
    const out: Array<string[]> = [];
    for (const tr of Array.from(table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)).map((m) => m[1])) {
      const tds = Array.from(tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map((x) => stripHtmlSafe(x[1]));
      if (tds.length && !(tds.length === 1 && tds[0] === '暂无数据')) out.push(tds);
    }
    return out;
  };
  const signupItems: ExamSignupItem[] = (rowsFrom(tables[0] ?? '') ?? []).map((r) => ({
    batch: r[0] ?? '',
    subject: r[1] ?? '',
    place: r[2] ?? '',
    arrangement: r[3] ?? '',
    signupTime: r[4] ?? '',
    fee: r[5] ?? '',
    payStatus: r[6] ?? '',
  }));
  const scoreItems: ExamScoreItem[] = (rowsFrom(tables[1] ?? '') ?? []).map((r) => ({
    examType: r[0] ?? '',
    subject: r[1] ?? '',
    score: r[2] ?? '',
    passed: r[3] ?? '',
    certNo: r[4] ?? '',
  }));
  return { signupItems, scoreItems };
}

export function parsePrecautionHtml(html: string): PrecautionItem[] {
  const out: PrecautionItem[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html))) {
    const tr = m[1];
    if (!/<td/.test(tr)) continue;
    const tds = Array.from(tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map((x) => stripHtmlSafe(x[1]));
    if (tds.length < 6) continue;
    out.push({
      courseCode: tds[1] ?? '',
      courseName: tds[2] ?? '',
      required: tds[3] ?? '',
      credits: tds[4] ? Number(tds[4]) : undefined,
      score: tds[5] ?? '',
      gradePoint: tds[6] ?? '',
      checkResult: tds[7] ?? '',
    });
  }
  return out;
}

export function parseTutorHtml(html: string): TutorInfo | null {
  if (/暂无导师/.test(html)) return null;
  const text = stripHtmlSafe(html);
  // 逐行解析键值
  const find = (label: string): string => {
    const re = new RegExp(`${label}[\\s:：]*([^\\n|；;]{1,30})`);
    const m = text.match(re);
    return m ? m[1].trim() : '';
  };
  return {
    name: find('导师姓名') || find('导师'),
    department: find('导师所属部门') || find('所属部门'),
    title: find('职称') || undefined,
    tutorType: find('导师类型') || undefined,
    period: find('聘期') || undefined,
    phone: find('联系电话') || undefined,
    email: find('邮箱') || undefined,
  };
}

export function parseTutorSelectResultHtml(html: string): TutorSelectResult[] {
  const out: TutorSelectResult[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html))) {
    const tr = m[1];
    if (!/<td/.test(tr)) continue;
    const tds = Array.from(tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map((x) => stripHtmlSafe(x[1]));
    // 表头首列（序号）为空，数据行从第 2 列开始
    if (tds.length < 8) continue;
    out.push({
      stdNo: tds[1] ?? '',
      studentName: tds[2] ?? '',
      grade: tds[3] ?? '',
      department: tds[4] ?? '',
      major: tds[5] ?? '',
      tutorType: tds[6] ?? '',
      tutorName: tds[7] ?? '',
      tutorDepartment: tds[8] ?? undefined,
      period: tds[9] ?? undefined,
    });
  }
  return out;
}

export function parseEvaluationResultHtml(html: string): EvaluationResult[] {
  const out: EvaluationResult[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html))) {
    const tr = m[1];
    if (!/<td/.test(tr)) continue;
    const tds = Array.from(tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map((x) => stripHtmlSafe(x[1]));
    if (tds.length < 2) continue;
    const idM = tr.match(/data-id="(\d+)"/);
    const scores: Array<{ name: string; score: string }> = [];
    let totalScore: string | undefined;
    for (let i = 1; i < tds.length; i++) {
      const v = tds[i];
      if (!v) continue;
      scores.push({ name: `指标${i}`, score: v });
    }
    out.push({
      id: idM ? Number(idM[1]) : 0,
      courseName: tds[0] ?? '',
      scores,
      totalScore,
    });
  }
  return out;
}

export function parseTutorEvaluationHtml(html: string): TutorEvaluation[] {
  const out: TutorEvaluation[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html))) {
    const tr = m[1];
    if (!/<td/.test(tr)) continue;
    const tds = Array.from(tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map((x) => stripHtmlSafe(x[1]));
    if (tds.length < 6) continue;
    const idM = tr.match(/data-id="(\d+)"/);
    out.push({
      id: idM ? Number(idM[1]) : 0,
      semester: tds[0] ?? '',
      tutorName: tds[1] ?? '',
      tutorType: tds[2] ?? '',
      score: tds[3] ?? '',
      evaluateTime: tds[4] ?? '',
      publishState: tds[5] ?? '',
    });
  }
  return out;
}

export function parseDegreeApplyHtml(html: string): DegreeApplyRecord[] {
  const out: DegreeApplyRecord[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html))) {
    const tr = m[1];
    if (!/<td/.test(tr)) continue;
    const tds = Array.from(tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map((x) => stripHtmlSafe(x[1]));
    if (tds.length < 8) continue;
    const idM = tr.match(/data-id="(\d+)"/);
    out.push({
      id: idM ? Number(idM[1]) : 0,
      semester: tds[0] ?? '',
      trainingType: tds[1] ?? '',
      grade: tds[2] ?? '',
      studentNo: tds[3] ?? '',
      studentName: tds[4] ?? '',
      college: tds[5] ?? '',
      major: tds[6] ?? '',
      auditState: tds[7] ?? '',
    });
  }
  return out;
}

export function parseGuidanceHtml(html: string): GuidanceData {
  const totalM = html.match(/累计被指导(\d+)次/);
  const records: GuidanceRecord[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html))) {
    const tr = m[1];
    if (!/<td/.test(tr)) continue;
    const tds = Array.from(tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map((x) => stripHtmlSafe(x[1]));
    if (tds.length < 4) continue;
    records.push({ name: tds[0] ?? '', detail: tds[1] ?? '', content: tds[2] ?? '', attendance: tds[3] ?? '' });
  }
  return { totalCount: totalM ? Number(totalM[1]) : records.length, records };
}
