import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

export type WidgetCourseSlot = {
  head: string;
  sub: string;
};

export type CourseWidgetPayload = {
  header: string;
  sub: string;
  leftTitle: string;
  rightTitle: string;
  left: WidgetCourseSlot[];
  right: WidgetCourseSlot[];
};

type CourseWidgetNativeModule = {
  updateCourseWidget: (payload: string) => Promise<void>;
  getDynamicColors: () => Promise<string | null>;
};

let nativeModule: CourseWidgetNativeModule | null = null;

try {
  if (Platform.OS === 'android') {
    nativeModule = requireNativeModule('CourseWidget');
  }
} catch {
  nativeModule = null;
}

export function updateCourseWidget(payload: CourseWidgetPayload): Promise<void> {
  if (!nativeModule) return Promise.resolve();
  try {
    return nativeModule.updateCourseWidget(JSON.stringify(payload));
  } catch {
    return Promise.resolve();
  }
}

/** Android 12+ Material You 动态强调色色板（tone -> #RRGGBB）；低版本返回 null */
export async function getDynamicColors(): Promise<Record<string, string> | null> {
  if (!nativeModule) return null;
  try {
    const raw = await nativeModule.getDynamicColors();
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}
