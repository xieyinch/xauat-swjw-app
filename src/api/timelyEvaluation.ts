import { SITE } from '../config/site';
import { isLoginPageText, isPortalLoginUrl, portalRequest, schoolRequest, SessionExpiredError } from './portalClient';

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
export type EvaluationAnswer = { selected?: string[]; custom?: Record<string, string>; text?: string; blanks?: string[]; rating?: number; attachment?: { name: string; file: Blob } };

class EvaluationSessionError extends Error {
  constructor() {
    super('评教系统暂未通过认证，请重试或打开教务网页');
    this.name = 'EvaluationSessionError';
  }
}

export async function evaluationRequest<T>(path: string, token?: string, body?: FormData | string, post = false): Promise<T> {
  const url = new URL(API_BASE + path);
  return schoolRequest(url, {
    method: post || body ? 'POST' : 'GET',
    body,
    headers: {
      Accept: 'application/json',
      ...(typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: token } : {}),
    },
  }, async response => {
    const location = response.headers.get('location');
    if (response.status === 401 || (response.status >= 300 && response.status < 400 &&
        location && isPortalLoginUrl(new URL(location, url)))) {
      // This API uses a separate token. Its rejection says nothing about the portal session.
      throw new EvaluationSessionError();
    }
    if (!response.headers.get('content-type')?.includes('json')) {
      const text = await response.text();
      if (isLoginPageText(text)) throw new EvaluationSessionError();
      throw new Error('评教接口返回了无法识别的响应');
    }
    const payload = await response.json() as { result: number | boolean; data: T; message?: string };
    if (!response.ok || payload.result || !('result' in payload)) {
      throw new Error(payload.message || '评教请求失败');
    }
    return payload.data;
  });
}

function evaluationTicket(target: URL) {
  const prefix = '#/sso-login?';
  if (target.origin !== SITE.swjw || !/^\/evaluation-student-frontend\/?$/.test(target.pathname) || !target.hash.startsWith(prefix)) {
    return null;
  }
  return new URLSearchParams(target.hash.slice(prefix.length)).get('token');
}

function ticketFromLandingPage(body: string, entry: URL) {
  // A JS or meta redirect can be returned as HTML. Extract only a literal evaluation URL.
  const normalized = body
    .replace(/&amp;|&#0*38;|&#x0*26;/gi, '&')
    .replace(/\\(?:u0026|x26)/gi, '&')
    .replace(/\\\//g, '/');
  const destinations = normalized.matchAll(/(?:https?:)?(?:\/\/[^\s"'<>]+?)?\/evaluation-student-frontend\/?#\/sso-login\?[^\s"'<>]+/gi);
  for (const match of destinations) {
    try {
      const ticket = evaluationTicket(new URL(match[0], entry));
      if (ticket) return ticket;
    } catch {
      // An invalid candidate is not a login token.
    }
  }
  return null;
}

async function fetchEvaluationTicket(entry: URL) {
  let current = entry;
  for (let redirects = 0; redirects < 5; redirects++) {
    const response = await schoolRequest(current, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Referer: SITE.portal,
      },
    }, async result => ({
      status: result.status,
      ok: result.ok,
      location: result.headers.get('location'),
      body: await result.text(),
    }));
    if (response.status === 401 || isLoginPageText(response.body)) throw new EvaluationSessionError();
    if (response.status >= 300 && response.status < 400 && response.location) {
      const next = new URL(response.location, current);
      if (isPortalLoginUrl(next)) throw new EvaluationSessionError();
      const ticket = evaluationTicket(next);
      if (ticket) return ticket;
      // Follow only school portal intermediaries. Never send school cookies to outside URLs.
      if (next.origin !== SITE.swjw || !next.pathname.startsWith('/student/')) {
        throw new Error('学校评教登录跳转地址有变化');
      }
      current = next;
      continue;
    }
    if (!response.ok) throw new Error(`学校评教入口请求失败（HTTP ${response.status}）`);
    const ticket = ticketFromLandingPage(response.body, current);
    if (ticket) return ticket;
    throw new Error('学校评教入口未返回登录凭证，请重试或打开教务网页');
  }
  throw new Error('学校评教登录跳转次数过多');
}

export async function fetchEvaluationSession(path = TIMELY_EVALUATION_PATH) {
  let ticket: string;
  try {
    ticket = await fetchEvaluationTicket(new URL(path, SITE.swjw));
  } catch (error) {
    if (!(error instanceof EvaluationSessionError)) throw error;
    // Only the portal itself can confirm that the school account needs to sign in again.
    try {
      await portalRequest(SITE.portal);
    } catch (portalError) {
      if (portalError instanceof SessionExpiredError) throw portalError;
    }
    throw error;
  }
  const account = await evaluationRequest<{ token: string }>('/evaluation/account/update-account-by-token?' + new URLSearchParams({ token: ticket }), undefined, undefined, true);
  if (!account?.token) throw new Error('学校评教系统未返回会话');
  return account.token;
}

export async function fetchEvaluationTasks() {
  const token = await fetchEvaluationSession();
  const semester = await evaluationRequest<{ id: Id }>('/evaluation/base/current-semester', token);
  if (semester?.id == null) throw new Error('学校评教系统未返回当前学期');
  const [weeks, permissions] = await Promise.all([
    evaluationRequest<EvaluationWeek[] | Record<string, EvaluationWeek> | null>('/student/immediate-evaluation/task/' + encodeURIComponent(semester.id), token),
    evaluationRequest<string[]>('/evaluation/permissions', token),
  ]);
  return { token, semesterId: semester.id, weeks: Object.values(weeks ?? {}).sort((a, b) => b.week - a.week), permissions };
}

export function fetchEvaluationSurvey(token: string, id: Id) {
  return evaluationRequest<EvaluationSurvey>('/evaluation/survey/' + encodeURIComponent(id), token);
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

function collectSurveyAnswers(survey: EvaluationSurvey, answers: Record<string, EvaluationAnswer>) {
  const collected = [];
  for (const question of surveyQuestions(survey)) {
    if (question.type === 'header') continue;
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
    const answered = Boolean(result || answer.rating || answer.attachment || blanks.some(Boolean));
    if (question.required && (!answered || blanks.some(value => !value))) {
      throw new Error(`请完成「${question.title}」`);
    }
    if (!answered) continue;
    collected.push({
      questionId: question.id,
      questionTitle: question.title,
      result,
      score,
      checkedArr: question.type === 'multiple' ? selected : [],
      radioName: question.type === 'radio' ? selected[0] ?? '' : '',
      attachment: question.type === 'upload' ? answer.attachment : undefined,
      fillInBlankChildAnswers: blanks.map((value, i) => ({
        questionId: question.id, questionTitle: question.fillInBlankOptions![i].name, result: value, childAnswerIndex: i,
      })),
    });
  }
  for (const rule of survey.radioQuestionContradictions ?? []) {
    const left = answers[rule.lhsRadioQuestionId]?.selected?.[0];
    const right = answers[rule.rhsRadioQuestionId]?.selected?.[0];
    if (left && right && rule.lhsRadioQuestionOptions.includes(left) && rule.rhsRadioQuestionOptions.includes(right)) {
      throw new Error(`选项「${left}」与「${right}」冲突，请重新选择`);
    }
  }
  return collected;
}

export function buildSurveySubmission(
  fields: Record<string, Id | undefined>, survey: EvaluationSurvey,
  answers: Record<string, EvaluationAnswer>, anonymity: boolean,
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value != null) form.append(key, String(value));
  }
  if (anonymity) form.append('anonymity', 'true');
  const collected = collectSurveyAnswers(survey, answers);
  collected.forEach((answer, index) => {
    const prefix = `answers[${index}]`;
    form.append(prefix + '.questionId', String(answer.questionId));
    form.append(prefix + '.questionTitle', answer.questionTitle);
    if (answer.result) form.append(prefix + '.result', answer.result);
    if (answer.score) form.append(prefix + '.score', String(answer.score));
    if (answer.checkedArr.length) form.append(prefix + '.checkedArr', answer.checkedArr.join(','));
    if (answer.radioName) form.append(prefix + '.radioName', answer.radioName);
    if (answer.attachment) form.append(prefix + '.attachment', answer.attachment.file, answer.attachment.name);
    answer.fillInBlankChildAnswers.forEach((entry, i) => {
      const child = `${prefix}.fillInBlankChildAnswers[${i}]`;
      for (const [key, value] of Object.entries(entry)) form.append(child + '.' + key, String(value));
    });
  });
  const total = collected.reduce((sum, answer) => sum + answer.score, 0);
  if (survey.scoring && total) form.append('score', String(Number(total.toFixed(6))));
  return form;
}

export function buildSurveyGroupSubmission(
  taskId: Id, surveyId: Id, survey: EvaluationSurvey,
  answers: Record<string, EvaluationAnswer>, anonymity: boolean,
) {
  const list = collectSurveyAnswers(survey, answers);
  if (!list.length) throw new Error('请至少填写一份问卷');
  const entries = list.map(({ questionId, questionTitle, result, score, checkedArr, radioName }) =>
    ({ questionId, questionTitle, result, score, checkedArr, radioName }));
  return JSON.stringify([{ taskId, surveyId, anonymity, score: entries.reduce((sum, answer) => sum + answer.score, 0), answers: entries }]);
}

export function submitEvaluation(token: string, form: FormData) {
  return evaluationRequest<unknown>(RESULT_PATH, token, form);
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
  const records = await evaluationRequest<EvaluationResult[] | null>('/student/immediate-evaluation/result-list/' + encodeURIComponent(semesterId), token);
  return (records ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));
}

export function fetchEvaluationResult(token: string, id: Id) {
  return evaluationRequest<EvaluationResultDetail>(RESULT_PATH + '/' + encodeURIComponent(id), token);
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
    evaluationRequest<EvaluationTerm>('/evaluation/base/current-semester', token),
    evaluationRequest<EvaluationTerm[]>('/evaluation/base/semesters', token),
    evaluationRequest<SummativeConfig>(SUMMATIVE_API + '/config', token),
    evaluationRequest<string[]>('/evaluation/permissions', token),
  ]);
  const read = config.show ? await evaluationRequest<string | boolean>('/evaluation/account-setting/get-setting?keyPrefix=hasRead', token) : true;
  return { token, current, terms, config, permissions, read: read === true || read === 'true' };
}

export async function acknowledgeSummativeNotice(token: string) {
  await evaluationRequest<unknown>('/evaluation/account-setting/save-setting', token, JSON.stringify(['hasRead', true]));
}

export async function fetchSummativeTasks(token: string, term: Id, bySurvey = false) {
  const id = encodeURIComponent(term);
  const root = SUMMATIVE_API + (bySurvey ? '/survey-task' : '');
  const taskPath = bySurvey ? '/semester/' : '/task/semester/';
  const [tasks, results] = await Promise.all([
    evaluationRequest<SummativeTask[] | null>(root + taskPath + id, token),
    evaluationRequest<SummativeTask[] | null>(root + '/results/semester/' + id, token),
  ]);
  return { tasks: tasks ?? [], results: results ?? [] };
}

export async function fetchSummativeResult(token: string, id: Id) {
  const result = await evaluationRequest<EvaluationResultDetail & { scoreConfig: EvaluationResultDetail['displayConfig'] }>('/evaluation/summative/result/' + encodeURIComponent(id), token);
  return { ...result, displayConfig: result.scoreConfig };
}

export function submitSummativeEvaluation(token: string, form: FormData, anonymity: boolean) {
  const path = anonymity ? '/anonymity-result' : '/result';
  return evaluationRequest<unknown>(SUMMATIVE_API + path, token, form);
}

export async function fetchSummativeSurveyGroup(token: string, surveyId: Id, term: Id, taskId: Id): Promise<EvaluationSurvey> {
  const group = await evaluationRequest<{
    survey: EvaluationSurvey & { questions: (Question & { type: string; categoryName?: string })[] };
    taskList: SummativeTask[];
  }>(SUMMATIVE_API + '/survey-task/survey/' + encodeURIComponent(surveyId) + '/semester/' + encodeURIComponent(term), token);
  if (!group.taskList.some(task => String(task.id) === String(taskId) && task.timeLimit)) {
    throw new Error('该评教任务当前不可填写');
  }
  const { questions, ...survey } = group.survey;
  const groups = { RADIO: 'radioQuestions', MULTIPLE: 'multipleQuestions', MARK: 'markQuestions', BLANK: 'blankQuestions' } as const;
  const normalized: EvaluationSurvey = { ...survey, radioQuestions: [], multipleQuestions: [], markQuestions: [], blankQuestions: [] };
  for (const [index, question] of questions.entries()) {
    const key = groups[question.type as keyof typeof groups];
    if (!key) throw new Error('学校返回了暂未支持的问卷题型');
    normalized[key]?.push({ ...question, indexNo: question.indexNo ?? index });
  }
  return normalized;
}

export function submitSummativeSurveyGroup(token: string, body: string) {
  return evaluationRequest<unknown>(SUMMATIVE_API + '/survey-task/result', token, body);
}
