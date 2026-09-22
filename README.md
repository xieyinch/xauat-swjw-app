# 西建大教务通

把课表、成绩、考试和常用校园服务放进一个 App。

面向西安建筑科技大学学生的 Android 教务助手。打开就能看今天上什么课，查成绩和考试安排；其他教务功能也可以从「全部」页面找到。

[下载最新版 APK](https://github.com/xieyinch/xauat-swjw-app/releases/latest/download/app-release.apk) · [查看发布记录](https://github.com/xieyinch/xauat-swjw-app/releases/latest) · [反馈问题](https://github.com/xieyinch/xauat-swjw-app/issues)

> **独立项目说明**：这是学生个人开发的开源项目，并非学校官方 App。课程、成绩等信息以学校教务系统为准。

## 你可以用它做什么

| 想做的事 | 在哪里找 |
| --- | --- |
| 看今天的课程和教室 | 首页、课表 |
| 切换学期和周次，查看单双周课程 | 课表 |
| 查看成绩、学分和绩点 | 成绩 |
| 查看考试日期、地点和座位 | 考试 |
| 查询空闲教室、选课、申请等 | 全部 |
| 打开图书馆和体育馆服务 | 首页快捷入口 |

课表左侧显示节次时间，按课程地点匹配雁塔或草堂校区；雁塔校区的下午时段会随日期切换。**时间来自项目预置的学校节次时间表**，如学校临时调整，请以学校通知为准。

Android 桌面课表组件可以显示今天和明天的课程。今天已结束的课程会从组件中移除，让后面的课程依次出现；打开 App 时会同步最新课表。

## 下载与使用

1. 在 [最新发布页](https://github.com/xieyinch/xauat-swjw-app/releases/latest) 下载 `app-release.apk`，安装到 Android 手机。
2. 打开 App，按提示使用学校统一身份认证登录。
3. 在底部选择「首页」「课表」「成绩」「全部」或「考试」。需要桌面组件时，可以在手机的桌面小组件列表中添加。

首次登录和加载课表需要网络。如果页面显示登录过期，重新登录后再试。部分功能直接打开学校原网页，因此外观和操作可能与 App 内其他页面不同。

**支持平台**：目前提供 Android APK。仓库包含 iOS 项目配置，但尚未提供可直接安装的 iOS 版本。

## 常见疑问

<details>
<summary>为什么有的功能看起来像网页？</summary>

课表、成绩、考试等常用页面采用 App 界面；选课、评教等功能会在 App 内打开学校原页面，以学校当前流程为准。

</details>

<details>
<summary>课表时间或课程信息不对怎么办？</summary>

先切换到正确的学期和周次，再下拉刷新。课程和考试信息以教务系统为准；如果是预置的上课时间与学校当前安排不一致，可以在 [Issues](https://github.com/xieyinch/xauat-swjw-app/issues) 反馈校区、节次和正确时间，不要提交学号、密码或完整个人课表。

</details>

<details>
<summary>桌面组件为什么没有更新？</summary>

先打开 App，确认登录状态，并进入课表同步一次。组件使用最近同步的课程数据；如果学校课表后来有变动，需要再次打开 App 更新。

</details>

## 隐私与项目说明

登录使用学校统一身份认证。App 通过内置网页会话向学校系统请求本人数据；用于自动登录的凭据保存在设备的系统安全存储中，退出登录时清除。请从本仓库的发布页下载安装包，妥善保管自己的账号密码。

这是非官方的学习与交流项目，可能因学校系统调整而出现功能异常。遇到问题可以在 [Issues](https://github.com/xieyinch/xauat-swjw-app/issues) 留下功能名称、操作步骤和已遮盖个人信息的截图。交流 QQ 群：939826786。

## 开发者指南

项目使用 React Native、Expo 和 TypeScript。数据从学校教务系统获取；常用功能由 App 界面展示，其余功能在内置网页中打开。

```bash
npm ci
npx expo run:android
```

本地 Android 构建需要 Android SDK。由于项目使用原生模块，开发与验证请使用原生构建，不要把 Expo Go 当作完整功能测试环境。主要入口在 `App.tsx`，课表与数据解析位于 `src/screens/CourseTableScreen.tsx` 和 `src/api/`，桌面组件位于 `modules/course-widget/`。

推送到 `master` 后，GitHub Actions 会构建 APK 并更新 [Release](https://github.com/xieyinch/xauat-swjw-app/releases/latest)。构建状态可在 [Actions](https://github.com/xieyinch/xauat-swjw-app/actions) 查看。

## 开源协议

[MIT](./LICENSE)
