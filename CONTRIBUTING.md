# Contributing · 参与贡献

Thanks for helping improve Personal OS! · 感谢你帮助改进 Personal OS！

## Report a bug or suggest a feature · 反馈问题或建议

Open an [issue](../../issues/new/choose) and pick a template. For bugs, please include your browser, device, and the steps to reproduce. Do not attach exported backups that contain personal information.

请创建一个 [Issue](../../issues/new/choose) 并选择模板。反馈 Bug 时请写明浏览器、设备和复现步骤。请不要附上含有个人信息的导出备份文件。

## Develop locally · 本地开发

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # TypeScript check · 类型检查
npm run build        # production build · 生产构建
```

Node.js 22 or newer is required (see `.nvmrc`). · 需要 Node.js 22 或更高版本（见 `.nvmrc`）。

## Guidelines · 约定

- **Keep data local.** The app must not send user records to any server. · **数据留在本地**：应用不能把用户记录发送到任何服务器。
- **No sample content.** New users must start with an empty workspace. · **不预置内容**：新用户必须从空白工作区开始。
- **Bilingual UI.** Every new interface string needs a Chinese translation in `lib/i18n.ts`. User-entered text is never translated. · **双语界面**：新增界面文字需在 `lib/i18n.ts` 中补充中文翻译；用户输入的内容不做翻译。
- **Local time.** Use the helpers in `lib/model.ts` (`dateKey`, `toDate`, `toLocalInput`, `fromLocalInput`) instead of hard-coded time zones. · **本地时间**：使用 `lib/model.ts` 中的日期工具，不要写死时区。
- **Backwards-compatible data.** If you change the data shape in `lib/model.ts`, older backups must still import. · **兼容旧数据**：修改 `lib/model.ts` 中的数据结构时，旧的备份仍需能导入。
- Check both languages and a phone-sized screen before opening a pull request. · 提交 PR 前，请在中英文界面和手机尺寸下各检查一遍。

## Pull requests · 提交 PR

1. Fork the repository and create a branch. · Fork 仓库并新建分支。
2. Make your change and run `npm run typecheck` and `npm run build`. · 完成修改，运行 `npm run typecheck` 和 `npm run build`。
3. Open a pull request describing what changed and why, with screenshots for UI changes. · 提交 PR，说明改了什么、为什么改；界面改动请附截图。

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE). · 提交贡献即表示你同意以 [MIT 许可证](LICENSE) 授权你的贡献。
