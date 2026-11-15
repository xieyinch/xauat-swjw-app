import CookieManager from '@react-native-cookies/cookies';
import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';
import { ANDROID_CHROME_USER_AGENT, SITE } from '../config/site';

export class SessionExpiredError extends Error {
  constructor() {
    super('登录已过期，请重新登录');
    this.name = 'SessionExpiredError';
  }
}

const active = new Set<AbortController>();
const authOrigin = new URL(SITE.authLogin).origin;

export function abortPortalRequests() {
  for (const controller of active) controller.abort();
}

export function isPortalLoginUrl(url: URL) {
  return url.origin === authOrigin || (url.origin === SITE.swjw && /^\/student\/login\/?$/.test(url.pathname));
}

export function isLoginPageText(text: string) {
  return /id=["'](?:pwdFromId|pwdEncryptSalt)["']|<title>\s*登入页面\s*<\/title>/.test(text.slice(0, 32000));
}

type RequestOptions = { method?: string; body?: string; headers?: Record<string, string> };

export async function schoolRequest<T>(url: URL, init: RequestOptions, read: (response: Awaited<ReturnType<typeof fetch>>) => Promise<T>) {
  if (url.origin !== SITE.swjw && url.origin !== authOrigin) throw new Error('学校请求地址无效');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  active.add(controller);
  try {
    const headers = new Headers(init.headers);
    headers.set('User-Agent', ANDROID_CHROME_USER_AGENT);
    // On Android Expo uses React Native's ForwardingCookieHandler, which shares the WebView cookie store.
    // On iOS the native HTTP and WKWebView cookie stores can be separate.
    if (Platform.OS === 'ios') {
      const cookies = await CookieManager.get(url.href, true);
      const value = Object.values(cookies).map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      if (value) headers.set('Cookie', value);
    }
    const response = await fetch(url.href, { ...init, headers, redirect: 'manual', signal: controller.signal });
    return await read(response);
  } catch (error) {
    if (controller.signal.aborted) throw new Error('教务请求已取消或超时');
    throw error;
  } finally {
    clearTimeout(timeout);
    active.delete(controller);
  }
}

export async function portalRequest(path: string, options: RequestOptions = {}): Promise<string> {
  let url = new URL(path, SITE.swjw);
  if (url.origin !== SITE.swjw || !url.pathname.startsWith('/student/')) {
    throw new Error('教务接口地址无效');
  }
  let init = options;
  for (let redirects = 0; redirects <= 5; redirects++) {
    const result = await schoolRequest(url, init, async response => ({
      status: response.status, ok: response.ok, location: response.headers.get('location'), body: await response.text(),
    }));
    if (result.status === 401 || isLoginPageText(result.body)) throw new SessionExpiredError();
    if (result.status >= 300 && result.status < 400 && result.location) {
      const next = new URL(result.location, url);
      if (isPortalLoginUrl(next)) throw new SessionExpiredError();
      if (next.origin !== SITE.swjw || !next.pathname.startsWith('/student/')) {
        throw new Error('教务接口跳转地址无效');
      }
      const method = (init.method ?? 'GET').toUpperCase();
      // Do not automatically replay a mutation on a redirect that keeps its request body.
      if (method !== 'GET' && method !== 'HEAD') {
        if (![301, 302, 303].includes(result.status)) throw new Error('教务操作遇到重定向，请核对结果');
        init = {};
      }
      url = next;
      continue;
    }
    if (!result.ok) throw new Error(`教务请求失败（HTTP ${result.status}）`);
    return result.body;
  }
  throw new Error('教务接口重定向次数过多');
}

export async function clearPortalCookies() {
  abortPortalRequests();
  if (Platform.OS === 'android') await CookieManager.clearAll();
  if (Platform.OS === 'ios') await Promise.all([CookieManager.clearAll(true), CookieManager.clearAll(false)]);
}
