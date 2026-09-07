# 西建大教务通 (XAUAT 教务通)

> 本项目为个人/学生独立开源项目，与西安建筑科技大学官方无从属关系，仅供学习交流使用。

[![Android APK](https://github.com/xieyinch/xauat-swjw-app/actions/workflows/android-build.yml/badge.svg)](https://github.com/xieyinch/xauat-swjw-app/actions/workflows/android-build.yml)

面向西安建筑科技大学学生的移动端教务助手，基于 **React Native (Expo)** 开发，覆盖教务系统绝大多数常用功能。

App 以原生组件实现界面，通过内置 WebView 与教务系统**同域桥接**获取数据：数据请求在隐藏 WebView 中发起并自动携带登录 Cookie，不依赖逆向接口，也不需要频繁登录。凡是已原生化的功能均提供接近原生 App 的流畅体验；其余功能通过 App 内嵌 WebView 承接，保证功能齐全。

## 功能总览

底部标签栏共五个页面：**首页 / 课表 / 成绩 / 全部 / 考试**。其中「全部」是完整的教务功能入口，按教务系统菜单分类组织。

### 首页

- 学生信息卡：姓名、学号、当前学期，右侧退出登录
- 功能快捷入口四宫格：我的课表、成绩信息、考试信息、通知公告
- 今日课程：读取当前学期课表，列出今天的节次、课程与地点；无课提示「今天没课，好好休息」

### 课表

- 网格时间轴布局：左侧节次刻度，右侧周一至周日七列网格
- 每门课为浅色圆角色块，高度随节数拉伸，白字显示课程名与 `@教室`；单双周课底部标注；冲突课程并排
- 顶部支持学期切换与周次切换，进入默认定位当前周；支持下拉刷新

### 成绩

- 学期切换（横向滚动）
- 学期统计：门数、已获学分、学期绩点
- 成绩列表：课程名、代码、学分、类型与分数绩点；未公布成绩弱化显示

### 考试

按时间排序的考试安排，每项显示日期、时间、课程名、教室、校区与座位号。

### 全部（教务功能入口）

覆盖教务系统 11 大分类、数十项功能，每项可按分类检索：

| 分类 | 功能 |
| ---- | ---- |
| 公共服务与查询 | 空闲教室查询、全校开课查询、常用文件下载、学院联系方式 |
| 学籍 | 学籍信息、学生信息核对、学籍异动申请、大类分流申请、转专业申请、辅修/微专业申请、授予学士学位申请 |
| 培养方案 | 我的培养方案、培养方案完成情况、课程替代申请 |
| 课程与教材 | 选课、我的课表、个性化选课申请、免修申请、我的班级课表 |
| 考试 | 缓考申请、考试信息、等级考试 |
| 成绩 | 成绩信息、放弃成绩申请、学业预警 |
| 导师 | 选择意向导师、我的导师、导师互选结果查询、评价导师、导师变更申请、我的被评结果、指导过程查看 |
| 评教 | 学生即时性评价、学生总结性评教、学生投票 |
| 教学信息反馈 | 教学信息反馈 |
| 毕业论文(设计) | 毕业论文(设计)选题、毕业论文(设计) |

其中**空闲教室查询、全校开课查询、常用文件下载、学籍信息、培养方案、成绩、考试、导师、申请类等大部分功能已原生实现**；选课、评教、毕业论文等仍由 WebView 承接，以保证与官方页面一致。

### 其他

- **图书馆**：App 内嵌 WebView 打开图书馆服务
- **体育馆预约**：App 内嵌 WebView 打开体育馆预约系统（CAS 统一认证，与教务共用登录态）

## 登录与会话

- 教务门户为上海树维 EAMS，实际登录走学校统一身份认证（CAS，`authserver.xauat.edu.cn`，明文 HTTP，Android 已开启 cleartext）
- 登录页输入学号与密码后，App 跳转 CAS 认证页自动填充并提交，认证成功回到主界面
- 所有数据请求在隐藏 WebView 中发起（`src/api/bridge.ts`），复用门户下发的 SESSION Cookie，只需登录一次
- 启动时探测教务首页判断登录态；数据请求被重定向回登录页时判定会话过期
- 账号密码存入系统安全存储（expo-secure-store），会话过期自动重新登录；退出登录清除凭据

## 技术栈

- React Native 0.86 + Expo SDK 57
- react-native-webview 13（数据桥、WebView 承接页）
- crypto-js（CAS 登录密码加密）
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

推送到 `master` / `main` 或手动触发 workflow 后，云端执行 `expo prebuild` 编译 Android APK，发布到仓库 Release：

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
| `SITE.noticeBase` / `SITE.noticeList` | 教务处公开网站 / 通知公告列表 |
| `SITE.sports` | 体育馆预约系统 |
| `API.*` | 课表 / 成绩 / 考试等数据接口路径 |

## 项目结构

```
App.tsx                        # 入口：阶段管理（启动/登录/登录中/主界面）+ 数据桥 + 底部标签栏
src/
  config/
    site.ts                    # 站点与接口配置、底部标签定义
    functions.ts               # 教务功能分类、图标与颜色、离线兜底菜单
    nativeFunctions.tsx        # 已原生化的功能映射（permCode/href → 原生组件）
  theme.ts                     # 主题色与间距
  types.ts                     # 数据类型定义
  api/
    bridge.ts                  # 隐藏 WebView 数据桥：webFetch、就绪门控、消息分发
    data.ts                    # 课表/成绩/考试/通知/学期/学生信息接口
    query.ts                   # 各类功能数据接口与解析（空闲教室/开课/文件/申请等）
    courseSelectEngine.ts      # 选课流程引擎
    parsers.ts                 # HTML / JSON 解析，兼容多种课表文本格式
    storage.ts                 # 登录状态本地存储
  hooks/
    useAsyncData.ts            # 数据加载 hook（加载/错误/会话过期处理）
  components/
    BottomTabBar.tsx           # 底部标签栏
    FunctionShell.tsx          # 功能页统一外壳（关闭按钮 + 标题栏）
    ListContainer.tsx          # 列表容器（加载/错误/空态）
    TopBar.tsx / InfoCard.tsx  # 通用栏与信息卡
    PortalWebView.tsx          # 内嵌 WebView 承接页（图书馆/体育馆/未原生功能）
  screens/
    LoginScreen.tsx            # 登录页
    HomeScreen.tsx             # 首页
    CourseTableScreen.tsx      # 课表（网格时间轴）
    GradeScreen.tsx            # 成绩
    ExamScreen.tsx             # 考试安排
    AllScreen.tsx              # 全部（功能入口 + 搜索）
    LibraryScreen.tsx          # 图书馆
    SportsScreen.tsx           # 体育馆预约
    NoticeScreen.tsx           # 通知公告列表
    NoticeDetailScreen.tsx     # 公告详情（WebView）
    functions/                 # 各原生功能页（空闲教室/全校开课/成绩/导师/申请等）
```

## 隐私与安全

- 登录凭据由用户在本机输入，仅用于访问本人教务账号，App 不收集、不上传任何账号信息
- 数据请求直达学校服务器，未注入第三方脚本
- 仅供学习交流，请遵守学校网络与信息安全相关规定

## 开源协议

[MIT](./LICENSE)