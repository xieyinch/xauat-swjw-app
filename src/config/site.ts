export const SITE = {
  /** 统一身份认证登录页（CAS，明文 HTTP） */
  authLogin: 'http://authserver.xauat.edu.cn/authserver/login',
  /** 教务门户 SSO 回调地址 */
  ssoService: 'https://swjw.xauat.edu.cn/student/sso/login',
  /** 教务门户根 */
  swjw: 'https://swjw.xauat.edu.cn',
  /** 教务门户首页（用于会话检测） */
  portal: 'https://swjw.xauat.edu.cn/student/home',
  /** 教务处公开网站 */
  noticeBase: 'https://jwc.xauat.edu.cn',
  /** 教务处「通知公告」列表页（公开） */
  noticeList: 'https://jwc.xauat.edu.cn/tzgg/jsxg.htm',
  /** 体育馆预约系统（SPA，CAS 统一认证，与教务共用登录态） */
  sports: 'https://sports.xauat.edu.cn/#/',
} as const;

/** 课表数据接口路径（配合 bizTypeId=2 与 semesterId 使用） */
export const API = {
  courseTableGetData: '/student/for-std/course-table/get-data',
  courseTablePage: '/student/for-std/course-table',
  gradePage: '/student/for-std/grade/sheet',
  examPage: '/student/for-std/exam-arrange',
} as const;

export interface TabItem {
  key: string;
  title: string;
  /** Ionicons 图标名（未选中） */
  icon: string;
  /** Ionicons 图标名（选中） */
  activeIcon: string;
}

export const TABS: TabItem[] = [
  { key: 'home', title: '首页', icon: 'home-outline', activeIcon: 'home' },
  { key: 'schedule', title: '课表', icon: 'calendar-outline', activeIcon: 'calendar' },
  { key: 'grade', title: '成绩', icon: 'school-outline', activeIcon: 'school' },
  { key: 'notice', title: '通知', icon: 'notifications-outline', activeIcon: 'notifications' },
  { key: 'exam', title: '考试', icon: 'time-outline', activeIcon: 'time' },
];
