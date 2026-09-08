import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import CookieManager from '@react-native-cookies/cookies';
import type { Cookie } from '@react-native-cookies/cookies';

const KEY_CARD_COOKIES = 'xauat:card-cookies';
const KEY_CARD_DIAG = 'xauat:card-cookies-diag';

async function setDiag(msg: string) {
  try {
    const store = pickStore();
    const prev = (await store.getItem(KEY_CARD_DIAG)) || '';
    await store.setItem(KEY_CARD_DIAG, `${new Date().toISOString()} ${msg}\n${prev.slice(0, 500)}`);
  } catch {
    // 忽略
  }
}

/** 读取最近一次捕获/恢复的诊断摘要（供身份码页显示） */
export async function getCardCookieDiag(): Promise<string> {
  try {
    const store = pickStore();
    return (await store.getItem(KEY_CARD_DIAG)) || '';
  } catch {
    return '';
  }
}

function pickStore(): {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
} {
  if (Platform.OS === 'web') {
    return {
      getItem: async (k) => {
        try {
          return (await import('@react-native-async-storage/async-storage')).default.getItem(k);
        } catch {
          return null;
        }
      },
      setItem: async (k, v) => {
        try {
          await (await import('@react-native-async-storage/async-storage')).default.setItem(k, v);
        } catch {
          // 忽略
        }
      },
    };
  }
  return {
    getItem: async (k) => {
      try {
        return await SecureStore.getItemAsync(k);
      } catch {
        return null;
      }
    },
    setItem: async (k, v) => {
      try {
        await SecureStore.setItemAsync(k, v);
      } catch {
        // 忽略
      }
    },
  };
}

/**
 * 身份码（一卡通缴费平台 ydfwpt）有独立的服务端会话，退出 App 重启后会失效。
 * 这里把已登录会话的 Cookie 持久化下来，下次进入前恢复，避免每次重新登录。
 * 注意：CookieManager 的 get 在 Android 上会返回 HttpOnly Cookie，因此本方案适用于原生 APK 构建。
 */

/** 解析出站点的裸 host（如 ydfwpt.xauat.edu.cn）与带斜杠的 origin（如 https://ydfwpt.xauat.edu.cn/）。
 * Cookie 的 domain 必须用裸 host，不能带协议/路径；get/set 的 url 用 origin 才能命中全站 Cookie。 */
function splitUrl(url: string): { host: string; origin: string } {
  try {
    const u = new URL(url);
    return { host: u.hostname, origin: u.protocol + '//' + u.hostname + '/' };
  } catch {
    const m = url.match(/^https?:\/\/([^/]+)/);
    const host = m ? m[1] : url;
    return { host, origin: (m ? m[0] : 'https://' + host) + '/' };
  }
}

/** 把捕获到的 domain 规范化为裸 host；兼容存储里可能是完整 URL 的情况。 */
function toBareDomain(domain: string | undefined): string | undefined {
  if (!domain) return undefined;
  const m = domain.trim().match(/^https?:\/\/([^/]+)/);
  return (m ? m[1] : domain.trim()) || undefined;
}

/** 捕获身份码（一卡通支付平台）已登录会话 Cookie 并持久化。
 * 在登录成功、页面跳转后的导航回调里调用。传入固定 CARD_PAY_URL 域，
 * 配合延迟等待，确保 WebView 原生 Set-Cookie 处理完成后再读取。 */
export async function captureCardCookies(url: string): Promise<void> {
  try {
    // 用 origin（根路径）捕获，确保拿到挂在 host 下所有路径的会话 Cookie
    const { origin } = splitUrl(url);
    const cookies = await CookieManager.get(origin, false);
    const values = Object.values(cookies)
      .filter((c) => c && c.value)
      // 给缺失 domain 的 cookie 补上裸 host，避免恢复时用整段 URL 当 domain 导致设置失败
      .map((c) => ({ ...c, domain: c.domain || toBareDomain(origin) }));
    // 无条件写诊断（包括 n=0），用于区分「真的空」还是「根本没捕获到任何 cookie」
    await setDiag(`CAPTURE n=${values.length} names=${values.map((c) => c.name).join(',')} raw=${Object.keys(cookies).join(',')}`);
    console.log('[cardCookies] capture url=' + origin, 'count=' + values.length, 'names=' + values.map((c) => c.name).join(','));
    if (!values.length) return;
    const store = pickStore();
    await store.setItem(KEY_CARD_COOKIES, JSON.stringify(values));
  } catch {
    // 忽略
  }
}

/** 恢复已保存的身份码 Cookie（身份码 WebView 首次加载前调用） */
export async function restoreCardCookies(url: string): Promise<void> {
  try {
    const store = pickStore();
    const raw = await store.getItem(KEY_CARD_COOKIES);
    if (!raw) return;
    const cookies = JSON.parse(raw) as Cookie[];
    if (!Array.isArray(cookies)) return;
    // 诊断：确认恢复时从存储读到的会话 Cookie 数量与名称
    console.log('[cardCookies] restore url=' + url, 'count=' + cookies.length, 'names=' + cookies.map((c) => c.name).join(','));
    // 用 origin 作为设置 url、裸 host 作为 domain，确保全站子路径（含 /plat/pay）都能共享
    const { host, origin } = splitUrl(url);
    let setOk = 0;
    for (const c of cookies) {
      if (!c.name || !c.value) continue;
      // 若捕获时是会话 Cookie（无 expires），set 回去仍是会话 Cookie，
      // 只在原生 CookieManager 内存中，进程被系统杀掉后即丢失。
      // 这里补一个远期 expires，强制持久化到磁盘，保证跨 App 重启仍生效。
      const expires =
        c.expires ||
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
      const ok = await CookieManager.set(origin, {
        name: c.name,
        value: c.value,
        // domain 必须是裸 host；优先用捕获值（已规范化），否则回退当前站点 host
        domain: toBareDomain(c.domain) ?? host,
        path: c.path || '/',
        expires,
        secure: c.secure ?? true,
      });
      if (ok) setOk++;
    }
    await setDiag(`RESTORE n=${cookies.length} setOk=${setOk} names=${cookies.map((c) => c.name).join(',')}`);
    // Android 上强制把内存中的 Cookie 落盘到持久化存储
    if (Platform.OS === 'android') {
      try {
        await CookieManager.flush();
      } catch {
        // 忽略
      }
    }
  } catch {
    // 忽略
  }
}

/** 清空已保存的身份码 Cookie（退出登录时调用） */
export async function clearCardCookies(): Promise<void> {
  try {
    const store = pickStore();
    await store.setItem(KEY_CARD_COOKIES, JSON.stringify([]));
  } catch {
    // 忽略
  }
}