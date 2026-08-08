/**
 * 站点与标签页配置。
 *
 * 注意：教务系统门户（swjw.xauat.edu.cn）需要学生账号登录，登录后才能在
 * 课表/成绩/考试等页面查看个人数据。下方的 uri 是默认地址，同学可以登录
 * 网页版后点击对应菜单，将浏览器地址栏里的真实链接替换到对应 uri 即可。
 */
export const SITE = {
  /** 教务系统门户（学生端），需登录 */
  portal: 'https://swjw.xauat.edu.cn/student/home',
  /** 教务处公开网站（无需登录） */
  noticeBase: 'https://jwc.xauat.edu.cn',
  /** 教务处「通知公告」列表页（公开） */
  noticeList: 'https://jwc.xauat.edu.cn/tzgg/jsxg.htm',
} as const;

export interface TabItem {
  key: string;
  title: string;
  /** Ionicons 图标名（未选中） */
  icon: string;
  /** Ionicons 图标名（选中） */
  activeIcon: string;
  uri: string;
  /** 该页面是否要求先登录教务系统 */
  requiresLogin: boolean;
}

export const TABS: TabItem[] = [
  {
    key: 'home',
    title: '首页',
    icon: 'home-outline',
    activeIcon: 'home',
    uri: SITE.portal,
    requiresLogin: true,
  },
  {
    key: 'schedule',
    title: '课表',
    icon: 'calendar-outline',
    activeIcon: 'calendar',
    uri: SITE.portal,
    requiresLogin: true,
  },
  {
    key: 'grade',
    title: '成绩',
    icon: 'school-outline',
    activeIcon: 'school',
    uri: SITE.portal,
    requiresLogin: true,
  },
  {
    key: 'notice',
    title: '通知',
    icon: 'notifications-outline',
    activeIcon: 'notifications',
    uri: SITE.noticeList,
    requiresLogin: false,
  },
  {
    key: 'exam',
    title: '考试',
    icon: 'time-outline',
    activeIcon: 'time',
    uri: SITE.portal,
    requiresLogin: true,
  },
];
