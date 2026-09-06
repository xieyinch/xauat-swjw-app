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
