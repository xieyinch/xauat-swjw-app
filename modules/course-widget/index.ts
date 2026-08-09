import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

export type CourseWidgetPayload = {
  header: string;
  rows: string[];
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
