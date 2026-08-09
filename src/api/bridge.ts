import type { WebView } from 'react-native-webview';

type Pending = {
  resolve: (text: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

let webview: WebView | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

const TIMEOUT = 30000;

export function attachWebView(wv: WebView | null) {
  webview = wv;
}

export function isWebViewReady() {
  return webview != null;
}

let ready = false;
const readyWaiters: Array<() => void> = [];

/** 页面加载完成后标记数据桥就绪（之后 webFetch 才会真正注入执行） */
export function markWebReady() {
  ready = true;
  const waiters = readyWaiters.splice(0);
  for (const w of waiters) w();
}

/** 会话重建（重新登录/切换页面）后重置就绪标记，等待新页面加载完成 */
export function resetWebReady() {
  ready = false;
  readyWaiters.splice(0);
}

/** 等待数据桥就绪；就绪后立即 resolve */
export function webFetchReady(): Promise<void> {
  if (ready) return Promise.resolve();
  return new Promise((resolve) => {
    readyWaiters.push(resolve);
  });
}

export function handleWebViewMessage(event: { nativeEvent: { data: string } }) {
  let msg: unknown;
  try {
    msg = JSON.parse(event.nativeEvent.data);
  } catch {
    return;
  }
  if (typeof msg !== 'object' || msg === null) return;
  const id = (msg as { __t?: unknown }).__t;
  if (typeof id !== 'number') return;
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  clearTimeout(p.timer);
  const m = msg as { ok?: boolean; d?: string; e?: string };
  if (m.ok) {
    p.resolve(m.d ?? '');
  } else {
    p.reject(new Error(m.e || '请求失败'));
  }
}

/**
 * 在常驻 WebView（swjw 域）内发起 fetch，自动携带登录 Cookie（含 HttpOnly SESSION）。
 */
export function webFetch(
  path: string,
  init?: { method?: string; body?: string; headers?: Record<string, string> },
): Promise<string> {
  return webFetchReady().then(
    () =>
      new Promise<string>((resolve, reject) => {
        if (!webview) {
          reject(new Error('教务会话尚未就绪，请先登录'));
          return;
        }
        const id = ++seq;
        const timer = setTimeout(() => {
          const p = pending.get(id);
          if (p) {
            pending.delete(id);
            p.reject(new Error('请求超时'));
          }
        }, TIMEOUT);
        pending.set(id, { resolve, reject, timer });

        const js = `
          (function () {
            var p = ${JSON.stringify(path)};
            var o = ${JSON.stringify(init || {})};
            fetch(p, o)
              .then(function (r) { return r.text(); })
              .then(function (t) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ __t: ${id}, ok: true, d: t }));
              })
              .catch(function (e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ __t: ${id}, ok: false, e: String((e && e.message) || e) }));
              });
          })(); true;
        `;
        webview.injectJavaScript(js);
      }),
  );
}

/** 判断一次数据请求的返回是否被重定向到了登录页（会话失效） */
export function isLoginPageText(text: string) {
  return /pwdEncryptSalt|authserver|请输入账号/.test(text.slice(0, 5000));
}
