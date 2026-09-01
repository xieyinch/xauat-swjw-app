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

/** 常用文件下载中的单个文件 */
export interface CommonFileItem {
  name: string;
  key: string;
  typeName: string;
  publishTime: string;
}

/** 学籍信息：一个分组区块（如基本信息/录取信息） */
export interface StudentInfoSection {
  key: string;
  title: string;
  fields: Array<{ label: string; value: string }>;
}

export interface StudentInfoDetail {
  sections: StudentInfoSection[];
}

/** 培养方案中的一门计划课程 */
export interface ProgramCourse {
  code: string;
  nameZh: string;
  courseProperty?: string;
  credits?: number;
  periodTotal?: string;
  theory?: string;
  experiment?: string;
  practice?: string;
  test?: string;
  machine?: string;
  design?: string;
  extra?: string;
  terms?: string;
  compulsory?: boolean;
  examMode?: string;
  openDepartment?: string;
}

/** 培养方案模块（可含子模块与课程） */
export interface ProgramModule {
  id: number;
  nameZh: string;
  requiredCredits?: string;
  children: ProgramModule[];
  courses: ProgramCourse[];
}

export interface ProgramData {
  root: ProgramModule;
}

/** 学业预警条目 */
export interface PrecautionItem {
  index: number;
  courseCode: string;
  courseName: string;
  compulsory: string;
  credits: string;
  score: string;
  gradePoint: string;
  checkResult: string;
}

/** 导师互选结果条目 */
export interface TutorSelectResult {
  stdNo: string;
  studentName: string;
  grade: string;
  college: string;
  major: string;
  tutorType: string;
  tutorName: string;
  tutorDept: string;
  termYears: string;
}
