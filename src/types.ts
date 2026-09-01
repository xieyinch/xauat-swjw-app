export interface Semester {
  id: number;
  nameZh: string;
  startDate?: string;
  endDate?: string;
}

export interface CourseLesson {
  id: number;
  nameZh: string;
  code: string;
  /** 例如「12~15周 周二 第七节~第八节 雁塔校区 南阶108 张三」 */
  scheduleText: string;
  teacher: string;
  timeText: string;
  placeText: string;
  /** 星期几，1=周一 … 7=周日（由 scheduleText 解析） */
  dayOfWeek?: number;
  /** 起始节次（由 scheduleText 解析） */
  startUnit?: number;
  /** 结束节次（由 scheduleText 解析） */
  endUnit?: number;
  /** 周次文本，如「1-16周」 */
  weekText: string;
}

export interface CourseTableData {
  semesterId: number;
  /** 总周数 */
  totalWeeks: number;
  /** 当前周次 */
  currentWeek: number;
  lessons: CourseLesson[];
}

export interface GradeItem {
  courseName: string;
  courseCode?: string;
  credits?: number;
  score: string;
  gradePoint?: number;
  passed?: boolean;
  published?: boolean;
  courseType?: string;
  semesterName: string;
}

export interface GradeData {
  semesterId: number;
  semesterName: string;
  items: GradeItem[];
}

export interface ExamItem {
  courseName: string;
  dateTime: string;
  place: string;
  building: string;
  campus: string;
  seatNo?: string;
}

export interface NoticeItem {
  id: string;
  title: string;
  date: string;
  /** 详情页相对路径 */
  href: string;
  url: string;
}

export interface StudentInfo {
  /** 学号 */
  stdNo: string;
  /** 姓名 */
  name: string;
  /** 教务系统内部学生 ID */
  studentId: number;
}

/** 学籍信息键值对（页面 10.01） */
export interface StudentInfoEntry {
  label: string;
  value: string;
}

/** 学籍信息分组（基本信息/录取信息/注册信息/异动信息/毕业信息/学位信息） */
export interface StudentInfoGroup {
  key: string;
  name: string;
  entries: StudentInfoEntry[];
}

/** 空闲教室条目（页面 02.03） */
export interface RoomFreeItem {
  campus: string;
  building: string;
  name: string;
  roomType: string;
  capacity?: number;
  /** 空闲时间段文本，如「第1-2节」 */
  timeText: string;
}

/** 空闲教室查询条件（页面 02.03） */
export interface RoomFreeQuery {
  campusId?: number | string;
  building?: string;
  roomType?: number | string;
  byWeek?: boolean;
  date?: string;
  units: string[];
  weeks: string[];
}

/** 全校开课课程条目（页面 02.04） */
export interface LessonSearchItem {
  id: number;
  code: string;
  nameZh: string;
  /** 教学班 */
  classes: string;
  credits?: number;
  teachers: string[];
  scheduleText: string;
  placeText: string;
}

/** 常用文件条目（页面 02.20） */
export interface CommonFileItem {
  id: number;
  name: string;
  category: string;
  publishDate: string;
  sizeText?: string;
  /** 下载相对路径 */
  downloadUrl: string;
}

/** 考试安排条目（页面 22.03） */
export interface ExamArrangeItem {
  id: number;
  courseName: string;
  timeText: string;
  place: string;
  seatNo?: string;
  building: string;
  campus: string;
}

/** 培养方案课程模块（页面 12.01，树形结构） */
export interface ProgramModule {
  id: number;
  name: string;
  typeName?: string;
  requireCredits?: number;
  passedCredits?: number;
  children: ProgramModule[];
}

/** 培养方案课程条目 */
export interface ProgramCourse {
  code: string;
  name: string;
  credits: number;
  semester?: string;
  courseType?: string;
  passed?: boolean;
  score?: string;
}

/** 培养方案完成情况（页面 12.03） */
export interface ProgramCompletion {
  passedCredits: number;
  failedCredits: number;
  requireCredits: number;
  passedModules: number;
  totalModules: number;
  outerPassedCredits?: number;
  passedCourses: ProgramCourse[];
  failedCourses: ProgramCourse[];
}

/** 班级课表（页面 14.11，聚合课程活动） */
export interface AdminClassCourse {
  lessonName: string;
  courseCode: string;
  courseName: string;
  credits: number;
  teachers: string[];
  courseType: string;
  scheduleText: string;
}

/** 等级考试批次条目（页面 22.15） */
export interface ExamSignupItem {
  batch: string;
  subject: string;
  place?: string;
  arrangement?: string;
  signupTime: string;
  fee?: string;
  payStatus?: string;
}

/** 等级考试成绩条目（页面 22.15） */
export interface ExamScoreItem {
  examType: string;
  subject: string;
  score: string;
  passed: string;
  certNo?: string;
}

/** 学业预警条目（页面 24.07） */
export interface PrecautionItem {
  courseCode: string;
  courseName: string;
  required: string;
  credits?: number;
  score: string;
  gradePoint?: string;
  checkResult: string;
}

/** 导师信息（页面 33.02） */
export interface TutorInfo {
  name: string;
  department: string;
  title?: string;
  tutorType?: string;
  period?: string;
  phone?: string;
  email?: string;
}

/** 导师互选结果条目（页面 33.03） */
export interface TutorSelectResult {
  stdNo: string;
  studentName: string;
  grade: string;
  department: string;
  major: string;
  tutorType: string;
  tutorName: string;
  tutorDepartment: string;
  period?: string;
}

/** 被评结果条目（页面 33.06） */
export interface EvaluationResult {
  id: number;
  courseName: string;
  /** 评价指标与得分 */
  scores: Array<{ name: string; score: string }>;
  totalScore?: string;
  comment?: string;
}

/** 评价导师记录（页面 33.04） */
export interface TutorEvaluation {
  id: number;
  semester: string;
  tutorName: string;
  tutorType: string;
  score: string;
  evaluateTime: string;
  publishState: string;
}

/** 授予学士学位申请记录（页面 10.14） */
export interface DegreeApplyRecord {
  id: number;
  semester: string;
  trainingType: string;
  grade: string;
  studentNo: string;
  studentName: string;
  college: string;
  major: string;
  auditState: string;
}

/** 导师变更申请记录（页面 33.05） */
export interface TutorChangeApply {
  id: number;
  semester: string;
  beforeTutor: string;
  afterTutor: string;
  tutorType: string;
  applyTime: string;
  reason: string;
  auditState: string;
}

/** 指导过程记录（页面 33.07） */
export interface GuidanceRecord {
  name: string;
  detail: string;
  content: string;
  attendance: string;
}

/** 教务系统菜单中的单个功能项 */
export interface MenuFunction {
  id: string;
  parentId: string;
  title: string;
  href: string | null;
  permCode: string | null;
}

/** 教务系统菜单分类（一级菜单及其子功能） */
export interface MenuCategory {
  id: string;
  title: string;
  functions: MenuFunction[];
}
