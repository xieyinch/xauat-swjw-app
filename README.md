# 西建大教务通 (XAUAT 教务通)

[![Android APK](https://github.com/xieyinch/xauat-swjw-app/actions/workflows/android-build.yml/badge.svg)](https://github.com/xieyinch/xauat-swjw-app/actions/workflows/android-build.yml)

面向西安建筑科技大学学生的移动端教务助手，基于 React Native (Expo) 开发。界面为原生组件实现，数据通过与教务系统同域的内置 WebView 桥接获取，自动携带登录 Cookie，不依赖逆向接口。

## 界面

App 采用底部标签栏导航，共五个页面；未登录或会话过期时先进入登录页。

### 登录页

输入学号与统一身份认证密码后点击「登录」，App 跳转到学校 CAS 认证页并自动填充账号密码、自动提交，认证成功即回到主界面。登录成功后课表、成绩、考试等需要登录的页面均可直接使用。

### 首页

- 学生信息卡：显示姓名、学号与当前学期，右侧为退出登录按钮
- 功能入口四宫格：我的课表、成绩查询、考试安排、通知公告
- 今日课程：加载当前学期课表，列出今天有课的节次、课程与地点；当天无课时提示「今天没课，好好休息」

### 课表

- 网格时间轴布局：左侧为节次刻度，右侧为周一至周日的七列网格
- 每门课是一个浅色圆角色块，高度随上课节数拉伸，白字展示课程名与 `@教室`，单双周课程在底部标注；同一时间冲突的多门课并排显示
- 顶部支持学期切换（横向滚动）与周次切换，进入时默认定位到当前周
- 支持下拉刷新

### 成绩

- 学期切换（横向滚动）
- 学期统计：课程门数、已获学分、学期绩点
- 成绩列表：课程名、课程代码、学分、课程类型，以及分数与绩点；未公布的成绩以弱化样式显示

### 考试

按时间排序的考试安排列表，每项展示日期、时间、课程名、教室、校区与座位号。

### 通知

展示教务处官网「通知公告」列表，无需登录。点击某条公告在 App 内打开详情页阅读正文。

## 登录与会话

- 教务门户为上海树维 EAMS，实际登录走学校统一身份认证（CAS，`authserver.xauat.edu.cn`，明文 HTTP，Android 已开启 cleartext）
- App 通过注入脚本自动填充登录表单，认证成功后门户下发 SESSION Cookie，由内置 WebView 持有
- 所有数据请求在隐藏 WebView 中发起（`src/api/bridge.ts`），复用该 Cookie，因此只需登录一次
- 启动时探测教务首页判断登录态；数据请求被重定向回登录页时判定会话过期
- 登录成功后账号密码存入系统安全存储（expo-secure-store），会话过期时自动重新登录，无需手动操作；退出登录会清除凭据

## 技术栈

- React Native 0.86 + Expo SDK 57
- react-native-webview 13（数据桥、通知详情）
- @react-native-async-storage/async-storage（登录状态记录）
- expo-secure-store（账号密码安全存储，用于自动登录）
- TypeScript

## 运行

### Expo Go（最快）

1. 手机安装 [Expo Go](https://expo.dev/go)
2. 项目根目录执行：

   ```bash
   npm install
   npx expo start
   ```

3. 手机与电脑同一局域网，用 Expo Go 扫码打开

### 原生构建

```bash
npm install
npx expo run:android   # Android，需要 Android Studio
npx expo run:ios       # iOS，需要 macOS + Xcode
```

## 安装包（GitHub Actions 自动构建）

推送到 `master` / `main` 或手动触发 workflow 后，云端执行 `expo prebuild` 并编译 Android APK，发布到仓库 Release：

- 最新版 APK：https://github.com/xieyinch/xauat-swjw-app/releases/latest/download/app-release.apk
- 发布页：https://github.com/xieyinch/xauat-swjw-app/releases/latest
- 构建日志：https://github.com/xieyinch/xauat-swjw-app/actions

当前使用 debug 签名，可直接安装；发布正式版需在 `android/app/build.gradle` 配置正式签名。

## 配置

站点与接口集中在 `src/config/site.ts`：

| 配置项 | 说明 |
| ------ | ---- |
| `SITE.authLogin` | 统一身份认证（CAS）登录页 |
| `SITE.ssoService` | 教务门户 SSO 回调地址 |
| `SITE.swjw` / `SITE.portal` | 教务门户根地址 / 首页（会话探测） |
| `SITE.noticeList` | 教务处通知公告列表（公开） |
| `API.courseTableGetData` | 课表数据接口（配合 `semesterId`） |
| `API.gradePage` / `API.examPage` | 成绩 / 考试页面 |

## 项目结构

```
App.tsx                        # 入口：阶段管理（启动/登录/登录中/主界面）+ 数据桥 + 底部标签栏
src/
  config/site.ts               # 站点与接口配置
  theme.ts                     # 主题色与间距
  types.ts                     # 数据类型定义
  api/
    bridge.ts                  # 隐藏 WebView 数据桥：webFetch、就绪门控、消息分发
    data.ts                    # 课表/成绩/考试/通知/学期/学生信息接口与解析调用
    parsers.ts                 # HTML / JSON 解析，兼容多种课表文本格式
    storage.ts                 # 登录状态本地存储
  hooks/
    useAsyncData.ts            # 数据加载 hook（加载/错误/会话过期处理）
  components/
    BottomTabBar.tsx           # 底部标签栏
  screens/
    LoginScreen.tsx            # 登录页
    HomeScreen.tsx             # 首页
    CourseTableScreen.tsx      # 课表（网格时间轴）
    GradeScreen.tsx            # 成绩
    ExamScreen.tsx             # 考试安排
    NoticeScreen.tsx           # 通知公告列表
    NoticeDetailScreen.tsx     # 公告详情（WebView）
```

## 隐私与安全

- 登录凭据由用户在本机输入，仅用于访问本人教务账号，App 不收集、不上传任何账号信息
- 数据请求直达学校服务器，未注入第三方脚本
- 仅供学习交流，请遵守学校网络与信息安全相关规定

## 开源协议

[MIT](./LICENSE)
