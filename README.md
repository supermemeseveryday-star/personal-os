# Personal OS

A bilingual (中文 / English) personal dashboard for tasks, projects, focus sessions, learning, goals and weekly review. Built with Next.js; all data stays in your own browser.

一个中英双语的个人工作台：任务、项目、专注计时、学习记录、目标与每周复盘。基于 Next.js，所有数据只保存在你自己的浏览器里。

## Features · 功能

- **Dashboard 仪表盘** – today's tasks, current focus with timer, schedule, active projects, reminders
- **Tasks & Projects 任务与项目** – quick add, milestones, priorities, progress, archive
- **Calendar 日历** – month / week / day views; add a task to any day with one click
- **Growth 成长** – skills, learning log, long-term goals
- **Review 复盘** – weekly review and 7-day analytics
- **Backup 备份** – export / import JSON, reset with undo
- **Fast to use 顺手** – `⌘K` command palette, `N` for a new task, `⌘Enter` to save, undo after every delete

It starts completely empty. A short getting-started guide on the dashboard walks you through adding your name, first project and first task.

首次打开时没有任何示例数据，仪表盘上的引导会带你填写名字、创建第一个项目和第一个任务。

## Install as an app · 安装为应用

Personal OS is a Progressive Web App. After deploying, open the site and:

- **Chrome / Edge (Windows, Mac, Android)**: click the install icon in the address bar, or **Settings → Install app** inside Personal OS.
- **iPhone / iPad (Safari)**: Share → **Add to Home Screen**.
- **Safari on Mac**: File → **Add to Dock**.

It then opens in its own window without browser bars, works offline, and long-pressing (or right-clicking) the app icon offers shortcuts: **New task**, **Calendar**, **Log learning**.

部署后打开网站即可安装：Chrome / Edge 点地址栏的安装图标（或在 **设置 → 安装应用**）；iPhone 用 Safari 的「分享 → 添加到主屏幕」；Mac 上的 Safari 用「文件 → 添加到程序坞」。安装后会以独立窗口打开、可离线使用，长按（或右键）图标可直接「新建任务」「日历」「记录学习」。

## Run locally · 本地运行

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy · 部署

The app is a standard Next.js project with no database and no environment variables.

- **Vercel**: import the GitHub repository at [vercel.com/new](https://vercel.com/new). The framework preset is detected automatically (Next.js); keep the default build settings.
- **Anywhere else**: `npm run build` then `npm start`.

## Your data · 数据说明

Data is saved in the browser's `localStorage` under the key `personal-os-state-v1`. Each browser and device has its own copy, and clearing site data removes it. Use **Settings → Export data** to keep regular backups and **Import data** to restore them or move to another device.

数据保存在浏览器的 `localStorage` 中，不同浏览器/设备之间不会同步，清除网站数据会删除记录。请在 **设置 → 导出数据** 定期备份，需要时用 **导入数据** 恢复或迁移。

## Project structure · 目录结构

```
app/                 Next.js routes, global styles
components/
  personal-os.tsx    The whole application UI
  page-deck.tsx      Paged content area with keyboard / swipe navigation
  ui/                shadcn/ui primitives (dialog, command palette, checkbox)
lib/
  model.ts           Data types and date helpers (uses the viewer's local time zone)
  storage.ts         localStorage load / save
  i18n.ts            Chinese translations for interface text
```
