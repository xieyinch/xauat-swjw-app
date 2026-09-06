import type {
  CourseSelectAddDropResult,
  CourseSelectLesson,
  CourseSelectRepaired,
  CourseSelectTurn,
} from '../types';
import { isLoginPageText, webFetch } from './bridge';
import { getStudentInfoCached, SessionExpiredError } from './data';

export interface AddDropOutcome {
  ok: boolean;
  message: string;
  /** 冲突且支持免听时置 true，由调用方询问用户后以 needAttend 重发 */
  conflictResend: boolean;
}

export interface RepairCourseView extends CourseSelectRepaired {
  /** 本轮可开出的教学班（含全部校区/课堂，可能为空=未开课） */
  lessons: CourseSelectLesson[];
  /** 当前是否已选中该课（存在已选教学班） */
  selectedLesson: CourseSelectLesson | null;
}

const POLL_TRY = 10;
const POLL_DELAY_MS = 2000;

let contextPromise: Promise<void> | null = null;

function guard(raw: string): string {
  if (isLoginPageText(raw)) throw new SessionExpiredError();
  return raw;
}

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${label}数据解析失败（服务端返回了异常响应）`);
  }
}

function postForm(path: string, params: Record<string, string | number>): Promise<string> {
  const body = Object.keys(params)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`)
    .join('&');
  return webFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }).then(guard);
}

function isHtmlLike(raw: string): boolean {
  return raw.trimStart().startsWith('<');
}

function postJson(path: string, body: unknown): Promise<string> {
  return webFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(guard);
}

/** 纯 JS UTF-8 解码 */
function decodeUtf8(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
      i += 1;
    } else if ((b0 & 0xe0) === 0xc0 && i + 1 < bytes.length) {
      out += String.fromCharCode(((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if ((b0 & 0xf0) === 0xe0 && i + 2 < bytes.length) {
      out += String.fromCharCode(
        ((b0 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f),
      );
      i += 3;
    } else if ((b0 & 0xf8) === 0xf0 && i + 3 < bytes.length) {
      const cp =
        ((b0 & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      out += String.fromCodePoint(cp);
      i += 4;
    } else {
      i += 1;
    }
  }
  return out;
}

/** 修复服务端按 Latin-1 二次编码的中文（UTF-8 字节被当作单字节字符） */
export function fixLatin1Utf8(s: string): string {
  if (!s) return s;
  const n = s.length;
  const bytes = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const c = s.charCodeAt(i);
    if (c > 255) return s;
    bytes[i] = c;
  }
  return decodeUtf8(bytes);
}

function parseChunkData(raw: string): unknown {
  const wrapped = parseJson<{ data?: string }>(raw, '课程数据');
  if (typeof wrapped?.data !== 'string') {
    throw new Error('课程数据格式异常');
  }
  return JSON.parse(fixLatin1Utf8(wrapped.data)) as unknown;
}

/** 进入选课模块前建立服务端会话上下文（GET 落地页）；同一会话只做一次 */
export function ensureCourseSelectContext(): Promise<void> {
  if (!contextPromise) {
    contextPromise = webFetch('/student/for-std/course-select').then(guard).then(() => undefined);
  }
  return contextPromise;
}

/** 复位上下文缓存（会话过期重登后调用，避免旧 promise 一直复用） */
export function resetCourseSelectContext(): void {
  contextPromise = null;
}

/** 打开的学生选课轮次 */
export async function fetchOpenTurns(): Promise<CourseSelectTurn[]> {
  const info = await getStudentInfoCached();
  await ensureCourseSelectContext();
  const raw = await postForm('/student/ws/for-std/course-select/open-turns', {
    studentId: info.studentId,
    bizTypeId: 2,
  });
  const arr = parseJson<CourseSelectTurn[]>(raw, '选课轮次');
  if (!Array.isArray(arr)) throw new Error('选课轮次数据解析失败（服务端返回了异常响应）');
  return arr;
}

/** 重修/不及格课程列表 */
async function fetchRepairedCourses(
  studentId: number,
  turnId: number,
): Promise<CourseSelectRepaired[]> {
  const raw = await postForm('/student/ws/for-std/course-select/repaired-courses', {
    studentId,
    turnId,
  });
  const arr = parseJson<CourseSelectRepaired[]>(raw, '重修课程');
  if (!Array.isArray(arr)) throw new Error('重修课程数据解析失败（服务端返回了异常响应）');
  return arr;
}

/** 已选教学班列表 */
async function fetchSelectedLessons(
  studentId: number,
  turnId: number,
): Promise<CourseSelectLesson[]> {
  const raw = await postForm('/student/ws/for-std/course-select/selected-lessons', {
    studentId,
    turnId,
  });
  const arr = parseJson<CourseSelectLesson[]>(raw, '已选课程');
  if (!Array.isArray(arr)) throw new Error('已选课程数据解析失败（服务端返回了异常响应）');
  return arr;
}

/** 取当前轮次的可开课教学班全量（addable-lessons chunk），按课程分组返回 */
async function fetchAddableLessonMapByCourse(turnId: number): Promise<Map<number, CourseSelectLesson[]>> {
  const versionRaw = guard(
    await webFetch(`/student/cache/course-select/version/${turnId}/version.json`),
  );
  const version = parseJson<{ itemList?: string[] }>(versionRaw, '课程版本');
  const items = Array.isArray(version?.itemList) ? version.itemList : [];
  if (!items.length) throw new Error('当前轮次暂无可选课程数据');
  const map = new Map<number, CourseSelectLesson[]>();
  for (const item of items) {
    const raw = guard(
      await webFetch(`/student/cache/course-select/addable-lessons/${turnId}/${item}.json`),
    );
    const parsed = parseChunkData(raw);
    if (!Array.isArray(parsed)) throw new Error('课程数据格式异常');
    for (const l of parsed as CourseSelectLesson[]) {
      const cid = l.course?.id;
      if (typeof cid !== 'number') continue;
      const bucket = map.get(cid);
      if (bucket) bucket.push(l);
      else map.set(cid, [l]);
    }
  }
  return map;
}

export interface SelectWorkspaceData {
  repaired: RepairCourseView[];
  selected: CourseSelectLesson[];
}

/** 载入选课工作台数据：重修课程（含教学班展开）+ 已选课程 */
export async function fetchSelectWorkspaceData(
  turnId: number,
): Promise<SelectWorkspaceData> {
  const info = await getStudentInfoCached();
  const studentId = info.studentId;
  await ensureCourseSelectContext();
  const [repaired, selected] = await Promise.all([
    fetchRepairedCourses(studentId, turnId),
    fetchSelectedLessons(studentId, turnId),
  ]);
  const byCourse = await fetchAddableLessonMapByCourse(turnId);

  const views: RepairCourseView[] = repaired.map((r) => {
    const lessons = byCourse.get(r.id) ?? [];
    let selectedLesson: CourseSelectLesson | null = null;
    for (const sel of selected) {
      if (sel.course?.id === r.id) {
        selectedLesson = sel;
        break;
      }
    }
    return { ...r, lessons, selectedLesson };
  });
  return { repaired: views, selected };
}

/** 操作（选/退课）成功后增量刷新已选状态，避免重拉全量课程 chunk */
export async function refreshSelectedLessons(
  turnId: number,
  prevRepaired: RepairCourseView[],
): Promise<SelectWorkspaceData> {
  const info = await getStudentInfoCached();
  await ensureCourseSelectContext();
  const selected = await fetchSelectedLessons(info.studentId, turnId);
  const views = prevRepaired.map((r) => {
    let selectedLesson: CourseSelectLesson | null = null;
    for (const sel of selected) {
      if (sel.course?.id === r.id) {
        selectedLesson = sel;
        break;
      }
    }
    return { ...r, selectedLesson };
  });
  return { repaired: views, selected };
}

/** 轮询取结果（add-drop-response / predicate-response 通用形） */
async function pollResult(
  studentId: number,
  requestId: string,
  endpoint: string,
  label: string,
): Promise<CourseSelectAddDropResult> {
  for (let i = 0; i < POLL_TRY; i++) {
    const raw = await postForm(`/student/ws/for-std/course-select/${endpoint}`, {
      studentId,
      requestId,
    });
    let parsed: CourseSelectAddDropResult | null = null;
    try {
      parsed = JSON.parse(raw) as CourseSelectAddDropResult;
    } catch {
      parsed = null;
    }
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    if (i < POLL_TRY - 1) {
      await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
    }
  }
  throw new Error('服务器繁忙，请稍后再试');
}

function parseAddDrop(parsed: CourseSelectAddDropResult): AddDropOutcome {
  if (parsed.success) {
    return { ok: true, message: '操作成功', conflictResend: false };
  }
  const text = parsed.errorMessage?.text?.trim() || '操作失败';
  return { ok: false, message: text, conflictResend: !!(parsed.resend && text.includes('冲突')) };
}

/** 选课请求（可选 needAttend=免听重发场景） */
export async function requestAdd(
  turnId: number,
  lessonAssocs: number[],
  opts?: { needAttend?: boolean },
): Promise<AddDropOutcome> {
  const info = await getStudentInfoCached();
  const studentId = info.studentId;
  await ensureCourseSelectContext();
  const dtos = lessonAssocs.map((lessonAssoc) => ({
    lessonAssoc,
    virtualCost: 0,
    scheduleGroupAssoc: null,
    ...(opts?.needAttend !== undefined ? { needAttend: opts.needAttend } : {}),
  }));
  const raw = await postJson('/student/ws/for-std/course-select/add-request', {
    studentAssoc: studentId,
    courseSelectTurnAssoc: turnId,
    requestMiddleDtos: dtos,
    coursePackAssoc: null,
  });
  if (isHtmlLike(raw)) throw new Error('选课请求服务异常，请稍后重试');
  const parsed = await pollResult(studentId, raw, 'add-drop-response', '选课');
  return parseAddDrop(parsed);
}

/** 退课请求 */
export async function requestDrop(
  turnId: number,
  lessonAssoc: number,
  coursePackAssoc: number | null,
): Promise<AddDropOutcome> {
  const info = await getStudentInfoCached();
  const studentId = info.studentId;
  await ensureCourseSelectContext();
  const raw = await postJson('/student/ws/for-std/course-select/drop-request', {
    studentAssoc: studentId,
    lessonAssocs: [lessonAssoc],
    courseSelectTurnAssoc: turnId,
    coursePackAssoc,
  });
  if (isHtmlLike(raw)) throw new Error('退课请求服务异常，请稍后重试');
  const parsed = await pollResult(studentId, raw, 'add-drop-response', '退课');
  if (!parsed.success && parsed.errorMessage?.text?.includes('不能退没有选的课')) {
    return { ok: true, message: '该课已不在选课结果中', conflictResend: false };
  }
  return parseAddDrop(parsed);
}

export function courseSelectTurnHref(studentId: number, turnId: number): string {
  return `/student/for-std/course-select/${studentId}/turn/${turnId}/select`;
}
