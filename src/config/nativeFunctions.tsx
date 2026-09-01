import React from 'react';
import type { MenuFunction } from '../types';
import { AdminClassTableScreen } from '../screens/functions/AdminClassTableScreen';
import { CommonFileScreen } from '../screens/functions/CommonFileScreen';
import { EvaluationResultScreen } from '../screens/functions/EvaluationResultScreen';
import { ExamArrangeScreen } from '../screens/functions/ExamArrangeScreen';
import { ExamSignupScreen } from '../screens/functions/ExamSignupScreen';
import { GuidanceRecordScreen } from '../screens/functions/GuidanceRecordScreen';
import { LessonSearchScreen } from '../screens/functions/LessonSearchScreen';
import { PrecautionScreen } from '../screens/functions/PrecautionScreen';
import { ProgramCompletionScreen } from '../screens/functions/ProgramCompletionScreen';
import { ProgramScreen } from '../screens/functions/ProgramScreen';
import { RoomFreeScreen } from '../screens/functions/RoomFreeScreen';
import { StudentInfoScreen } from '../screens/functions/StudentInfoScreen';
import { TutorScreen } from '../screens/functions/TutorScreen';
import { TutorSelectResultScreen } from '../screens/functions/TutorSelectResultScreen';
import { TutorEvaluationScreen } from '../screens/functions/TutorEvaluationScreen';
import { DegreeApplyScreen } from '../screens/functions/DegreeApplyScreen';
import { TutorChangeApplyScreen } from '../screens/functions/TutorChangeApplyScreen';

export interface NativeFunctionProps {
  onClose: () => void;
  onSessionExpired: () => void;
}

/** 已原生化的功能：key = permCode（优先）或 href 匹配 */
export const NATIVE_FUNCTIONS: Record<string, React.ComponentType<NativeFunctionProps>> = {
  'for-std-room-free:menu': RoomFreeScreen,
  'for-std-lesson-search:menu': LessonSearchScreen,
  'for-std-common-file:menu': CommonFileScreen,
  'for-std-student-info:menu': StudentInfoScreen,
  'for-std-program:menu': ProgramScreen,
  'for-std-program-completion-preview:menu': ProgramCompletionScreen,
  'for-std-adminclass-course-table:menu': AdminClassTableScreen,
  'for-std-other-exam-signup:menu': ExamSignupScreen,
  'for-std-exam-arrange:menu': ExamArrangeScreen,
  'for-std-precaution:menu': PrecautionScreen,
  'for-std-std-tutor-ware:menu': TutorScreen,
  'for-std-std-tutor-select-result:menu': TutorSelectResultScreen,
  'for-std-my-evaluation-result:menu': EvaluationResultScreen,
  'for-std-guidance-record:menu': GuidanceRecordScreen,
  'for-std-evaluation-index-result:menu': TutorEvaluationScreen,
  'for-std-degree-apply:menu': DegreeApplyScreen,
  'for-std-tutor-change-apply:menu': TutorChangeApplyScreen,
};

/** 按 href 匹配（与 permCode 一致时的兜底） */
const HREF_TO_CODE: Record<string, string> = {
  '/student/for-std/room-free': 'for-std-room-free:menu',
  '/student/for-std/lesson-search': 'for-std-lesson-search:menu',
  '/student/for-std/common-file': 'for-std-common-file:menu',
  '/student/for-std/student-info': 'for-std-student-info:menu',
  '/student/for-std/program': 'for-std-program:menu',
  '/student/for-std/program-completion-preview': 'for-std-program-completion-preview:menu',
  '/student/for-std/adminclass-course-table': 'for-std-adminclass-course-table:menu',
  '/student/for-std/other-exam-signup': 'for-std-other-exam-signup:menu',
  '/student/for-std/exam-arrange': 'for-std-exam-arrange:menu',
  '/student/for-std/precaution': 'for-std-precaution:menu',
  '/student/for-std/select/std-tutor-ware': 'for-std-std-tutor-ware:menu',
  '/student/for-std/select/std-tutor-select-result': 'for-std-std-tutor-select-result:menu',
  '/student/for-std/my-evaluation-result': 'for-std-my-evaluation-result:menu',
  '/student/for-std/guidance-record': 'for-std-guidance-record:menu',
  '/student/for-std/evaluation-index-result': 'for-std-evaluation-index-result:menu',
  '/student/for-std/degree-apply': 'for-std-degree-apply:menu',
  '/student/for-std/tutor-change-apply': 'for-std-tutor-change-apply:menu',
};

export function isNativeFunction(fn: MenuFunction): boolean {
  const code = fn.permCode ?? '';
  if (NATIVE_FUNCTIONS[code]) return true;
  if (fn.href && HREF_TO_CODE[fn.href]) return true;
  return false;
}

export function nativeComponentFor(fn: MenuFunction): React.ComponentType<NativeFunctionProps> | null {
  const code = fn.permCode ?? '';
  if (NATIVE_FUNCTIONS[code]) return NATIVE_FUNCTIONS[code];
  if (fn.href && HREF_TO_CODE[fn.href]) return NATIVE_FUNCTIONS[HREF_TO_CODE[fn.href]] ?? null;
  return null;
}
