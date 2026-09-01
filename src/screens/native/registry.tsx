import React from 'react';
import type { MenuFunction } from '../../types';
import { CommonFileScreen } from './CommonFileScreen';
import { PrecautionScreen } from './PrecautionScreen';
import { ProgramScreen } from './ProgramScreen';
import { StudentInfoScreen } from './StudentInfoScreen';
import { TutorSelectResultScreen } from './TutorSelectResultScreen';

export interface NativePageProps {
  fn: MenuFunction;
  onClose: () => void;
  onSessionExpired: () => void;
}

type ComponentType = React.ComponentType<NativePageProps>;

/** 「全部」中已原生重构的功能项：href 片段 → 组件 */
export const NATIVE_PAGES: Array<{ match: string | string[]; component: ComponentType }> = [
  { match: '/student/for-std/common-file', component: CommonFileScreen },
  { match: '/student/for-std/student-info', component: StudentInfoScreen },
  { match: '/student/for-std/program', component: ProgramScreen },
  { match: '/student/for-std/precaution', component: PrecautionScreen },
  { match: '/student/for-std/select/std-tutor-select-result', component: TutorSelectResultScreen },
];

/** 根据菜单项找到原生实现组件；未实现返回 null（走 WebView 兜底） */
export function nativePageFor(fn: MenuFunction): ComponentType | null {
  const href = (fn.href ?? '').split('?')[0];
  for (const entry of NATIVE_PAGES) {
    const matches = Array.isArray(entry.match) ? entry.match : [entry.match];
    if (matches.some((m) => href === m)) return entry.component;
  }
  return null;
}
