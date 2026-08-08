import { SITE, API } from '../config/site';
import type { CourseTableData, ExamItem, GradeData, NoticeItem, Semester, StudentInfo } from '../types';
import { isLoginPageText, webFetch } from './bridge';
import {
  extractStudentId,
  extractStudentNameStdNo,
  parseCourseTableJson,
  parseExamHtml,
  parseGradeJson,
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
export async function fetchSemesters(): Promise<Semester[]> {
  const raw = guardSession(await webFetch(API.courseTablePage));
  return parseSemestersFromCourseTable(raw);
}

/** 推断当前学期（今天落在学期区间内；否则取最近开始的学期） */
export function resolveCurrentSemester(semesters: Semester[]): Semester | null {
  if (!semesters.length) return null;
  const today = new Date();
  const inRange = semesters.find((s) => {
    if (!s.startDate || !s.endDate) return false;
    const start = new Date(s.startDate.replace(/-/g, '/'));
    const end = new Date(s.endDate.replace(/-/g, '/'));
    return today >= start && today <= end;
  });
  if (inRange) return inRange;
  return semesters[0];
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
}

/** 课表接口原始返回（调试用） */
export async function fetchCourseTableRaw(semesterId: number): Promise<string> {
  return guardSession(
    await webFetch(`${API.courseTableGetData}?bizTypeId=2&semesterId=${semesterId}`),
  );
}

export async function fetchCourseTable(semesterId: number): Promise<CourseTableData> {
  return parseCourseTableJson(await fetchCourseTableRaw(semesterId));
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
  const res = await fetch(SITE.noticeList, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error('通知获取失败');
  const html = await res.text();
  return parseNoticeHtml(html, SITE.noticeList);
}
