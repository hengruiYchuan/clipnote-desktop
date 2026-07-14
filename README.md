<div align="center">

# ClipNote

**贴在桌面边缘的轻量剪贴板与便签工具**

本地采集、随手搜索、快速收起。内容只保存在你的 Windows 设备中。

![Windows](https://img.shields.io/badge/Windows-10%20%2F%2011-2f6f68?style=flat-square)
![Tauri](https://img.shields.io/badge/Tauri-2.11-df6747?style=flat-square)
![React](https://img.shields.io/badge/React-19-26231f?style=flat-square)
![Version](https://img.shields.io/badge/version-0.1.0-b68632?style=flat-square)

</div>

<p align="center">
  <img src="docs/images/clipnote-library.png" width="48%" alt="ClipNote 剪贴板长文本折叠界面" />
  <img src="docs/images/clipnote-settings.png" width="48%" alt="ClipNote 设置界面" />
</p>

## 为什么做 ClipNote

复制过的命令、链接和临时文字经常只在几分钟内有用，却很容易被下一次复制覆盖。ClipNote 把这些工作碎片留在桌面边缘：需要时展开，不需要时缩成一个 `56 × 56` 图标，不占任务栏，也不打断当前工作。

## 功能

- **自动采集文本剪贴板**：识别普通文本、链接、代码和文件路径。
- **本地资料库**：按时间浏览，支持搜索、收藏、再次复制和删除。
- **长内容折叠**：长文本默认收起，可展开全文；预览高度支持 4、6、8 行。
- **桌面便签**：创建、编辑和删除便签，正文过长时自动折叠。
- **截图便签**：可粘贴、拖放或选择 PNG、JPEG、WebP、GIF 图片。
- **轻量边缘形态**：收起后只保留一个图标，可拖动，也可隐藏到系统托盘。
- **全局快捷键**：在其他应用中使用 `Ctrl + Alt + Space` 展开或收起。
- **采集控制与设置**：随时暂停采集，显示偏好会自动保存在本机。

## 安装

### Windows 安装包

前往 [Releases](../../releases/latest) 下载最新版本：

- `ClipNote_*_x64-setup.exe`：推荐，大多数用户直接使用。
- `ClipNote_*_x64_en-US.msi`：适合 MSI 部署或企业环境。

当前构建面向 Windows 10/11 x64。若系统缺少 Microsoft Edge WebView2 Runtime，安装程序或系统会提示补充。

### 从源码运行

先准备以下环境：

- Node.js 22 LTS 与 pnpm
- Rust stable 工具链
- Windows C++ 构建工具与 WebView2 开发环境

克隆仓库后，在项目目录中运行：

```powershell
pnpm install
pnpm tauri dev
```

## 使用

| 操作 | 方式 |
| --- | --- |
| 展开 / 收起工作台 | `Ctrl + Alt + Space` |
| 展开边缘图标 | 单击图标 |
| 移动边缘图标 | 按住并拖动 |
| 隐藏到托盘 | 右键边缘图标 |
| 从托盘恢复 | 单击托盘图标，或选择“打开 ClipNote” |
| 暂停 / 恢复采集 | 顶部状态按钮、设置页或托盘菜单 |
| 快速收起 | 点击右上角箭头，或按 `Esc` |

长剪贴板内容默认显示 6 行。点击“展开全文”查看完整内容，也可在设置中调整为 4 行或 8 行。

## 本地数据与隐私

ClipNote 不需要账号，也不依赖云服务。剪贴板记录、便签、截图和采集状态保存在应用数据目录中的 `clipnote.sqlite3`；界面显示偏好保存在本地 WebView 存储中。

- 当前版本只自动采集文本剪贴板，不会把剪贴板内容上传到网络。
- 截图仅在用户主动添加到便签时保存。
- 单张便签图片前端限制为 4 MB，支持 PNG、JPEG、WebP 和 GIF。
- 退出应用可通过系统托盘菜单完成。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面运行时 | Tauri 2 |
| 原生能力 | Rust、arboard、rusqlite |
| 界面 | React 19、TypeScript、Vite |
| 状态与动效 | Zustand、Motion |
| 数据库 | SQLite（本地文件） |
| 测试 | Vitest、Testing Library、Playwright |

## 项目结构

```text
src/
  app/                 应用编排与数据流
  bridge/              Tauri 命令和浏览器预览桥接
  features/library/    剪贴板资料库
  features/notes/      便签与截图附件
  features/settings/   本地显示偏好
  features/shell/      边缘图标、工作台与导航
src-tauri/src/
  data.rs              剪贴板采集与 SQLite 持久化
  window.rs            窗口展开、收起、拖动与隐藏
  shortcuts.rs         全局快捷键
  tray.rs              系统托盘
tests/e2e/             Chromium 交互与视觉回归
```

## 开发与验证

```powershell
# 前端单元测试
pnpm test

# 代码检查与生产构建
pnpm lint
pnpm build

# 浏览器交互和视觉回归
pnpm test:e2e

# Rust 测试与静态检查
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

## 打包

```powershell
pnpm tauri build
```

Windows 安装包会生成到：

```text
src-tauri/target/release/bundle/msi/
src-tauri/target/release/bundle/nsis/
```

## 当前版本

ClipNote 目前处于 `0.1.0` 阶段，核心的剪贴板采集、搜索、收藏、便签、截图附件、长文本折叠、托盘和快捷键流程已经可用。欢迎通过 Issue 提交问题和建议。
