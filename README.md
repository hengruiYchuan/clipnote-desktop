<div align="center">

# ClipNote

**贴在桌面边缘的轻量剪贴板与便签工具**

本地采集、随手搜索、快速收起。内容只保存在你的 Windows 设备中。

![Windows](https://img.shields.io/badge/Windows-10%20%2F%2011-2f6f68?style=flat-square)
![Tauri](https://img.shields.io/badge/Tauri-2.11-df6747?style=flat-square)
![React](https://img.shields.io/badge/React-19-26231f?style=flat-square)
![Version](https://img.shields.io/badge/version-0.3.0-b68632?style=flat-square)

</div>

<p align="center">
  <img src="docs/images/clipnote-library.png" width="48%" alt="ClipNote 剪贴板长文本折叠界面" />
  <img src="docs/images/clipnote-settings.png" width="48%" alt="ClipNote 设置界面" />
</p>

<p align="center">
  <img src="docs/images/clipnote-pet.png" width="56" height="56" alt="ClipNote 原创纸片夹桌宠" />
  <br />
  <sub>收起后化身 56 x 56 的原创纸片夹桌宠</sub>
</p>

## 为什么做 ClipNote

复制过的命令、链接和临时文字经常只在几分钟内有用，却很容易被下一次复制覆盖。ClipNote 把这些工作碎片留在桌面边缘：需要时展开，不需要时缩成一个 `56 × 56` 图标，不占任务栏，也不打断当前工作。

## 功能

- **自动采集文本剪贴板**：识别普通文本、链接、代码和文件路径，不占用系统 `Ctrl + V`。
- **本地资料库**：按时间浏览，支持搜索、收藏、再次复制和删除。
- **剪贴板转便签**：单条一键转为便签，也可勾选多条按顺序合并，并保留来源记录。
- **剪贴板智能操作**：本地完成 JSON 美化、空白清理、网址提取和 Base64；按需调用 AI 摘要、翻译、润色或执行自定义要求。
- **长内容折叠**：长文本默认收起，可展开全文；预览高度支持 4、6、8 行。
- **桌面便签**：创建、编辑和删除便签，正文过长时自动折叠。
- **独立桌面便签**：把便签固定成可拖动、可缩放、可置顶的独立窗口，直接编辑并在重启后恢复；再次点击图钉即可收回。
- **截图便签**：可一次粘贴、拖放或选择多张图片，并按插入位置嵌入文字内容。
- **Markdown 导出**：便签可直接导出为 `.md`，图片写入同目录资源文件夹并使用相对地址引用。
- **批量 Markdown**：勾选多张便签后可合并为一个 `.md`，图文顺序和图片资源完整保留。
- **原创桌宠形态**：收起后化身 56 x 56 的纸片夹桌宠，带有克制的呼吸、眨眼和状态动效。
- **自定义桌宠**：可导入标准宠物包，在设置页直接选择、预览或删除。
- **AI 形象工坊**：支持第三方 OpenAI 兼容接口；完整动画模式分别生成待机、暂停、捕获、拖动和错误五张状态原画，再组装动画图集。
- **本地加密密码本**：独立主密码、模糊搜索、强密码生成、安全复制和闲置自动锁定。
- **密码条目管理**：支持标签筛选、收藏、置顶、最近使用排序、网址快捷打开和删除确认。
- **加密备份与导入**：导出 `.clipvault` 加密备份，可合并或覆盖恢复；支持常见密码管理器 CSV 批量预览、去重与导入。
- **完整数据备份**：导出 `.clipnote` 数据包，包含主数据库、加密密码本、界面偏好和自定义桌宠；恢复前校验并保留回滚副本。
- **浏览器填充扩展**：通过本机配对码连接 Chrome/Edge，按当前网站筛选账号，点击候选后填充登录表单。
- **位置记忆**：桌宠可自由拖动，重启后恢复到上次位置；显示器变化时自动回到可见区域。
- **开机启动**：可在设置页选择登录 Windows 后自动启动，随时可以关闭。
- **轻量常驻**：不占任务栏，支持右键隐藏到系统托盘。
- **全局快捷键**：在其他应用中使用 `Ctrl + Alt + Space` 展开或收起。
- **采集控制与设置**：随时暂停采集，显示偏好会自动保存在本机。
- **克制的悬停提示**：剪贴板操作按钮只显示“复制”“收藏”等动作名称，不在悬停层重复展示剪贴板正文。
- **结束卡死窗口**：从设置页点选白屏或无响应窗口，核对程序、标题、PID 和路径后处理；普通应用可结束进程，点击穿透型白屏只关闭或隐藏精确窗口，Windows 关键进程仍受保护。

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
| 锁定密码本 | 密码本右上角锁定按钮 |
| 备份、恢复或修改主密码 | 密码本 → 设置 |
| 批量导入密码 | 密码本右上角“从 CSV 批量导入” |
| 浏览器自动填充 | 安装扩展后，密码本 → 设置 → 复制配对码 |
| 设计 AI 桌宠 | 设置 → 桌宠 → AI 设计 |
| 导出或恢复完整数据 | 设置 → 数据备份 → 导出 / 恢复 |
| 固定 / 收回独立桌面便签 | 便签卡片 → 图钉按钮；固定后再次点击即可收回 |
| 智能处理剪贴板 | 剪贴板卡片 → 星光按钮 |
| 结束白屏或卡死窗口 | 设置 → 系统工具 → 选择窗口，点击目标后确认 |
| 快速收起 | 点击右上角箭头，或按 `Esc` |

长剪贴板内容默认显示 6 行。点击“展开全文”查看完整内容，也可在设置中调整为 4 行或 8 行。

### 密码本备份与批量导入

- 导出的 `.clipvault` 是密码本 SQLite 的一致性加密副本，仍由导出时的主密码保护。
- 恢复时可选择“合并”或“覆盖”。合并会跳过相同名称、账号和网址的条目；覆盖前会在应用数据目录保留 `vault.before-restore.sqlite3` 回滚副本。
- CSV 导入支持 Chrome/Edge、Bitwarden 和常见 1Password 字段名称。导入前会显示不含明文密码的预览，并标出重复项或缺少密码的行。
- CSV 文件需为 UTF-8，最大 10 MB、5000 行。导入完成后请妥善处理原始明文 CSV。

### Chrome / Edge 自动填充

仓库中的 `browser-extension/` 是 Manifest V3 扩展，可直接以开发者模式加载：

1. 在 Chrome 打开 `chrome://extensions`，或在 Edge 打开 `edge://extensions`。
2. 开启“开发者模式”，选择“加载已解压的扩展程序”，选择项目的 `browser-extension` 目录。
3. 打开 ClipNote 密码本并解锁，在“密码本设置 → 浏览器自动填充”中复制配对码。
4. 点击浏览器工具栏中的 ClipNote 扩展，粘贴并保存配对码。
5. 在登录页面打开扩展，可按当前域名或关键词模糊搜索；点击账号后才会把该条凭据填入页面。

桌面端服务只监听 `127.0.0.1:32145`。候选接口仅返回名称、账号、网址和标签摘要；扩展在用户选择单条记录后才请求密码。换新配对码会立即使旧配对失效。

## 本地数据与隐私

ClipNote 不需要账号。剪贴板记录、便签、截图和采集状态保存在应用数据目录中的 `clipnote.sqlite3`；密码本使用独立的 `vault.sqlite3`；界面显示偏好保存在本地 WebView 存储中。

- 当前版本只自动采集文本剪贴板，不会把剪贴板内容上传到网络。
- 截图仅在用户主动添加到便签时保存。
- 每张便签最多 8 张图片，单图前端限制为 4 MB，支持 PNG、JPEG、WebP 和 GIF。
- 密码本使用 Argon2id 派生密钥与 XChaCha20-Poly1305 加密，主密钥只在解锁期间保留于 Rust 内存。
- 密码本主密码不会保存，也没有找回通道；请自行妥善保管。
- 从密码本复制的内容不会进入 ClipNote 采集记录，并会在剪贴板未被再次改动时于 30 秒后清除。
- 密码显示会在 15 秒后或窗口失焦时自动隐藏；复制按钮显示剩余清除时间。
- 浏览器配对码随机生成并保存在本机密码本设置中；扩展将其保存在浏览器本地扩展存储，网页脚本无法读取。
- OpenAI 兼容服务的 API Key 保存在 Windows 凭据管理器。只有主动生成桌宠或点击 AI 文本操作时，对应描述、参考图或待处理文本才会发送到所配置的服务。
- JSON、空白、网址和 Base64 等本地智能操作不发送网络请求。
- 退出应用可通过系统托盘菜单完成。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面运行时 | Tauri 2 |
| 原生能力 | Rust、arboard、rusqlite、Windows Credential Manager |
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
  features/pets/       桌宠播放器、画廊与 AI 形象工坊
  features/settings/   本地显示偏好
  features/shell/      边缘图标、工作台与导航
  features/vault/      密码本解锁、条目、导入与设置界面
src-tauri/src/
  ai_pets.rs           AI 图像 Provider 与凭据管理
  backup.rs            .clipnote 完整备份、校验、恢复与回滚
  data.rs              剪贴板采集与 SQLite 持久化
  pets.rs              宠物包校验、导入与图集组装
  vault/               密钥派生、加密存储、备份导入、本机填充服务与安全剪贴板
  process_tools.rs      Windows 窗口点选、进程识别与受保护的进程终止
  window.rs            主窗口与独立桌面便签窗口管理
  shortcuts.rs         全局快捷键
  tray.rs              系统托盘
tests/e2e/             Chromium 交互与视觉回归
browser-extension/     Chrome/Edge Manifest V3 密码填充扩展
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

ClipNote `0.3.0` 包含标准化自定义桌宠、AI 形象工坊和本地加密密码本。当前 `main` 分支在此基础上加入剪贴板与便签联动、`.clipnote` 完整备份、可固定与收回的独立桌面便签、剪贴板智能操作和五状态 AI 动画桌宠，并增强了密码本、Chrome/Edge 填充、多图便签、批量 Markdown 导出和卡死窗口处理。
