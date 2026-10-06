# Deployment guide · 部署指南

[Back to README](../README.md) · [返回中文 README](../README.zh-CN.md)

Personal OS is a standard Next.js app with **no database and no environment variables**. Every visitor gets their own empty workspace in their browser, so one deployment can be shared with anyone.

Personal OS 是一个标准的 Next.js 应用，**不需要数据库，也不需要环境变量**。每个访问者都会在自己的浏览器里得到一个空白工作区，部署一次就能分享给任何人使用。

## Option 1: Vercel (recommended) · 方式一：Vercel（推荐）

**One click · 一键部署**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/supermemeseveryday-star/personal-os)

The button copies this repository to your GitHub account and deploys it. Every later push to `main` redeploys automatically.

按钮会把这个仓库复制到你的 GitHub 账号并完成部署。之后每次推送到 `main` 分支都会自动重新部署。

**From your own GitHub repository · 从自己的 GitHub 仓库导入**

1. Push the project to GitHub. · 把项目推送到 GitHub。
2. Open [vercel.com/new](https://vercel.com/new) and import the repository. · 打开 [vercel.com/new](https://vercel.com/new)，导入该仓库。
3. Keep the defaults (Framework preset: **Next.js**) and click **Deploy**. · 保持默认设置（框架：**Next.js**），点 **Deploy**。

**From the command line · 使用命令行**

```bash
npx vercel          # preview deployment · 预览部署
npx vercel --prod   # production deployment · 正式部署
```

## Option 2: Any Node.js host · 方式二：任意 Node.js 平台

Works on Netlify, Render, Railway, Fly.io, a VPS, and similar hosts. Node.js 22 or newer is required.

适用于 Netlify、Render、Railway、Fly.io、自己的服务器等。需要 Node.js 22 或更高版本。

```bash
npm ci
npm run build
npm start            # listens on port 3000; use -p to change · 默认端口 3000，可用 -p 修改
```

## Custom domain · 自定义域名

In Vercel: **Project → Settings → Domains → Add**, then follow the DNS instructions. HTTPS is set up automatically.

在 Vercel 中：**Project → Settings → Domains → Add**，按提示设置 DNS，HTTPS 会自动配置。

> Changing the domain gives users a new, empty workspace, because browser storage belongs to each domain. Ask users to export a backup before you switch domains.
>
> 更换域名后，用户会看到一个新的空白工作区，因为浏览器存储是按域名区分的。更换前请提醒用户先导出备份。

## Installable app (PWA) · 可安装应用

Installation and offline support work automatically on any HTTPS deployment. The relevant files are:

只要网站使用 HTTPS，安装和离线功能就会自动生效。相关文件：

| File · 文件 | Purpose · 作用 |
|---|---|
| `app/manifest.ts` | App name, colours, icons and icon shortcuts · 应用名称、颜色、图标和快捷方式 |
| `public/sw.js` | Offline cache; pages are network-first so new deployments appear immediately · 离线缓存，页面优先联网获取，新版本会立即生效 |
| `public/icon-*.png`, `public/apple-touch-icon.png` | App icons · 应用图标 |

To rename the app, edit `name` and `short_name` in `app/manifest.ts` and `title` in `app/layout.tsx`.

如果要改应用名称，请修改 `app/manifest.ts` 中的 `name`、`short_name`，以及 `app/layout.tsx` 中的 `title`。
