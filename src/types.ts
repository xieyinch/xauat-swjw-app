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
  /** 星期几，1=周一 … 7=周日 */
  dayOfWeek?: number;
  /** 起始节次 */
  startUnit?: number;
  /** 结束节次 */
  endUnit?: number;
  /** 周次文本，如「9~14」 */
  weekText: string;
  /** 上课地点，如「雁塔校区 南阶404」 */
  placeText: string;
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

/** 时间区间（后端 DateTimeRange 结构） */
export interface DateTimeRange {
  startDateTime?: string;
  endDateTime?: string;
  startTime?: string;
  endTime?: string;
}

/** 选课轮次条目（页面 10.09，ws open-turns） */
export interface CourseSelectTurn {
  id: number;
  name: string;
  bulletin: string | null;
  openDateTimeText: string;
  selectDateTimeText: string;
  dropDateTimeText: string;
  openDateTimeRange: DateTimeRange | null;
  selectDateTimeRange: DateTimeRange | null;
  dropDateTimeRange: DateTimeRange | null;
  /** 选课规则说明（文本行） */
  addRulesText: string[];
  /** 退课规则说明（文本行） */
  dropRulesText: string[];
  /** 当前是否允许进入 */
  allowEnter: boolean;
  disallowReasons: string[];
}

/** 个性化选课开关（ws open-switches 单元素） */
export interface CustomSelectSwitch {
  id: number;
  semester: { id: number; nameZh: string; code?: string };
  /** 选课申请开关 */
  selectOpen: boolean;
  selectDateTimeRange: DateTimeRange | null;
  /** 退课申请开关 */
  dropOpen: boolean;
  dropDateTimeRange: DateTimeRange | null;
  /** 换班申请开关 */
  exchangeOpen: boolean;
  exchangeDateTimeRange: DateTimeRange | null;
  selectBulletin: string | null;
  dropBulletin: string | null;
  exchangeBulletin: string | null;
}

/** 免修申请窗口信息（来自 applyIndex 页顶部服务端渲染文案） */
export interface ExemptApplyWindow {
  applyTimeText: string;
  bulletin: string;
}

/** 免修申请记录条目（applyIndex 表格行） */
export interface ExemptApplyRecord {
  courseText: string;
  semester: string;
  applyDate: string;
  reason: string;
  auditState: string;
}

/** 免修成绩条目（query-exempt-study-grade 片段表格行） */
export interface ExemptGradeItem {
  courseText: string;
  semester: string;
  grade: string;
  /** 是否加入成绩库 */
  inGradeBook: string;
}

/** 免修申请页聚合数据 */
export interface ExemptStudyData {
  window: ExemptApplyWindow | null;
  records: ExemptApplyRecord[];
  /** 当前业务学期 id（来自页面内联配置，用于新建申请跳转） */
  semesterId?: number;
}

// ---------- 通用申请类列表（缓考 / 课程替代 / 放弃成绩 / 意向导师） ----------

/** 申请类列表行：以键值对形式描述单元格 */
export interface FeatureApplyLine {
  label: string;
  value: string;
}

/** 申请类列表卡片行（title 为主标题，meta/status 用于角标） */
export interface FeatureApplyRow {
  /** 分组标签（如缓考申请按学期分组） */
  group?: string;
  title: string;
  meta?: string;
  status?: string;
  /** 可申请提示（如缓考「可申请」） */
  applyNote?: string;
  lines: FeatureApplyLine[];
}

/** 学籍异动申请「可申请」类型卡 */
export interface StdAlterationType {
  name: string;
  applyTimeText: string;
  notice: string;
  /** 是否有「立即申请」按钮 */
  canApply: boolean;
}

/** 学籍异动申请页聚合数据 */
export interface StdAlterationData {
  applyTypes: StdAlterationType[];
  /** 「已申请」页签提示文本（服务端原文，如「无已申请的学籍异动数据」） */
  appliedText: string;
}

/** 研究生推免信息（当前为服务端渲染的提示文案） */
export interface RecommendApplyInfo {
  note: string;
  bulletin: string;
}

// ---------- 学生选课（原生引擎） ----------

/** 教学班内课程概要 */
export interface CourseSelectLessonCourse {
  id: number;
  nameZh?: string;
  nameEn?: string;
  code?: string;
  credits?: number;
}

export interface SelectTeacher {
  id?: number;
  nameZh?: string;
}

/** dateTimePlace / scheduleGroup.dateTimePlace 的时间地点文案对象 */
export interface DateTimePlaceText {
  textZh?: string;
  textEn?: string;
  text?: string;
}

export interface CourseSelectSchedule {
  id?: number;
  no?: number;
  limitCount?: number;
  default?: boolean;
  dateTimePlace?: DateTimePlaceText;
}

/** 选课轮次教学班（addable-lessons chunk / selected-lessons 单元） */
export interface CourseSelectLesson {
  id: number;
  code?: string;
  nameZh?: string;
  nameEn?: string;
  course?: CourseSelectLessonCourse;
  teachers?: SelectTeacher[];
  dateTimePlace?: DateTimePlaceText;
  limitCount?: number;
  scheduleGroups?: CourseSelectSchedule[];
  scheduleGroupAssoc?: number | null;
  campus?: unknown;
  openDepartment?: { id?: number; nameZh?: string } | null;
  courseType?: { nameZh?: string } | string | null;
  courseProperty?: { nameZh?: string } | string | null;
  pinned?: boolean;
  needAttend?: boolean;
  coursePackAssoc?: number | null;
  retake?: boolean;
  totalPeriod?: number;
  enablePreSelect?: boolean;
  selectionRemark?: string;
  [k: string]: unknown;
}

/** 重修/不及格课程行（repaired-courses） */
export interface CourseSelectRepaired {
  id: number;
  nameZh?: string;
  nameEn?: string;
  code?: string;
  credits?: number;
  score?: number | null;
  /** NO_PASS=未通过 PASS=通过 SUBSITUTE_PASS=替代通过 */
  courseSelectPassStatus?: string;
  substitutedCourseAssoc?: number | null;
  substituteBuild?: boolean;
  passed?: boolean;
  department?: { id?: number; nameZh?: string; code?: string } | null;
  [k: string]: unknown;
}

/** add-drop-response 轮询结果 */
export interface CourseSelectAddDropResult {
  success?: boolean;
  resend?: boolean;
  errorMessage?: { text?: string };
}
