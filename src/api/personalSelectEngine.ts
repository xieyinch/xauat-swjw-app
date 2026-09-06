import type { CourseSelectLesson, CustomSelectSwitch } from '../types';
import { isLoginPageText, webFetch } from './bridge';
import { getStudentInfoCached, SessionExpiredError } from './data';

export interface ApplyLesson extends CourseSelectLesson {
  scheduleGroups?: Array<{
    id: number;
    no?: number;
    default?: boolean;
    dateTimePlace?: { textZh?: string; text?: string };
  }>;
  coursePackAssoc?: number | null;
  coursePackCourseTakes?: Array<{
    lessonSearchVm?: { id?: number };
    scheduleGroupAssoc?: number | null;
  }>;
}

export interface ApplyItem {
  oldLessonAssoc: number;
  newLessonAssoc: number;
  lessonAssoc: number;
  scheduleGroupAssoc: number | null;
}

export interface CheckResult {
  result: boolean;
  message?: string;
  conflictDataList?: unknown[];
  exemptLessons?: ApplyLesson[];
}

export interface AppliedRow {
  cells: string[];
  byHeader: Record<string, string>;
  dataId?: string;
  type?: string;
  infoId?: string;
  printId?: string;
  deptInfoId?: string;
  cancelId?: string;
}

export interface SubmitResponse {
  success?: boolean;
  type?: string;
  content?: string;
}

export interface AccountOption {
  id: number;
  loginName?: string;
  person?: { nameZh?: string };
  mngtDepartment?: { nameZh?: string } | null;
}

const WORKSPACE_RE = /<table[^>]*class="[^"]*select-course-table[^"]*"[^>]*>([\s\S]*?)<\/table>/;
const HISTORY_RE = /<table[^>]*class="table[^"]*"[^>]*>([\s\S]*?)<\/table>/;

let applyContextPromise: Promise<void> | null = null;

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

function postForm(path: string, params: Record<string, string | number | Array<string | number>>): Promise<string> {
  const pairs: string[] = [];
  for (const k of Object.keys(params)) {
    const v = params[k];
    if (Array.isArray(v)) {
      for (const item of v) pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`);
    } else {
      pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return webFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: pairs.join('&'),
  }).then(guard);
}

function postJson(path: string, body: unknown): Promise<string> {
  return webFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(guard);
}

function cleanCell(html: string): string {
  return html
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function attrOf(html: string, name: string): string | null {
  const m = new RegExp(`${name}=["']([^"']*)["']`).exec(html);
  return m ? m[1] : null;
}

function findActionIds(opHtml: string, cls: string): string | undefined {
  const els = opHtml.match(/<(?:a|button)\b[^>]*>/gi) ?? [];
  for (const el of els) {
    const klass = attrOf(el, 'class') ?? '';
    if (klass.split(/\s+/).includes(cls)) {
      const hit = attrOf(el, 'data-id') ?? attrOf(el, 'data');
      if (hit) return hit;
    }
  }
  return undefined;
}

function parseListTable(html: string): AppliedRow[] {
  const out: AppliedRow[] = [];
  const tables = html.match(/<table[^>]*>[\s\S]*?<\/table>/g) ?? [];
  for (const table of tables) {
    const head = /<thead>([\s\S]*?)<\/thead>/.exec(table);
    if (!head) continue;
    const headers = (head[1].match(/<th[^>]*>[\s\S]*?<\/th>/g) ?? []).map(cleanCell);
    if (!headers.includes('审核状态') && !headers.includes('申请类型')) continue;
    const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(table);
    if (!body) continue;
    const rows = body[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
    for (const row of rows) {
      if (/<th/i.test(row)) continue;
      const tdRaw = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) ?? [];
      if (!tdRaw.length) continue;
      const byHeader: Record<string, string> = {};
      headers.forEach((h, idx) => {
        const raw = tdRaw[idx];
        if (raw != null) {
          byHeader[h] = cleanCell(raw);
        }
      });
      if (!byHeader['课程信息'] && !byHeader['学期']) continue;
      if (byHeader['课程信息'] === '无数据') continue;
      const opRaw = tdRaw[headers.indexOf('操作')] ?? '';
      const typeAttr = /^<td[^>]*>/.exec(opRaw);
      const type = typeAttr ? attrOf(typeAttr[0], 'data') ?? undefined : undefined;
      const rowEl = /^<tr[^>]*>/.exec(row);
      const rowId = rowEl ? attrOf(rowEl[0], 'data-id') ?? undefined : undefined;
      out.push({
        cells: headers.map((h) => byHeader[h] ?? ''),
        byHeader,
        dataId: rowId,
        type,
        infoId: findActionIds(opRaw, 'btn-infos'),
        printId: findActionIds(opRaw, 'btn-print'),
        deptInfoId: findActionIds(opRaw, 'openDepartment-infos'),
        cancelId: findActionIds(opRaw, 'btn-cancel-apply'),
      });
    }
  }
  return out;
}

function exportText(s: unknown): string {
  return typeof s === 'string' ? s : '';
}

export interface ApplyWorkspace {
  rows: AppliedRow[];
  telephone?: string;
}

/** 建立个性化选课模块服务端会话（GET switches 落地页）；同会话只一次 */
export function ensureApplyContext(): Promise<void> {
  if (!applyContextPromise) {
    applyContextPromise = getStudentInfoCached()
      .then((info) => webFetch(`/student/for-std/course-select-apply/switches/${info.studentId}`))
      .then(guard)
      .then(() => undefined)
      .catch((e) => {
        applyContextPromise = null;
        throw e;
      });
  }
  return applyContextPromise;
}

export function resetApplyContext(): void {
  applyContextPromise = null;
}

/** 工作台 SSR 页（“我的申请”列表），解析 select-course-table 行 */
export async function fetchApplyWorkspace(
  sw: Pick<CustomSelectSwitch, 'id'> & { semester: { id: number } },
  openFlags?: { selectOpen?: boolean; dropOpen?: boolean; exchangeOpen?: boolean },
): Promise<ApplyWorkspace> {
  const info = await getStudentInfoCached();
  await ensureApplyContext();
  const q = [
    `bizTypeId=2`,
    `semesterId=${sw.semester.id}`,
    `selectOpen=${openFlags?.selectOpen ?? true}`,
    `dropOpen=${openFlags?.dropOpen ?? true}`,
    `exchangeOpen=${openFlags?.exchangeOpen ?? false}`,
  ].join('&');
  const raw = guard(
    await webFetch(
      `/student/for-std/course-select-apply/${info.studentId}/switch/${sw.id}/apply?${q}`,
    ),
  );
  const rows = parseListTable(raw);
  const telM = /telephone:\s*'([^']*)'/.exec(raw);
  return { rows, telephone: telM ? telM[1] : undefined };
}

/** 选课（SELECT）候选教学班全量 */
export async function fetchSelectCandidates(semesterId: number): Promise<ApplyLesson[]> {
  const info = await getStudentInfoCached();
  await ensureApplyContext();
  const raw = guard(
    await webFetch(
      `/student/ws/for-std/custom-course-select-apply/all-select-lessons?studentId=${info.studentId}&semesterId=${semesterId}&bizTypeId=2`,
    ),
  );
  const arr = parseJson<ApplyLesson[]>(raw, '可申请课程');
  if (!Array.isArray(arr)) throw new Error('可申请课程数据解析失败');
  return arr;
}

/** 退课（REVOKE）候选：当前学期已修读教学班 */
export async function fetchRevokeCandidates(semesterId: number): Promise<ApplyLesson[]> {
  const info = await getStudentInfoCached();
  await ensureApplyContext();
  const raw = guard(
    await webFetch(
      `/student/ws/for-std/custom-course-select-apply/selected-lessons?studentId=${info.studentId}&semesterId=${semesterId}&bizTypeId=2&stdRangeType=REVOKE`,
    ),
  );
  const arr = parseJson<ApplyLesson[]>(raw, '可退课程');
  if (!Array.isArray(arr)) throw new Error('可退课程数据解析失败');
  return arr;
}

/** 时段/范围校验：可发起该类型申请 */
export async function checkApplyRange(
  applyType: 'SELECT' | 'REVOKE' | 'EXCHANGE',
  semesterId: number,
): Promise<{ ok: boolean; message?: string }> {
  const info = await getStudentInfoCached();
  await ensureApplyContext();
  const raw = await postForm('/student/ws/for-std/custom-course-select-apply/check-range', {
    applyType,
    studentId: info.studentId,
    semesterId,
    bizTypeId: 2,
  });
  const res = parseJson<{ result?: boolean; errors?: { allErrors?: Array<{ text?: string }> } }>(
    raw,
    '范围校验',
  );
  if (res.result) return { ok: true };
  const text = res.errors?.allErrors?.map((e) => e.text ?? '').filter(Boolean).join('；');
  return { ok: false, message: text || '当前不在申请时段内' };
}

/** 退课前校验（有成绩/发布则不可退） */
export async function checkCanRevoke(
  lessonAssoc: number,
  semesterId: number,
): Promise<{ flag: boolean; message?: string }> {
  const info = await getStudentInfoCached();
  const raw = await postForm('/student/ws/for-std/custom-course-select-apply/check-can-revoke', {
    semesterAssoc: semesterId,
    studentAssoc: info.studentId,
    bizTypeAssoc: 2,
    lessonAssoc,
  });
  const res = parseJson<{ revokeFlag?: boolean; msg?: string }>(raw, '退课校验');
  return { flag: !!res.revokeFlag, message: res.msg };
}

export interface CanApplyInput {
  applyType: 'SELECT' | 'REVOKE' | 'EXCHANGE';
  semesterId: number;
  allApplys: ApplyItem[];
  exemptApplys?: ApplyItem[];
}

/** 申请可行性校验：冲突/免听候选 */
export async function checkCanApply(input: CanApplyInput): Promise<{
  result: boolean;
  message?: string;
  conflictDataList?: Array<{ courseName?: string; code?: string; timePlace?: string }>;
  exemptLessons?: ApplyLesson[];
}> {
  const info = await getStudentInfoCached();
  const raw = await postJson('/student/ws/for-std/custom-course-select-apply/check-can-apply', {
    applyType: input.applyType,
    semesterAssoc: input.semesterId,
    studentAssoc: info.studentId,
    bizTypeAssoc: 2,
    allApplys: input.allApplys,
    ...(input.exemptApplys?.length ? { exemptApplys: input.exemptApplys } : {}),
  });
  const res = parseJson<{
    result?: boolean;
    errors?: { allErrors?: Array<{ text?: string }> };
    conflictDataList?: Array<{ courseName?: string; code?: string; timePlace?: string }>;
    exemptLessons?: ApplyLesson[];
  }>(raw, '申请校验');
  if (res.result) {
    return {
      result: true,
      conflictDataList: res.conflictDataList ?? [],
      exemptLessons: res.exemptLessons ?? [],
    };
  }
  const text = res.errors?.allErrors?.map((e) => e.text ?? '').filter(Boolean).join('；');
  return { result: false, message: text || '申请校验未通过' };
}

/** 获取可选的审核人（按配置可能必须选择） */
export async function fetchAssignees(
  auditType: 'SELECT' | 'REVOKE' | 'EXCHANGE' | 'EXEMPT',
  allApplys: ApplyItem[],
): Promise<{ need: boolean; accounts: AccountOption[]; nextNode?: string }> {
  const lessonIds = allApplys
    .map((a) => a.newLessonAssoc ?? a.lessonAssoc)
    .filter(Boolean)
    .join(',');
  const info = await getStudentInfoCached();
  const raw = guard(
    await webFetch(
      `/student/for-std/course-select-apply/get-assignees?bizTypeId=2&auditType=${auditType}&findAssigneeJson=${encodeURIComponent(
        JSON.stringify({ newLessonIds: lessonIds }),
      )}`,
    ),
  );
  const res = parseJson<{ result?: boolean; accounts?: AccountOption[]; nextNode?: string }>(
    raw,
    '审核人',
  );
  return { need: !!res.result, accounts: res.accounts ?? [], nextNode: res.nextNode };
}

export interface SubmitApplyInput {
  semesterId: number;
  applyType: 'SELECT' | 'REVOKE' | 'EXCHANGE';
  applyReasonAssocs: number[];
  telephone?: string;
  email?: string;
  remark?: string;
  allApplys: ApplyItem[];
  exemptApplys?: ApplyItem[];
  assignAccountAssoc?: number | null;
}

/** 提交个性化选课申请（审核流程异步审批） */
export async function submitApply(input: SubmitApplyInput): Promise<SubmitResponse> {
  const info = await getStudentInfoCached();
  const raw = await postJson('/student/for-std/course-select-apply/apply', {
    bizTypeAssoc: 2,
    semesterAssoc: input.semesterId,
    studentAssoc: info.studentId,
    applyType: input.applyType,
    applyReasonAssocs: input.applyReasonAssocs,
    telephone: input.telephone ?? '',
    email: input.email ?? '',
    remark: input.remark ?? '',
    allApplys: input.allApplys,
    exemptApplys: input.exemptApplys ?? [],
    ...(input.assignAccountAssoc != null ? { assignAccountAssoc: input.assignAccountAssoc } : {}),
  });
  const res = parseJson<SubmitResponse>(raw, '提交结果');
  return res;
}

/** 检查当前能否取消某条申请 */
export async function checkCanCancel(id: number): Promise<boolean> {
  const raw = guard(await webFetch(`/student/for-std/course-select-apply/check-in-time?id=${id}`));
  const t = raw.trim();
  if (t === 'true' || t === 'false') return t === 'true';
  try {
    const res = JSON.parse(raw) as unknown;
    return !!res;
  } catch {
    return true;
  }
}

/** 取消申请 */
export async function cancelApply(ids: number[], currentURI: string): Promise<void> {
  const raw = await postForm('/student/for-std/course-select-apply/cancel', {
    REDIRECT_URL: currentURI,
    ids,
  });
  guard(raw);
}

/** 历史学期申请记录页解析 */
export async function fetchHistoryRows(semesterId: number): Promise<AppliedRow[]> {
  const info = await getStudentInfoCached();
  await ensureApplyContext();
  const raw = guard(
    await webFetch(
      `/student/for-std/course-select-apply/history-record?PARENT_URL=${encodeURIComponent(
        `/for-std/course-select-apply/${info.studentId}/switch/0/apply`,
      )}&semesterId=${semesterId}&studentId=${info.studentId}&bizTypeId=2`,
    ),
  );
  const tables = raw.match(/<table[^>]*>[\s\S]*?<\/table>/g) ?? [];
  for (const table of tables) {
    const rows = parseListTable(table);
    if (rows.length) return rows;
  }
  return [];
}

export function applyReasons(): Array<{ value: number; label: string }> {
  return [
    { value: 1, label: '转专业' },
    { value: 2, label: '海内交流' },
    { value: 3, label: '海外交流' },
    { value: 4, label: '海外留学' },
    { value: 5, label: '插班生' },
    { value: 6, label: '降级' },
    { value: 7, label: '延长学年' },
    { value: 8, label: '课程替代' },
    { value: 9, label: '其他' },
  ];
}

export function lessonTimePlace(l: ApplyLesson): string {
  const dtp = l.dateTimePlace as { textZh?: string; text?: string } | null | undefined;
  const text = dtp?.textZh || dtp?.text || '';
  if (text.trim()) return text.replace(/\n/g, '；').trim();
  const sg = l.scheduleGroups?.[0]?.dateTimePlace;
  const t2 = sg?.textZh || sg?.text || '';
  return t2.trim() ? t2.replace(/\n/g, '；').trim() : '时间地点待定';
}

export function lessonTeachers(l: ApplyLesson): string {
  return (l.teachers ?? []).map((t) => t.nameZh).filter(Boolean).join('、') || '未安排';
}

export function lessonCourseName(l: ApplyLesson): string {
  const c = l.course as { nameZh?: string; nameEn?: string } | null | undefined;
  const v = c?.nameZh || c?.nameEn;
  return v ? v : exportText(l.nameZh);
}

export function applyGroupKey(l: ApplyLesson): string {
  const c = l.course as { id?: number; code?: string } | null | undefined;
  return String(c?.id ?? l.id);
}
