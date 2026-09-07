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

/** 捕获当前域下已登录的 Cookie 并保存（登录成功后调用） */
export async function captureCardCookies(url: string): Promise<void> {
  try {
    const cookies = await CookieManager.get(url, false);
    const values = Object.values(cookies).filter((c) => c && c.value);
    if (!values.length) return;
    const store = pickStore();
    await store.setItem(KEY_CARD_COOKIES, JSON.stringify(values));
  } catch {
    // 忽略
  }
}

/** 恢复已保存的身份码 Cookie（WebView 加载前调用） */
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