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

## 运行

### 方式一：Expo Go（最快，手机体验）
1. 手机安装 [Expo Go](https://expo.dev/go)
2. 项目根目录执行：

   ```bash
   npm install
   npx expo start
   ```

3. 手机与电脑在同一局域网，用 Expo Go 扫码即可打开

### 方式二：原生构建

```bash
npm install
npx expo run:android   # Android（需要 Android Studio）
npx expo run:ios       # iOS（需要 macOS + Xcode）
```

### 方式三：Web 预览（仅界面预览）

```bash
npx expo start --web
```

> 注意：教务处官网（jwc.xauat.edu.cn）设置了 `X-Frame-Options`，在 Web 预览的 iframe 中会被浏览器拦截，属正常现象；原生 App 的 WebView 直接加载页面，不受影响。

## 自动化构建 APK（GitHub Actions）

仓库已内置 `.github/workflows/android-build.yml`：推送到 `master` / `main` 分支（或手动触发 workflow）后，GitHub 云端会自动执行 `expo prebuild` 并编译出 Android release APK。

1. 推送代码后，到仓库 **Actions** 页签查看构建进度
2. 构建成功后，在对应构建记录底部的 **Artifacts** 中下载 `xauat-swjw-app-release`，其中的 `app-release.apk` 即为安装包

> 默认使用 debug 签名密钥，可直接安装到手机；发布正式版时建议在 `android/app/build.gradle` 中配置正式签名。

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
