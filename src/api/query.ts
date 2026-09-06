import type {
  AdminClassCourse,
  CommonFileItem,
  CourseSelectTurn,
  CustomSelectSwitch,
  DegreeApplyRecord,
  EvaluationResult,
  ExamArrangeItem,
  ExamScoreItem,
  ExamSignupItem,
  ExemptApplyWindow,
  ExemptGradeItem,
  ExemptStudyData,
  FeatureApplyLine,
  FeatureApplyRow,
  GuidanceRecord,
  LessonSearchItem,
  PrecautionItem,
  ProgramCompletion,
  ProgramCourse,
  ProgramModule,
  RecommendApplyInfo,
  RoomFreeItem,
  RoomFreeQuery,
  StdAlterationData,
  StudentInfoEntry,
  StudentInfoGroup,
  TutorChangeApply,
  TutorEvaluation,
  TutorInfo,
  TutorSelectResult,
} from '../types';
import { SITE } from '../config/site';
import { isLoginPageText, webFetch } from './bridge';
import { getStudentInfoCached, SessionExpiredError } from './data';
import { stripHtmlSafe } from './parsers';

function guardSession(raw: string): string {
  if (isLoginPageText(raw)) throw new SessionExpiredError();
  return raw;
}

function parseJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('数据解析失败');
  }
}

/** 校验 JSON 为数组，否则抛出可读错误（避免把服务端 500/错误对象当数据渲染导致白屏） */
function parseJsonArray<T>(raw: string, label: string): T[] {
  const parsed = parseJson<T[]>(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${label}数据解析失败（服务端返回了异常响应）`);
  }
  return parsed;
}

/** 访问功能模块落地页建立服务端会话上下文（选课/个性化等接口依赖） */
async function preflightLanding(path: string): Promise<void> {
  await guardSession(await webFetch(path));
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
    const weeksStr = (a.weeksStr as string) ?? '';
    const weekday = (a.weekday as number) ?? 0;
    const startUnit = (a.startUnit as number) ?? 1;
    const endUnit = (a.endUnit as number) ?? startUnit;
    const campus = (a.campus as string) ?? '';
    const room = (a.room as string) ?? '';
    const schedule =
      `${weeksStr} 周${weekday} 第${startUnit}-${endUnit}节 ${campus} ${room}`.trim();
    const place = [campus, room].filter(Boolean).join(' ');
    lessons.push({
      lessonName: (a.lessonName as string) ?? '',
      courseCode: (a.courseCode as string) ?? '',
      courseName: (a.courseName as string) ?? '',
      credits: typeof a.credits === 'number' ? a.credits : 0,
      teachers: Array.isArray(a.teachers) ? (a.teachers as string[]) : [],
      courseType: ((a.courseType as Record<string, string> | undefined)?.nameZh ?? '') as string,
      scheduleText: schedule,
      dayOfWeek: weekday >= 1 && weekday <= 7 ? weekday : undefined,
      startUnit,
      endUnit,
      weekText: weeksStr,
      placeText: place,
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

// ---------- 选课 / 个性化选课 / 免修申请（原生列表页数据） ----------

/**
 * 免修申请列表「课程信息」等列按表头自适应解析：返回列顺序与表头文本一致的单元格数组。
 * 仅解析表头同时包含 expected（按顺序）的第一张表格。
 */
function parseMappedRows(html: string, expected: string[]): string[][] {
  const rows: string[][] = [];
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/g;
  let tm: RegExpExecArray | null;
  while ((tm = tableRe.exec(html))) {
    const table = tm[1];
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let tr: RegExpExecArray | null;
    const local: string[][] = [];
    let headerTexts: string[] = [];
    while ((tr = trRe.exec(table))) {
      const cells = Array.from(tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)).map((x) =>
        stripHtmlSafe(x[1]),
      );
      if (!cells.length) continue;
      if (headerTexts.length === 0) {
        if (expected.some((h) => cells.some((c) => c.includes(h)))) {
          headerTexts = cells;
          continue;
        }
      }
      local.push(cells);
    }
    if (!headerTexts.length) continue;
    const order = expected.map((h) => headerTexts.findIndex((c) => c.includes(h)));
    if (order.some((i) => i < 0)) continue;
    for (const cells of local) {
      rows.push(order.map((i) => cells[i] ?? ''));
    }
    break;
  }
  return rows;
}

/** 从免修申请首页提取窗口时间与公告 */
export function parseExemptApplyWindowHtml(html: string): ExemptApplyWindow {
  let applyTimeText = '';
  const timeSeg = html.match(
    /免修申请时间[\s\S]{0,600}?(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*~\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/,
  );
  if (timeSeg) applyTimeText = `${timeSeg[1]} ~ ${timeSeg[2]}`;
  let bulletin = '';
  const bi = html.indexOf('id="bulletin"');
  if (bi >= 0) {
    let seg = html.slice(bi, bi + 3000);
    seg = seg.replace(/<span[^>]*>[\s\S]{0,20}?公告[\s\S]{0,20}?<\/span>/, '');
    const bm = seg.match(/<span[^>]*>([\s\S]*?)<\/span>/);
    if (bm) bulletin = stripHtmlSafe(bm[1]);
  }
  return { applyTimeText, bulletin };
}

/** 免修申请：首页（申请记录 + 窗口公告） */
export async function fetchExemptStudyData(): Promise<ExemptStudyData> {
  const info = await getStudentInfoCached();
  const raw = guardSession(
    await webFetch(`/student/for-std/exempt-study-apply/applyIndex/${info.studentId}`),
  );
  const rows = parseMappedRows(raw, ['课程信息', '学期', '申请日期', '申请原因', '审核状态']);
  const semesterM = raw.match(/semesterId\s*:\s*(\d+)/);
  return {
    window: parseExemptApplyWindowHtml(raw),
    records: rows.map((r) => ({
      courseText: r[0] ?? '',
      semester: r[1] ?? '',
      applyDate: r[2] ?? '',
      reason: r[3] ?? '',
      auditState: r[4] ?? '',
    })),
    semesterId: semesterM ? Number(semesterM[1]) : undefined,
  };
}

/** 免修成绩：query-exempt-study-grade 返回的表格片段 */
export async function fetchExemptGrades(): Promise<ExemptGradeItem[]> {
  const info = await getStudentInfoCached();
  const raw = guardSession(
    await webFetch(`/student/for-std/exempt-study-apply/query-exempt-study-grade/${info.studentId}`),
  );
  const rows = parseMappedRows(raw, ['课程信息', '学期', '免修成绩', '是否加入成绩库']);
  return rows.map((r) => ({
    courseText: r[0] ?? '',
    semester: r[1] ?? '',
    grade: r[2] ?? '',
    inGradeBook: r[3] ?? '',
  }));
}

/** 选课轮次列表：先访问选课模块落地页建立服务端会话上下文，再 POST 取轮次 JSON */
export async function fetchCourseSelectTurns(): Promise<CourseSelectTurn[]> {
  const info = await getStudentInfoCached();
  await preflightLanding('/student/for-std/course-select');
  const raw = guardSession(
    await webFetch('/student/ws/for-std/course-select/open-turns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: `bizTypeId=2&studentId=${info.studentId}`,
    }),
  );
  return parseJsonArray<CourseSelectTurn>(raw, '选课轮次');
}

/** 个性化选课开关列表（先访问模块落地页建立上下文） */
export async function fetchCustomSelectSwitches(): Promise<CustomSelectSwitch[]> {
  const info = await getStudentInfoCached();
  await preflightLanding('/student/for-std/course-select-apply');
  const raw = guardSession(
    await webFetch(
      `/student/ws/for-std/custom-course-select-apply/open-switches?bizTypeId=2&studentId=${info.studentId}`,
    ),
  );
  return parseJsonArray<CustomSelectSwitch>(raw, '个性化选课开关');
}

// ---------- 深链（原生列表页进入 WebView 承接操作） ----------

/** 进入指定选课轮次的实际选课页 */
export function courseSelectTurnHref(studentId: number, turnId: number): string {
  return `/student/for-std/course-select/${studentId}/turn/${turnId}/select`;
}

/** 进入个性化选课开关的申请页 */
export function customSelectApplyHref(studentId: number, sw: CustomSelectSwitch): string {
  const params = new URLSearchParams({
    bizTypeId: '2',
    semesterId: String(sw.semester.id),
    selectOpen: String(sw.selectOpen),
    dropOpen: String(sw.dropOpen),
    exchangeOpen: String(sw.exchangeOpen),
  });
  return `/student/for-std/course-select-apply/${studentId}/switch/${sw.id}/apply?${params.toString()}`;
}

/** 免修申请「新建申请」页 */
export function exemptNewHref(studentId: number, semesterId?: number): string {
  const redirect = encodeURIComponent(`/for-std/exempt-study-apply/applyIndex/${studentId}`);
  const sem = semesterId ? `&semesterId=${semesterId}` : '';
  return `/student/for-std/exempt-study-apply/new?bizTypeId=2&studentId=${studentId}${sem}&REDIRECT_URL=${redirect}`;
}

// ---------- 申请类列表（缓考 / 课程替代 / 放弃成绩 / 意向导师 / 学籍异动 / 推免） ----------

interface MappedTableCell {
  index: number;
  header: string;
  value: string;
}

interface MappedTableRow {
  group?: string;
  cells: MappedTableCell[];
  html: string;
}

interface ParseTableOptions {
  /** 表头需全部命中（任一单元格包含该子串） */
  require?: string[];
  /** 表头含任一子串即排除该表 */
  exclude?: string[];
  /** 分组标题正则：每个匹配（match.index）之前的表格归入该分组 */
  groupPattern?: RegExp;
}

function normCell(s: string): string {
  return stripHtmlSafe(s).replace(/\s+/g, ' ').trim();
}

/**
 * 解析页面内所有「表头匹配」的表格：按列把每行映射为 {header,value} 单元格。
 * 表头为表格首个 <tr>，后续单元格数量与表头不一致的行视为嵌套表头/占位被跳过。
 */
function parseMappedTables(html: string, opts: ParseTableOptions): MappedTableRow[] {
  const groups: { index: number; label: string }[] = [];
  if (opts.groupPattern) {
    const re = new RegExp(opts.groupPattern.source, opts.groupPattern.flags.includes('g') ? opts.groupPattern.flags : `${opts.groupPattern.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const label = m[1] ?? m[0];
      if (label != null && m.index != null) groups.push({ index: m.index, label: normCell(label) });
    }
  }

  const out: MappedTableRow[] = [];
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/g;
  let tm: RegExpExecArray | null;
  while ((tm = tableRe.exec(html))) {
    const tableStart = tm.index;
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let headers: string[] | null = null;
    const bodyRows: { html: string; values: string[] }[] = [];
    let tr: RegExpExecArray | null;
    while ((tr = trRe.exec(tm[1]))) {
      const cells = Array.from(tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)).map((x) => normCell(x[1]));
      if (!cells.length) continue;
      if (!headers) {
        headers = cells;
        continue;
      }
      if (cells.length === headers.length) bodyRows.push({ html: tr[1], values: cells });
    }
    if (!headers) continue;
    if (opts.require && !opts.require.every((r) => headers.some((h) => h.includes(r)))) continue;
    if (opts.exclude && opts.exclude.some((r) => headers.some((h) => h.includes(r)))) continue;

    let group: string | undefined;
    if (groups.length) {
      let best: { index: number; label: string } | null = null;
      for (const g of groups) {
        if (g.index < tableStart) best = g;
        else break;
      }
      group = best ? best.label : undefined;
    }

    for (const row of bodyRows) {
      const cells: MappedTableCell[] = headers.map((h, i) => ({
        index: i,
        header: h,
        value: row.values[i] ?? '',
      }));
      out.push({ group, cells, html: row.html });
    }
  }
  return out;
}

function cellOf(row: MappedTableRow, labelLike: string[]): MappedTableCell | undefined {
  return row.cells.find((c) => labelLike.some((l) => c.header.includes(l)));
}

/** 缓考申请：各学期考试安排表（含可申请状态） */
export async function fetchExamDelayApplyRows(): Promise<FeatureApplyRow[]> {
  const raw = guardSession(await webFetch('/student/for-std/exam-delay-apply'));
  const rows = parseMappedTables(raw, {
    require: ['课程名称', '考场'],
    groupPattern: /semester-exam-delay-apply">([^<]+)<\/span>/g,
  });
  const result: FeatureApplyRow[] = [];
  for (const row of rows) {
    const name = cellOf(row, ['课程名称']);
    const type = cellOf(row, ['考试类型']);
    const time = cellOf(row, ['考试时间']);
    const room = cellOf(row, ['考场']);
    const state = cellOf(row, ['审核状态']);
    if (!name) continue;
    let title = name.value;
    const metaM = title.match(/课程代码[:：]\s*(\S+)/);
    let meta: string | undefined;
    if (metaM) {
      meta = `课程代码：${metaM[1]}`;
      title = title.replace(/课程代码[:：]\s*\S+/, '').replace(/\s+/g, ' ').trim();
    }
    const canApply = /<button[^>]*class="[^"]*btn-apply[^"]*"[^>]*>/.test(row.html)
      && !/<button[^>]*class="[^"]*btn-apply[^"]*"[^>]*disabled/.test(row.html);
    const status = state && state.value.trim() ? state.value.trim() : undefined;
    const lines: FeatureApplyLine[] = [];
    for (const c of [type, time, room]) {
      if (c && c.value.trim()) lines.push({ label: c.header.replace(/\s+/g, ' '), value: c.value });
    }
    result.push({ group: row.group, title: title || '—', meta, status, applyNote: canApply ? '可申请' : undefined, lines });
  }
  return result;
}

/** 课程替代申请：「我的替代课程申请单」记录（当前无数据时为服务端空表） */
export async function fetchCourseSubstituteRows(): Promise<FeatureApplyRow[]> {
  const raw = guardSession(await webFetch('/student/for-std/course-substitute-apply'));
  const rows = parseMappedTables(raw, { require: ['申请理由', '审核状态'] });
  const result: FeatureApplyRow[] = [];
  for (const row of rows) {
    const from = cellOf(row, ['被替代课程']);
    const to = cellOf(row, ['替代课程']);
    const reason = cellOf(row, ['申请理由']);
    const applyTime = cellOf(row, ['申请时间']);
    const state = cellOf(row, ['审核状态']);
    if ((!from || !from.value) && (!to || !to.value)) continue;
    const lines: FeatureApplyLine[] = [];
    if (from && from.value) lines.push({ label: '被替代课程', value: from.value });
    if (to && to.value) lines.push({ label: '替代课程', value: to.value });
    if (reason && reason.value) lines.push({ label: '申请理由', value: reason.value });
    if (applyTime && applyTime.value) lines.push({ label: '申请时间', value: applyTime.value });
    result.push({
      title: from && from.value ? from.value : '未填写被替代课程',
      status: state && state.value ? state.value : undefined,
      lines,
    });
  }
  return result;
}

/** 放弃成绩申请：「我的放弃成绩申请单」记录列表 */
export async function fetchGradeAbandonRows(): Promise<FeatureApplyRow[]> {
  const raw = guardSession(await webFetch('/student/for-std/grade-abandon-apply'));
  const rows = parseMappedTables(raw, { require: ['申请时间', '审核状态'], exclude: ['操作'] });
  const result: FeatureApplyRow[] = [];
  for (const row of rows) {
    const name = cellOf(row, ['课程名称']);
    const code = cellOf(row, ['课程代码']);
    const classCode = cellOf(row, ['教学班代码']);
    const semester = cellOf(row, ['学期']);
    const credits = cellOf(row, ['学分']);
    const score = cellOf(row, ['成绩']);
    const applyTime = cellOf(row, ['申请时间']);
    const state = cellOf(row, ['审核状态']);
    if (!name || !name.value) continue;
    const meta = [classCode && classCode.value, semester && semester.value].filter(Boolean).join(' · ');
    const lines: FeatureApplyLine[] = [];
    for (const c of [code, credits, score, applyTime]) {
      if (c && c.value) lines.push({ label: c.header.replace(/\s+/g, ' '), value: c.value });
    }
    result.push({
      title: name.value,
      meta: meta || undefined,
      status: state && state.value ? state.value : undefined,
      lines,
    });
  }
  return result;
}

/** 选择意向导师：导师仓库存量列表（当前为空即服务端无开放导师） */
export async function fetchTutorWarehouseRows(): Promise<FeatureApplyRow[]> {
  const raw = guardSession(await webFetch('/student/for-std/select/std-tutor-apply'));
  const rows = parseMappedTables(raw, { require: ['导师', '所属部门'] });
  const seen = new Set<string>();
  const result: FeatureApplyRow[] = [];
  for (const row of rows) {
    const name = cellOf(row, ['导师']);
    if (!name || !name.value || seen.has(name.value)) continue;
    seen.add(name.value);
    const dept = cellOf(row, ['所属部门']);
    const title = cellOf(row, ['教师职称']);
    const intro = cellOf(row, ['导师简介']);
    const lines: FeatureApplyLine[] = [];
    for (const c of [dept, title]) if (c && c.value) lines.push({ label: c.header, value: c.value });
    if (intro && intro.value) lines.push({ label: '导师简介', value: intro.value });
    result.push({ title: name.value, lines });
  }
  return result;
}

/** 学籍异动申请：可申请类型卡 + 已申请页签提示 */
export async function fetchStdAlterationData(): Promise<StdAlterationData> {
  const raw = guardSession(await webFetch('/student/for-std/std-alteration-apply'));
  const applyTypes: StdAlterationData['applyTypes'] = [];
  const canStart = raw.indexOf('id="canApply"');
  const haveStart = raw.indexOf('id="haveApply"');
  const canPane = canStart >= 0 ? raw.slice(canStart, haveStart > canStart ? haveStart : raw.length) : raw;
  const blocks = canPane.split('<div class="content-item">').slice(1);
  for (const block of blocks) {
    const nameM = block.match(/<div class="item-type[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const timeM = block.match(/data-text="申请起止时间：">([\s\S]*?)<\/div>/);
    const noticeM = block.match(/data-text="公告：">([\s\S]*?)<\/div>/);
    if (!nameM) continue;
    const timeRaw = timeM ? normCell(timeM[1]) : '';
    const applyTimeText = timeRaw.replace(/\s*~\s*/g, ' ~ ');
    applyTypes.push({
      name: normCell(nameM[1]),
      applyTimeText,
      notice: noticeM ? normCell(noticeM[1]) : '',
      canApply: /立即申请/.test(block),
    });
  }
  let appliedText = '';
  if (haveStart >= 0) {
    let seg = raw.slice(haveStart, haveStart + 6000);
    seg = seg.slice(0, seg.indexOf('id="canApply"') > 0 ? seg.indexOf('id="canApply"') : seg.length);
    const clean = normCell(seg);
    const marker = clean.match(/无[^。；;]{0,40}(数据|记录|申请)|暂无[^。；;]{0,40}/);
    appliedText = marker ? marker[0] : '';
  }
  return { applyTypes, appliedText };
}

/** 研究生推免：当前服务端提示信息 */
export async function fetchRecommendApplyInfo(): Promise<RecommendApplyInfo> {
  const raw = guardSession(await webFetch('/student/for-std/recommend-student-apply'));
  const body = raw.indexOf('<body') >= 0 ? raw.slice(raw.indexOf('<body')) : raw;
  const clean = normCell(body);
  const note = clean.replace(/^(×\s*)/, '').trim();
  return {
    note: note || '暂无推免信息',
    bulletin: '',
  };
}
