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
