<div align="center">

<img src="public/icon-192.png" width="80" alt="Personal OS 图标" />

# Personal OS

**一个安静、好用的中英双语个人工作台：任务、项目、专注时间与个人成长，集中在一处。**

所有数据只保存在你自己的设备上。不用注册，没有服务器，不做追踪。

[English](README.md) · [使用说明](docs/user-guide.zh-CN.md) · [部署指南](docs/deployment.md) · [更新记录](CHANGELOG.md)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/supermemeseveryday-star/personal-os)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

<img src="docs/screenshots/dashboard-zh.png" alt="Personal OS 中文仪表盘" width="100%" />

</div>

## 这是什么？

Personal OS 是一个像原生 App 一样使用的网页应用。它把平时分散在好几个工具里的东西放在一起：待办清单、项目看板、日历、专注计时、学习记录，并且把它们串起来，让每天的小任务最终汇聚到你真正在意的目标上。

它是为个人设计的。每个打开网站的人都会得到一个**属于自己、从空白开始的私人工作区**，数据存在各自的浏览器里。所以你只需要部署一次，就可以把链接分享给任何人使用。

## 功能

| | |
|---|---|
| **仪表盘** | 今日任务、当前专注、今日日程、进行中的项目、提醒，以及本周时间投入。 |
| **任务** | 快速添加（输入后按回车）、优先级、截止时间、标签、预计时长。逾期任务会标红。 |
| **项目** | 进度条、里程碑、备注、关联技能，可归档与恢复。 |
| **专注计时** | 任意任务都能开始专注。切换到其他页面时，计时会显示在顶部，每次专注都会自动记录。 |
| **日历** | 月 / 周 / 日视图，显示任务、提醒、里程碑和专注记录。点「+」即可给某一天添加任务。 |
| **成长** | 技能水平（0–100）、学习记录，以及与项目和技能关联的长期目标。 |
| **复盘** | 每周复盘页面，以及最近 7 天的完成任务与专注时长统计。 |
| **双语** | 完整的中文与英文界面，随时切换。 |
| **可安装为应用** | 添加到桌面或主屏幕后，以独立窗口打开、可离线使用，长按图标可直接「新建任务」「日历」「记录学习」。 |
| **键盘友好** | `⌘K` 命令面板、`N` 新建任务、`⌘Enter` 保存、`←` `→` 切换内容页。 |
| **不怕误删** | 每次删除都可以撤销，随时导出 / 导入 JSON 备份。 |

## 截图

应用打开时是空的。以下截图展示的是用户自己填入任务和项目之后的样子。

| 今日任务与日程 | 项目 |
|---|---|
| ![今日](docs/screenshots/today.png) | ![项目](docs/screenshots/projects.png) |
| **日历** | **英文界面** |
| ![日历](docs/screenshots/calendar.png) | ![英文仪表盘](docs/screenshots/dashboard.png) |

<p align="center">
  <img src="docs/screenshots/mobile-dashboard-zh.png" width="260" alt="手机版仪表盘" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/mobile-tasks-zh.png" width="260" alt="手机版任务" />
</p>

## 快速开始

**在线使用：** 点上方的 **Deploy with Vercel** 按钮，免费部署一份属于你自己的网站，大约一分钟，部署完成后打开链接即可。

**在电脑上运行**（需要 [Node.js](https://nodejs.org) 22 或更高版本）：

```bash
git clone https://github.com/supermemeseveryday-star/personal-os.git
cd personal-os
npm install
npm run dev
```

打开 http://localhost:3000。工作区一开始是空的，仪表盘上的引导会带你创建第一个项目和任务。

## 安装为应用

| 设备 | 方法 |
|---|---|
| Chrome / Edge（Windows、macOS、Android） | 点顶部的 **安装应用**，或地址栏里的安装图标 |
| iPhone / iPad | 用 Safari 打开 → 分享 → **添加到主屏幕** |
| Mac 上的 Safari | 文件 → **添加到程序坞** |

iPhone 用户建议**先安装到主屏幕再开始使用**：Safari 里的数据和主屏幕 App 里的数据是分开存放的。

## 我的数据存在哪里？

- 所有记录都保存在**当前设备**浏览器的 `localStorage` 中，不会上传到任何服务器，网站的部署者也看不到。
- 不同浏览器、不同设备各自独立。换设备时，在旧设备 **设置 → 导出数据**，再到新设备 **导入数据**。
- 清除网站数据或删除 App 会删除记录，请定期导出备份。

## 文档

- [使用说明](docs/user-guide.zh-CN.md)：每个页面与功能的详细介绍
- [部署指南](docs/deployment.md)：Vercel、其他平台、自定义域名
- [参与贡献](CONTRIBUTING.md)：如何反馈问题、提交改进

## 技术栈

[Next.js](https://nextjs.org) 16 · [React](https://react.dev) 19 · TypeScript · [Tailwind CSS](https://tailwindcss.com) 4 · [Radix UI](https://www.radix-ui.com) · [cmdk](https://cmdk.paco.me) · [Lucide](https://lucide.dev) 图标

## 目录结构

```
app/                      Next.js 路由、全局样式、Web App Manifest
components/
  personal-os.tsx         应用界面（各页面、表单、专注计时、提示条）
  page-deck.tsx           分页内容区，支持键盘与滑动翻页
  ui/                     shadcn/ui 基础组件：弹窗、命令面板、复选框
lib/
  model.ts                数据类型与日期工具（使用访问者本地时区）
  storage.ts              读写 localStorage
  i18n.ts                 界面文字的中文翻译
public/                   应用图标与离线 Service Worker（sw.js）
docs/                     使用说明、部署指南、截图
```

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm start` | 运行生产构建 |
| `npm run typecheck` | 检查 TypeScript 类型 |

## 许可证

[MIT](LICENSE)：可以自由使用、修改和分发，请保留版权声明。
