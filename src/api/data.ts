import { SITE, API } from '../config/site';
import type { CourseTableData, ExamItem, GradeData, MenuCategory, NoticeItem, Semester, StudentInfo } from '../types';
import { isLoginPageText, webFetch } from './bridge';
import { resolveCurrentSemester } from './semester';
import {
  extractStudentId,
  extractStudentNameStdNo,
  parseCourseTableJson,
  parseExamHtml,
  parseGradeJson,
  parseMenu,
  parseNoticeHtml,
  parseSemestersFromCourseTable,
} from './parsers';

export class SessionExpiredError extends Error {
  constructor() {
    super('登录已过期，请重新登录');
    this.name = 'SessionExpiredError';
  }
}

function guardSession(raw: string): string {
  if (isLoginPageText(raw)) throw new SessionExpiredError();
  return raw;
}

/** 从课表页面解析可选学期列表 */
let semesterRequest: Promise<Semester[]> | null = null;
export async function fetchSemesters(): Promise<Semester[]> {
  if (semesterRequest) return semesterRequest;
  const request = loadSemesters();
  semesterRequest = request;
  try { return await request; } finally { if (semesterRequest === request) semesterRequest = null; }
}
async function loadSemesters(): Promise<Semester[]> {
  const raw = guardSession(await webFetch(API.courseTablePage));
  const semesters = parseSemestersFromCourseTable(raw);
  if (!semesters.length) {
    throw new Error('未读取到学期数据，教务页面格式可能已更新');
  }
  return semesters;
}

/** 按学校日期优先、学年名称后备的统一规则选择当前学期，不依赖列表顺序。 */
export { resolveCurrentSemester };

/** 将学期按「与当前日期最相关」排序：preferredId 置顶，其次进行中/刚结束的学期（越近越靠前），无日期与远期学期排最后 */
export function rankSemesterCandidates(
  semesters: Semester[],
  preferredId: number | null,
): Semester[] {
  const today = Date.now();
  const parse = (s?: string): number | null =>
    s ? new Date(s.replace(/-/g, '/')).getTime() : null;
  return semesters
    .map((s) => {
      let v: number;
      if (s.id === preferredId) {
        v = Number.NEGATIVE_INFINITY;
      } else {
        const start = parse(s.startDate);
        const end = parse(s.endDate);
        if (start == null && end == null) {
          v = Number.POSITIVE_INFINITY;
        } else {
          const st = start ?? today;
          const en = end ?? start ?? today;
          v = st <= today ? today - Math.min(en, today) : st - today + 1e8;
        }
      }
      return { s, v };
    })
    .sort((a, b) => a.v - b.v)
    .map((x) => x.s);
}

/** 学生信息（studentId / 姓名 / 学号） */
export async function fetchStudentInfo(): Promise<StudentInfo> {
  const gradePage = guardSession(await webFetch(API.gradePage));
  const studentId = extractStudentId(gradePage);
  if (!studentId) throw new Error('无法获取学生信息，请重新登录');
  let name = '';
  let stdNo = '';
  try {
    const examPage = guardSession(await webFetch(API.examPage));
    const info = extractStudentNameStdNo(examPage);
    if (info) {
      name = info.name;
      stdNo = info.stdNo;
    }
  } catch {
    // 考试页解析失败不影响学生信息
  }
  return { studentId, name, stdNo };
}

let studentInfoPromise: Promise<StudentInfo> | null = null;

export function getStudentInfoCached(): Promise<StudentInfo> {
  if (!studentInfoPromise) {
    studentInfoPromise = fetchStudentInfo().catch((e) => {
      studentInfoPromise = null;
      throw e;
    });
  }
  return studentInfoPromise;
}

export function clearStudentInfoCache() {
  studentInfoPromise = null;
  semesterRequest = null;
  courseRequests.clear();
}

/** 课表接口原始返回（调试用） */
export async function fetchCourseTableRaw(semesterId: number): Promise<string> {
  return guardSession(
    await webFetch(`${API.courseTableGetData}?bizTypeId=2&semesterId=${semesterId}`),
  );
}

const courseRequests = new Map<number, Promise<CourseTableData>>();
export async function fetchCourseTable(semesterId: number): Promise<CourseTableData> {
  // Deduplicate concurrent Home/Pet/timetable requests, but never keep stale timetable data.
  const existing = courseRequests.get(semesterId);
  if(existing) return existing;
  const request = fetchCourseTableRaw(semesterId).then(raw => ({...parseCourseTableJson(raw), semesterId}));
  courseRequests.set(semesterId,request);
  try { return await request; } finally { if(courseRequests.get(semesterId)===request)courseRequests.delete(semesterId); }
}

/** 取「当前/最近且有课程」的学期课表：优先当前学期，空窗期自动回退到最近有课学期 */
export async function fetchBestCourseTable(): Promise<{ semester: Semester; table: CourseTableData } | null> {
  const semesters = await fetchSemesters();
  const preferred = resolveCurrentSemester(semesters);
  if (!preferred) return null;
  let firstData: { semester: Semester; table: CourseTableData } | null = null;
  for (const s of rankSemesterCandidates(semesters, preferred.id)) {
    try {
      const table = await fetchCourseTable(s.id);
      const result = { semester: s, table };
      if (table.lessons.length > 0) return result;
      firstData = firstData ?? result;
    } catch (e) {
      if ((e as Error).name === 'SessionExpiredError') throw e;
      // 单个学期读取失败则跳过，继续探测更近的其它学期
    }
  }
  return firstData;
}

export async function fetchGrades(studentId: number, semesterId: number): Promise<GradeData> {
  const raw = guardSession(
    await webFetch(`/student/for-std/grade/sheet/info/${studentId}?semester=${semesterId}`),
  );
  return parseGradeJson(raw, semesterId);
}

export async function fetchExams(): Promise<ExamItem[]> {
  const raw = guardSession(await webFetch(API.examPage));
  return parseExamHtml(raw);
}

/** 通知公告（公开站点，走原生 fetch，无需登录） */
export async function fetchNotices(): Promise<NoticeItem[]> {
  const urls = [SITE.noticeList, 'https://jwc.xauat.edu.cn/tzgg/xsxg.htm'];
  const lists = await Promise.all(urls.map(async url => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error('通知获取失败');
      const list = parseNoticeHtml(await res.text(), url);
      if (!list.length) throw new Error('通知列表未识别，请稍后重试');
      return list;
    } finally { clearTimeout(timer); }
  }));
  return [...new Map(lists.flat().map(n => [n.url, n])).values()].sort((a,b) => b.date.localeCompare(a.date));
}

/** 教务系统全部功能菜单（按分类分组） */
export async function fetchMenu(): Promise<MenuCategory[]> {
  const raw = guardSession(await webFetch(API.menu));
  return parseMenu(raw);
}
