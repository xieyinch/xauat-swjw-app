import { SITE } from '../config/site';

export const EVALUATION_FRONTEND_PATH = '/evaluation-student-frontend/';

export function evaluationTicket(target: URL) {
  const prefix = '#/sso-login?';
  if (target.origin !== SITE.swjw || !/^\/evaluation-student-frontend\/?$/.test(target.pathname) || !target.hash.startsWith(prefix)) {
    return null;
  }
  return new URLSearchParams(target.hash.slice(prefix.length)).get('token');
}

type Pending = {
  entry: string;
  result: Promise<string>;
  finish: (ticket?: string) => void;
};

let pending: Pending | null = null;
const listeners = new Set<() => void>();

export function subscribeEvaluationSignIn(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function currentEvaluationSignIn() {
  return pending;
}

export function requestEvaluationSignIn(entry: URL): Promise<string> {
  if (entry.origin !== SITE.swjw || !entry.pathname.startsWith('/student/')) {
    return Promise.reject(new Error('评教认证地址无效'));
  }
  if (pending) {
    if (pending.entry === entry.href) return pending.result;
    return Promise.reject(new Error('另一个评教认证请求正在运行'));
  }
  if (!listeners.size) return Promise.reject(new Error('评教认证页面已关闭'));

  let resolve!: (ticket: string) => void;
  let reject!: (error: Error) => void;
  const result = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  const job: Pending = {
    entry: entry.href,
    result,
    finish(ticket) {
      if (pending !== job) return;
      clearTimeout(timer);
      pending = null;
      for (const listener of listeners) listener();
      if (ticket) resolve(ticket);
      else reject(new Error('学校评教入口未完成单点登录，可以重试或打开教务网页'));
    },
  };
  const timer = setTimeout(() => job.finish(), 15000);
  pending = job;
  for (const listener of listeners) listener();
  return result;
}
