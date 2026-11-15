import { Platform } from 'react-native';
import { SITE } from '../config/site';
import { portalRequest, schoolRequest, SessionExpiredError } from './portalClient';
import type { StoredCredentials } from './storage';

const authOrigin = new URL(SITE.authLogin).origin;
export const CAS_LOGIN_URL = SITE.authLogin + '?' + new URLSearchParams({ service: SITE.ssoService });

export class InteractiveLoginRequired extends Error {
  constructor() {
    super('学校要求在认证页面完成登录');
  }
}

function redirectTarget(location: string | null, from: URL) {
  if (!location) return null;
  const url = new URL(location, from);
  if (url.origin !== authOrigin && url.origin !== SITE.swjw) throw new InteractiveLoginRequired();
  return url;
}

async function authRequest(url: URL, body?: string) {
  return schoolRequest(url, body === undefined ? {} : {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: authOrigin,
      Referer: CAS_LOGIN_URL,
    },
  }, async response => ({
    status: response.status,
    location: response.headers.get('location'),
    html: await response.text(),
  }));
}

function attribute(tag: string, name: string) {
  return new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1] ?? '';
}

function decodeAttribute(value: string) {
  return value.replace(/&(amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (match, entity: string) => {
    switch (entity.toLowerCase()) {
      case 'amp': return '&';
      case 'quot': return '"';
      case 'apos': return "'";
      case 'lt': return '<';
      case 'gt': return '>';
      default: {
        const hex = entity[1].toLowerCase() === 'x';
        const code = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return code <= 0x10ffff ? String.fromCodePoint(code) : match;
      }
    }
  });
}

function encodePassword(password: string, salt: string) {
  const crypto = require('crypto-js');
  const alphabet = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
  const random = (length: number) => Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return crypto.AES.encrypt(
    random(64) + password,
    crypto.enc.Utf8.parse(salt),
    { iv: crypto.enc.Utf8.parse(random(16)), mode: crypto.mode.CBC, padding: crypto.pad.Pkcs7 },
  ).toString();
}

async function finishCasRedirects(first: URL) {
  let url = first;
  for (let remaining = 5; remaining > 0; remaining--) {
    if (url.origin === SITE.swjw && url.pathname === new URL(SITE.portal).pathname) {
      await portalRequest(SITE.portal);
      return;
    }
    if (url.origin !== SITE.swjw || url.pathname !== new URL(SITE.ssoService).pathname) break;
    const result = await authRequest(url);
    const next = redirectTarget(result.location, url);
    if (!next || result.status < 300 || result.status >= 400) break;
    url = next;
  }
  throw new InteractiveLoginRequired();
}

export async function signInToPortal(credentials?: StoredCredentials) {
  // The Android native HTTP client and authentication WebView share the same cookie store.
  if (Platform.OS !== 'android') throw new InteractiveLoginRequired();
  const login = new URL(CAS_LOGIN_URL);
  const initial = await authRequest(login);
  const redirect = redirectTarget(initial.location, login);
  if (initial.status >= 300 && initial.status < 400 && redirect) {
    await finishCasRedirects(redirect);
    return;
  }
  if (!credentials || initial.status !== 200) throw new InteractiveLoginRequired();

  const form = initial.html.match(/<form\b[^>]*\bid=["']pwdFromId["'][^>]*>([\s\S]*?)<\/form>/i)?.[1];
  if (!form || /_badCredentialsCount\s*=\s*["']0["']/.test(initial.html)) throw new InteractiveLoginRequired();
  const body = new URLSearchParams();
  let salt = '';
  for (const input of form.match(/<input\b[^>]*>/gi) ?? []) {
    if (attribute(input, 'type') !== 'hidden') continue;
    const name = attribute(input, 'name');
    const value = decodeAttribute(attribute(input, 'value'));
    if (attribute(input, 'id') === 'pwdEncryptSalt') salt = value.trim();
    if (name) body.set(name, value);
  }
  if (![16, 24, 32].includes(salt.length) || !body.get('execution') || !body.get('_eventId')) {
    throw new InteractiveLoginRequired();
  }

  const check = new URL('/authserver/checkNeedCaptcha.htl', authOrigin);
  check.search = new URLSearchParams({ username: credentials.stdNo }).toString();
  const captcha = await schoolRequest(check, { headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: CAS_LOGIN_URL } }, async response => {
    if (!response.ok) return true;
    const data = await response.json().catch(() => null) as { isNeed?: boolean } | null;
    return data?.isNeed !== false;
  });
  if (captcha) throw new InteractiveLoginRequired();

  body.set('username', credentials.stdNo);
  body.set('password', encodePassword(credentials.password, salt));
  body.set('captcha', '');
  body.set('rememberMe', 'true');
  const submitted = await authRequest(login, body.toString());
  const next = redirectTarget(submitted.location, login);
  if (submitted.status >= 300 && submitted.status < 400 && next) {
    await finishCasRedirects(next);
    return;
  }
  if (submitted.status === 401 || submitted.status === 403 || submitted.status === 200) {
    throw new InteractiveLoginRequired();
  }
  throw new SessionExpiredError();
}
