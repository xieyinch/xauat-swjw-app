import CookieManager from '@react-native-cookies/cookies';
import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';
import { ANDROID_CHROME_USER_AGENT, SITE } from '../config/site';
import { SessionExpiredError } from './data';

export const TIMELY_EVALUATION_PATH = '/student/for-std/evaluation/timely';
export const SUMMATIVE_EVALUATION_PATH = '/student/for-std/evaluation/summative';
const SUMMATIVE_API = '/student/summative-evaluation';
const API_BASE = SITE.swjw + '/evaluation-student-backend/api/v1';
const RESULT_PATH = '/student/immediate-evaluation/result';
type Id = number | string;
type Named = { nameZh: string };

export type EvaluationTask = {
  lesson: { id: Id; course: Named; code: string };
  evaluatedTeacher: { person: Named & { id: Id }; teacher: { id: Id } | null };
  schedule: { dateStr: string; unittimeBegin: number; unittimeEnd: number; room: Named | null };
  surveies: { id: Id; nameZh: string }[];
};

export type EvaluationWeek = {
  week: number;
  startDate: string;
  endDate: string;
  studentImmediateTasks: EvaluationTask[];
};

type Question = {
  id: Id;
  title: string;
  indexNo: number;
  required?: boolean;
  options?: { name: string; customize?: boolean; score?: number }[];
  maxOptionCount?: number;
  maxLength?: number;
  count?: number;
  score?: number;
  fillInBlankOptions?: { name: string }[];
};

const questionGroups = {
  headers: 'header',
  radioQuestions: 'radio',
  multipleQuestions: 'multiple',
  blankQuestions: 'blank',
  markQuestions: 'mark',
  fillInBlankQuestions: 'mulblank',
  fileUploadQuestions: 'upload',
} as const;

export type SurveyQuestion = Question & { type: (typeof questionGroups)[keyof typeof questionGroups] };
export type EvaluationSurvey = Partial<Record<keyof typeof questionGroups, Question[]>> & {
  nameZh: string;
  description?: string;
  scoring?: boolean;
  radioQuestionContradictions?: {
    lhsRadioQuestionId: Id;
    rhsRadioQuestionId: Id;
    lhsRadioQuestionOptions: string[];
    rhsRadioQuestionOptions: string[];
  }[];
};
export type EvaluationAnswer = { selected?: string[]; custom?: Record<string, string>; text?: string; blanks?: string[]; rating?: number };

function request(url: string, init?: Parameters<typeof fetch>[1]) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(20000), redirect: 'manual', credentials: 'omit' });
}

async function api<T>(path: string, token?: string, body?: FormData | string, post = false): Promise<T> {
  const response = await request(API_BASE + path, {
    method: post || body ? 'POST' : 'GET',
    body,
    headers: {
      Accept: 'application/json',
      ...(typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      'User-Agent': ANDROID_CHROME_USER_AGENT,
      ...(token ? { Authorization: token } : {}),
    },
  });
  if (response.status === 401) throw new SessionExpiredError();
  if (!response.headers.get('content-type')?.includes('json')) {
    throw new Error('评教接口返回了无法识别的响应');
  }
  const payload = await response.json() as { result: number | boolean; data: T; message?: string };
  if (!response.ok || payload.result || !('result' in payload)) {
    throw new Error(payload.message || '评教请求失败');
  }
  return payload.data;
}

export async function fetchEvaluationSession(path = TIMELY_EVALUATION_PATH) {
  const entry = SITE.swjw + path;
  const cookies = await CookieManager.get(entry, Platform.OS === 'ios');
  const cookieHeader = Object.values(cookies).map(({ name, value }) => `${name}=${value}`).join('; ');
  if (!cookieHeader) throw new SessionExpiredError();

  // Read the same-origin SSO redirect without opening or executing the evaluation frontend.
  const response = await request(entry, {
    headers: { Cookie: cookieHeader, 'User-Agent': ANDROID_CHROME_USER_AGENT },
  });
  const location = response.headers.get('location');
  if (response.status === 401) throw new SessionExpiredError();
  if (!location) throw new Error('学校评教入口未返回登录跳转');

  const redirect = new URL(location, entry);
  if (redirect.hostname === new URL(SITE.authLogin).hostname || redirect.pathname === '/student/login') {
    throw new SessionExpiredError();
  }
  const prefix = '#/sso-login?';
  if (redirect.origin !== SITE.swjw || !/^\/evaluation-student-frontend\/?$/.test(redirect.pathname) || !redirect.hash.startsWith(prefix)) {
    throw new Error('学校评教登录跳转地址有变化');
  }
  const ticket = new URLSearchParams(redirect.hash.slice(prefix.length)).get('token');
  if (!ticket) throw new Error('学校评教入口未返回登录凭证');

  const account = await api<{ token: string }>('/evaluation/account/update-account-by-token?' + new URLSearchParams({ token: ticket }), undefined, undefined, true);
  if (!account?.token) throw new Error('学校评教系统未返回会话');
  return account.token;
}

export async function fetchEvaluationTasks() {
  const token = await fetchEvaluationSession();
  const semester = await api<{ id: Id }>('/evaluation/base/current-semester', token);
  if (semester?.id == null) throw new Error('学校评教系统未返回当前学期');
  const [weeks, permissions] = await Promise.all([
    api<EvaluationWeek[] | Record<string, EvaluationWeek> | null>('/student/immediate-evaluation/task/' + encodeURIComponent(semester.id), token),
    api<string[]>('/evaluation/permissions', token),
  ]);
  return { token, semesterId: semester.id, weeks: Object.values(weeks ?? {}).sort((a, b) => b.week - a.week), permissions };
}

export function fetchEvaluationSurvey(token: string, id: Id) {
  return api<EvaluationSurvey>('/evaluation/survey/' + encodeURIComponent(id), token);
}

export function surveyQuestions(survey: EvaluationSurvey): SurveyQuestion[] {
  return (Object.keys(questionGroups) as (keyof typeof questionGroups)[])
    .flatMap(group => (survey[group] ?? []).map(question => ({ ...question, type: questionGroups[group] })))
    .sort((a, b) => a.indexNo - b.indexNo);
}

export function buildEvaluationSubmission(
  task: EvaluationTask, surveyId: Id, survey: EvaluationSurvey,
  answers: Record<string, EvaluationAnswer>, anonymity: boolean,
) {
  const { lesson, evaluatedTeacher, schedule } = task;
  const fields = {
    surveyId, date: schedule.dateStr, lessonId: lesson.id, personId: evaluatedTeacher.person.id,
    teacherId: evaluatedTeacher.teacher?.id, unitBegin: schedule.unittimeBegin, unitEnd: schedule.unittimeEnd,
  };
  return buildSurveySubmission(fields, survey, answers, anonymity);
}

export function buildSurveySubmission(
  fields: Record<string, Id | undefined>, survey: EvaluationSurvey,
  answers: Record<string, EvaluationAnswer>, anonymity: boolean,
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value != null) form.append(key, String(value));
  }
  // Mirror the portal's multipart serialization. It omits the false anonymity field.
  if (anonymity) form.append('anonymity', 'true');
  let index = 0;
  let total = 0;
  for (const question of surveyQuestions(survey)) {
    if (question.type === 'header') continue;
    if (question.type === 'upload') throw new Error('此问卷含附件题，请通过教务网页完成');
    const answer = answers[question.id] ?? {};
    const selected = answer.selected ?? [];
    const optionResults = selected.map(name => {
      const option = question.options?.find(item => item.name === name);
      const value = option?.customize ? answer.custom?.[name]?.trim() : name;
      if (!value) throw new Error(`请填写「${question.title}」的自定义选项`);
      return value;
    });
    if (question.maxOptionCount && selected.length > question.maxOptionCount) {
      throw new Error(`「${question.title}」最多选 ${question.maxOptionCount} 项`);
    }
    const blanks = (question.fillInBlankOptions ?? []).map((_, i) => answer.blanks?.[i]?.trim() ?? '');
    const result = question.type === 'mark' ? '' : answer.text?.trim() || optionResults.join('<br/>');
    const score = question.type === 'mark'
      ? Number(((answer.rating ?? 0) / (question.count || 1) * (question.score ?? 0)).toFixed(6))
      : question.type === 'radio' ? question.options?.find(option => option.name === selected[0])?.score ?? 0 : 0;
    const answered = Boolean(result || answer.rating || blanks.some(Boolean));
    if (question.required && (!answered || blanks.some(value => !value))) {
      throw new Error(`请完成「${question.title}」`);
    }
    if (!answered) continue;
    const prefix = `answers[${index++}]`;
    form.append(prefix + '.questionId', String(question.id));
    form.append(prefix + '.questionTitle', question.title);
    if (result) form.append(prefix + '.result', result);
    if (score) form.append(prefix + '.score', String(score));
    if (question.type === 'multiple') form.append(prefix + '.checkedArr', selected.join(','));
    if (question.type === 'radio') form.append(prefix + '.radioName', selected[0]);
    blanks.forEach((value, i) => {
      const child = `${prefix}.fillInBlankChildAnswers[${i}]`;
      form.append(child + '.questionId', String(question.id));
      form.append(child + '.questionTitle', question.fillInBlankOptions![i].name);
      form.append(child + '.result', value);
      form.append(child + '.childAnswerIndex', String(i));
    });
    total += score;
  }
  for (const rule of survey.radioQuestionContradictions ?? []) {
    const left = answers[rule.lhsRadioQuestionId]?.selected?.[0];
    const right = answers[rule.rhsRadioQuestionId]?.selected?.[0];
    if (left && right && rule.lhsRadioQuestionOptions.includes(left) && rule.rhsRadioQuestionOptions.includes(right)) {
      throw new Error(`选项「${left}」与「${right}」冲突，请重新选择`);
    }
  }
  if (survey.scoring && total) form.append('score', String(Number(total.toFixed(6))));
  return form;
}

export function submitEvaluation(token: string, form: FormData) {
  return api<unknown>(RESULT_PATH, token, form);
}

export type EvaluationResult = {
  id: Id;
  date: string;
  lesson: { course: Named; code: string };
  person: Named;
};
type EvaluationResultDetail = {
  survey: Named;
  submitDateTime: string;
  displayConfig: { showQuestionScore?: boolean; showMarkScore?: boolean };
  answers: { questionTitle: string; questionType: string; questionResult: string; count?: number }[];
  feedbacks?: { updateTime: string; content: string }[];
};

export async function fetchEvaluationHistory(token: string, semesterId: Id) {
  const records = await api<EvaluationResult[] | null>('/student/immediate-evaluation/result-list/' + encodeURIComponent(semesterId), token);
  return (records ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));
}

export function fetchEvaluationResult(token: string, id: Id) {
  return api<EvaluationResultDetail>(RESULT_PATH + '/' + encodeURIComponent(id), token);
}

export type SummativeTask = {
  id: Id;
  lesson: EvaluationResult['lesson'];
  person: Named;
  date?: string;
  survey?: Named & { id: Id };
  surveyName?: string;
  timeLimit: boolean;
  submitted?: boolean;
  submitDateTime?: string;
  evaluatedTeacherType: string;
};
type EvaluationTerm = Named & { id: Id };
type SummativeConfig = {
  show?: boolean;
  time?: number;
  content?: string;
  intervalScoreEvaluations?: {
    intervalMinScore: number; intervalMaxScore: number; intervalScoreRate: number; scoreIncludes: boolean;
  }[];
  limitDetails?: { role: string; overCount: number; limitLine: number }[];
};

export async function fetchSummativeSession() {
  const token = await fetchEvaluationSession(SUMMATIVE_EVALUATION_PATH);
  const [current, terms, config, permissions] = await Promise.all([
    api<EvaluationTerm>('/evaluation/base/current-semester', token),
    api<EvaluationTerm[]>('/evaluation/base/semesters', token),
    api<SummativeConfig>(SUMMATIVE_API + '/config', token),
    api<string[]>('/evaluation/permissions', token),
  ]);
  const read = config.show ? await api<string | boolean>('/evaluation/account-setting/get-setting?keyPrefix=hasRead', token) : true;
  return { token, current, terms, config, permissions, read: read === true || read === 'true' };
}

export async function acknowledgeSummativeNotice(token: string) {
  await api<unknown>('/evaluation/account-setting/save-setting', token, JSON.stringify(['hasRead', true]));
}

export async function fetchSummativeTasks(token: string, term: Id) {
  const id = encodeURIComponent(term);
  const [tasks, results] = await Promise.all([
    api<SummativeTask[] | null>(SUMMATIVE_API + '/task/semester/' + id, token),
    api<SummativeTask[] | null>(SUMMATIVE_API + '/results/semester/' + id, token),
  ]);
  return { tasks: tasks ?? [], results: results ?? [] };
}

export async function fetchSummativeResult(token: string, id: Id) {
  const result = await api<EvaluationResultDetail & { scoreConfig: EvaluationResultDetail['displayConfig'] }>('/evaluation/summative/result/' + encodeURIComponent(id), token);
  return { ...result, displayConfig: result.scoreConfig };
}

export function submitSummativeEvaluation(token: string, form: FormData, anonymity: boolean) {
  const path = anonymity ? '/anonymity-result' : '/result';
  return api<unknown>(SUMMATIVE_API + path, token, form);
}
