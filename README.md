# ClipNote

ClipNote 是一个本地优先的 Windows 文本剪贴板与便签工作台。Tauri/Rust 负责剪贴板采集、SQLite 持久化、托盘和全局快捷键，React 负责资料库、搜索、收藏与便签界面。

## 开发

```powershell
pnpm install
pnpm tauri dev
```

全局展开/收起快捷键为 `Ctrl+Alt+Space`。
折叠标签顶部可拖动定位，也可隐藏到托盘；点击托盘图标或使用快捷键即可恢复。

## 验证

```powershell
pnpm test
pnpm lint
pnpm build
pnpm test:e2e
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```
