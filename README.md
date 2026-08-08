# 西建大教务通 (XAUAT 教务通)

[![Android APK](https://github.com/xieyinch/xauat-swjw-app/actions/workflows/android-build.yml/badge.svg)](https://github.com/xieyinch/xauat-swjw-app/actions/workflows/android-build.yml)

面向西安建筑科技大学同学的**开源手机端教务助手**。基于 React Native (Expo) 开发，通过 WebView 封装教务处相关站点，无需逆向接口即可稳定使用，学校改版也不受影响。

## 功能

| 标签页 | 说明 |
| ------ | ---- |
| 首页 | 教务系统门户（学生端），登录后可查看个人学籍、课表、成绩等 |
| 课表 | 教务系统课表查询（需登录） |
| 成绩 | 教务系统成绩查询（需登录） |
| 通知 | 教务处官网「通知公告」列表，公开无需登录 |
| 考试 | 教务系统考试安排（需登录） |

其他特性：

- 底部标签栏 + 顶部工具条（前进 / 后退 / 刷新）
- 单实例 WebView 共享登录会话，**登录一次全 App 生效**
- 会话（Cookie）持久化，关闭 App 后无需重复登录
- 加载进度条、网络错误提示与一键重试
- 未登录访问需登录页面时，顶部显示登录引导提示
- iOS 下拉刷新、iOS 左右滑动前进/后退

## 技术栈

- React Native 0.86 + Expo SDK 57
- react-native-webview 13
- TypeScript


## 配置功能页地址

`src/config/site.ts` 中集中维护各标签页的 URL，均已配置为可直接访问的功能页直达链接：

| 配置项 | 地址 | 说明 |
| ------ | ---- | ---- |
| `SITE.portal` | `https://swjw.xauat.edu.cn/student/home` | 教务系统门户（统一身份认证登录） |
| `SITE.courseTable` | `https://swjw.xauat.edu.cn/student/for-std/course-table` | 我的课表 |
| `SITE.grade` | `https://swjw.xauat.edu.cn/student/for-std/grade/sheet` | 成绩信息（自动跳到当前学期） |
| `SITE.exam` | `https://swjw.xauat.edu.cn/student/for-std/exam-arrange` | 考试安排（自动跳到当前学期） |
| `SITE.noticeList` | `https://jwc.xauat.edu.cn/tzgg/jsxg.htm` | 教务处通知公告（公开） |

> 教务系统使用学校**统一身份认证**（`authserver.xauat.edu.cn`）登录。首次使用需先在任意需登录的标签页登录一次，登录会话会在所有标签页共享并持久化；`课表 / 成绩 / 考试` 未登录时会自动跳转到登录页。

## 项目结构

```
App.tsx                        # 应用入口：顶栏 + WebView + 底部标签栏
src/
  config/site.ts               # 站点与标签页 URL 配置
  theme.ts                     # 主题色与间距
  components/
    PortalWebView.tsx          # 封装 WebView（会话、登录探测、进度回调）
    TopBar.tsx                 # 顶部工具条（前进/后退/刷新）
    BottomTabBar.tsx           # 底部标签栏
```

## 隐私与安全

- 所有登录凭据均由**每位同学在各自设备上自行输入**，仅用于访问自己的教务系统账号，App 不收集、不上传任何账号信息
- 未注入任何第三方脚本，全部请求直达学校服务器
- 本项目仅供学习交流使用，请遵守学校网络与信息安全相关规定

## 开源协议

[MIT](./LICENSE)
