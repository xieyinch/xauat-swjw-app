import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import CookieManager from '@react-native-cookies/cookies';
import type { Cookie } from '@react-native-cookies/cookies';

const KEY_CARD_COOKIES = 'xauat:card-cookies';

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

/** 捕获身份码（一卡通支付平台）已登录会话 Cookie 并持久化。
 * 在登录成功、页面跳转后的导航回调里调用。传入固定 CARD_PAY_URL 域，
 * 配合延迟等待，确保 WebView 原生 Set-Cookie 处理完成后再读取。 */
export async function captureCardCookies(url: string): Promise<void> {
  try {
    // 等一拍，让原生 WebView 处理完 Set-Cookie 响应头再读取，避免拿到旧的
    await new Promise((r) => setTimeout(r, 1200));
    // 用固定身份码域名捕获（Cookie 挂在 ydfwpt.xauat.edu.cn 下）
    const cookies = await CookieManager.get(url, false);
    const values = Object.values(cookies).filter((c) => c && c.value);
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
    for (const c of cookies) {
      if (!c.name || !c.value) continue;
      await CookieManager.set(url, {
        name: c.name,
        value: c.value,
        domain: c.domain ?? url,
        path: c.path ?? '/',
        expires: c.expires,
        secure: c.secure ?? true,
      });
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