import { fetch } from 'expo/fetch';
import { ANDROID_CHROME_USER_AGENT } from '../config/site';

const LIBRARY_API = 'https://libspace.xauat.edu.cn/api/index';
type ReservationRules = Record<string, string | null>;

export async function fetchLibraryReservationRules() {
  const response = await fetch(LIBRARY_API + '/booking_rules', {
    method: 'POST',
    body: '{}',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': ANDROID_CHROME_USER_AGENT,
    },
    redirect: 'error',
    credentials: 'omit',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('无法读取图书馆预约规则');
  const result = await response.json() as { code: number | string; data?: ReservationRules };
  if (String(result.code) !== '1' || !result.data) throw new Error('图书馆预约规则暂不可用');
  return result.data;
}

export function reservationRuleText(html: string) {
  return html
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:nbsp|ensp|emsp);/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .split('\n').map(line => line.trim()).filter(Boolean);
}
