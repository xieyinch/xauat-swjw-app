import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as base } from './theme';

export type Palette = typeof base;
const palette = (accent: string, dark: string, bg: string, soft: string, ink: string, secondary: string): Palette => ({
  ...base, primary: accent, primaryDark: dark, primarySoft: soft, primaryWash: soft + '70', background: bg,
  text: ink, textSecondary: secondary, border: accent + '38', borderStrong: accent + '99', muted: soft,
  secondary: soft, gold: accent, terracotta: dark, terracottaSoft: soft, success: dark, successSoft: soft,
  heroGlowSoft: accent + '28', surface: bg + 'C4', surfaceTranslucent: bg + 'AD',
});
export const THEMES = [
  { id: 'dawn', name: '晨曦', detail: '杏桃微光 · 暖色玻璃', colors: base, gradient: ['#FBEFDE', '#F1D5C4', '#F9F2E7'] as const },
  { id: 'forest', name: '林间', detail: '苔绿叶影 · 柔和呼吸', colors: palette('#547C56','#345339','#F0F3E6','#D7E4C9','#273B2A','#647763'), gradient: ['#F4F4DE','#C9DAC4','#E9F0DE'] as const },
  { id: 'sea', name: '晴海', detail: '浅青海风 · 奶油沙岸', colors: palette('#3F7A83','#2B5760','#EEF4EE','#D0E5DF','#263E43','#60797C'), gradient: ['#FAEED9','#CCE4DF','#E9F1EE'] as const },
  { id: 'sakura', name: '暮樱', detail: '玫瑰晚霞 · 柔粉微光', colors: palette('#A05E73','#773E53','#FBEDF0','#F0D5DF','#4D303C','#8A6877'), gradient: ['#FCEEDC','#EDCFDC','#F5EAF1'] as const },
  { id: 'sand', name: '月砂', detail: '燕麦奶白 · 安静留白', colors: palette('#80704E','#5C503B','#F2EEE4','#E3DBC9','#3C372D','#7C7565'), gradient: ['#F8F3E9','#DCD6C7','#F0EDE5'] as const },
];
export type Preferences = { theme: string; wallpaper: string | null; blur: number; tone: 1 | 2; pet: boolean; greeting: boolean; reminders: boolean; classTimes: string };
const defaults: Preferences = { theme: 'dawn', wallpaper: null, blur: 24, tone: 1, pet: true, greeting: true, reminders: false, classTimes: '' };
const KEY = 'xauat.appearance.v1';
const Context = createContext({ preferences: defaults, theme: THEMES[0], update: (_: Partial<Preferences>) => {}, ready: false });
export function AppearanceProvider({ children }: React.PropsWithChildren) {
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);
  const pending = useRef(Promise.resolve());
  useEffect(() => { AsyncStorage.getItem(KEY).then(raw => {
    if (raw) { const saved = JSON.parse(raw); setPreferences({ ...defaults, ...saved, tone: saved.tone === 2 ? 2 : 1 }); }
  }).catch(() => {}).finally(() => setReady(true)); }, []);
  const update = (patch: Partial<Preferences>) => setPreferences(previous => {
    const next = { ...previous, ...patch };
    pending.current = pending.current.catch(() => {}).then(() => AsyncStorage.setItem(KEY, JSON.stringify(next)));
    return next;
  });
  return <Context.Provider value={{ preferences, theme: THEMES.find(t => t.id === preferences.theme) || THEMES[0], update, ready }}>{children}</Context.Provider>;
}
export const useAppearance = () => useContext(Context);
export const useThemeColors = () => useAppearance().theme.colors;
