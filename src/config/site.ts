export const SITE = {
  /** 统一身份认证登录页（CAS，当前为 HTTP）。 */
  authLogin: 'http://authserver.xauat.edu.cn/authserver/login',
  /** 教务门户 SSO 回调地址。 */
  ssoService: 'https://swjw.xauat.edu.cn/student/sso/login',
  /** 教务门户根地址。 */
  swjw: 'https://swjw.xauat.edu.cn',
  /** 教务门户首页，用于会话探测。 */
  portal: 'https://swjw.xauat.edu.cn/student/home',
  /** 教务处官网。 */
  noticeBase: 'https://jwc.xauat.edu.cn',
  /** 教务处通知公告列表页。 */
  noticeList: 'https://jwc.xauat.edu.cn/tzgg/jsxg.htm',
  /** 体育馆预约系统。 */
  sports: 'https://sports.xauat.edu.cn/#/',
} as const;

export const API = {
  courseTableGetData: '/student/for-std/course-table/get-data',
  courseTablePage: '/student/for-std/course-table',
  gradePage: '/student/for-std/grade/sheet',
  examPage: '/student/for-std/exam-arrange',
  menu: '/student/home/menu',
} as const;

export interface TabItem {
  key: string;
  title: string;
  icon: string;
  activeIcon: string;
}

export const TABS: TabItem[] = [
  { key: 'home', title: '首页', icon: 'home-outline', activeIcon: 'home' },
  { key: 'schedule', title: '课表', icon: 'calendar-outline', activeIcon: 'calendar' },
  { key: 'grade', title: '成绩', icon: 'school-outline', activeIcon: 'school' },
  { key: 'all', title: '全部', icon: 'apps-outline', activeIcon: 'apps' },
  { key: 'exam', title: '考试', icon: 'time-outline', activeIcon: 'time' },
];
