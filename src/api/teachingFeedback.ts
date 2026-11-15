import { evaluationRequest, fetchEvaluationSession } from './timelyEvaluation';

export const TEACHING_FEEDBACK_PATH = '/student/for-std/teaching-feedback';
const ROOT = '/student/teaching-feedback';
type Id = string | number;
type Named = { id: Id; nameZh: string };

export type FeedbackCategory = Named & { departmentSource?: string; bizTypeAssoc?: Id };
export type FeedbackRecord = {
  id: Id;
  questionFirstCategory: Named;
  questionSecondCategory: Named;
  departmentVm?: Named;
  submitDateTime?: string;
  feedbackContent?: string;
  solution?: string;
  status: string;
  file?: { id: Id; name: string };
};

export async function fetchFeedbackSession() {
  const token = await fetchEvaluationSession(TEACHING_FEEDBACK_PATH);
  const [current, terms, permissions] = await Promise.all([
    evaluationRequest<Named>('/evaluation/base/current-semester', token),
    evaluationRequest<Named[]>('/evaluation/base/semesters', token),
    evaluationRequest<string[]>('/evaluation/permissions', token),
  ]);
  return { token, current, terms, canWrite: permissions.includes('for-std-teaching-feedback:feedback') };
}

export async function fetchFeedbackTerm(token: string, semester: Id) {
  const term = encodeURIComponent(semester);
  const [records, canProcess] = await Promise.all([
    evaluationRequest<FeedbackRecord[] | null>(ROOT + '/get-records/' + term, token),
    evaluationRequest<boolean>(ROOT + '/can-process/' + term, token),
  ]);
  return { records: records ?? [], canProcess: canProcess === true };
}

export function fetchFeedbackCategories(token: string, parent?: Id) {
  const path = parent == null ? '/get-first-category' : '/get-second-category/' + encodeURIComponent(parent);
  return evaluationRequest<FeedbackCategory[]>(ROOT + path, token);
}

export function fetchFeedbackDepartments(token: string, bizType: Id) {
  return evaluationRequest<Named[]>(ROOT + '/get-all-departments/' + encodeURIComponent(bizType), token);
}

export async function submitFeedback(token: string, input: {
  term: Id; first: Id; second: Id; department?: Id; content: string;
  attachment?: { file: Blob; name: string }; existing?: FeedbackRecord;
}) {
  const term = encodeURIComponent(input.term);
  const duplicateCheck = new FormData();
  duplicateCheck.append('content', input.content);
  if (await evaluationRequest<boolean>(ROOT + '/check-repeat-content/' + term, token, duplicateCheck)) {
    throw new Error('本学期已有相同的反馈内容');
  }
  const form = new FormData();
  form.append('semesterAssoc', String(input.term));
  form.append('questionFirstCategoryAssoc', String(input.first));
  form.append('questionSecondCategoryAssoc', String(input.second));
  form.append('feedbackContent', input.content);
  if (input.department != null) form.append('assignDepartmentAssoc', String(input.department));
  if (input.existing) form.append('id', String(input.existing.id));
  if (input.attachment) form.append('attachment', input.attachment.file, input.attachment.name);
  else if (input.existing?.file) form.append('oldFileInfoAssoc', String(input.existing.file.id));
  await evaluationRequest<unknown>(ROOT + (input.existing ? '/update/' : '/submit/') + term, token, form);
}

export async function changeFeedback(token: string, semester: Id, id: Id, action: 'withdraw' | 'delete') {
  const record = encodeURIComponent(id);
  if (action === 'withdraw' && !await evaluationRequest<boolean>(ROOT + '/check-can-withdraw/' + record, token, undefined, true)) {
    throw new Error('学校当前不允许撤回该条反馈');
  }
  const form = new FormData();
  form.append('id', String(id));
  form.append('semesterId', String(semester));
  await evaluationRequest<unknown>(ROOT + '/' + action + '/' + record, token, form);
}

export function fetchFeedbackDetail(token: string, id: Id) {
  const form = new FormData();
  form.append('id', String(id));
  return evaluationRequest<{
    teachingFeedbackTask: FeedbackRecord;
    openResult?: boolean;
    teachingFeedbackSolution?: { solution?: string; fileInfo?: { id: Id; name: string } };
  } | null>(ROOT + '/info/' + encodeURIComponent(id), token, form);
}

export async function fetchFeedbackAttachmentUrl(token: string, id: Id) {
  const raw = await evaluationRequest<string>('/evaluation/preview/' + encodeURIComponent(id), token);
  const url = new URL(raw, 'https://swjw.xauat.edu.cn');
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('学校返回了无效的附件地址');
  return url.href;
}
