import type { ClipItem, NotePreview } from "../types/content";

export const clipFixtures: ClipItem[] = [
  {
    id: "clip-1",
    kind: "code",
    source: "Windows Terminal",
    capturedAt: "2 分钟前",
    title: "启动 Tauri 开发环境",
    preview: "pnpm tauri dev",
    favorite: true,
    useCount: 4,
  },
  {
    id: "clip-2",
    kind: "link",
    source: "Microsoft Edge",
    capturedAt: "18 分钟前",
    title: "Tauri 2 · Window customization",
    preview: "https://v2.tauri.app/learn/window-customization/",
    favorite: false,
    useCount: 1,
  },
  {
    id: "clip-3",
    kind: "text",
    source: "Visual Studio Code",
    capturedAt: "昨天",
    title: "MVP 产品决策",
    preview: "先完成剪贴板与便签闭环，会议助手进入后续阶段。",
    favorite: false,
    useCount: 2,
  },
  {
    id: "clip-4",
    kind: "path",
    source: "文件资源管理器",
    capturedAt: "周一",
    title: "设计规格",
    preview: "docs/superpowers/specs/2026-07-14-clipnote-ai-design.md",
    favorite: true,
    useCount: 3,
  },
];

export const noteFixtures: NotePreview[] = [
  {
    id: "note-1",
    title: "MVP 边界",
    body: "剪贴板、便签、搜索、本地优先。",
    tone: "sun",
  },
  {
    id: "note-2",
    title: "开发检查",
    body: "",
    tone: "mint",
    checklist: [
      { label: "Tauri 编译探针", done: true },
      { label: "Editorial Desk 壳层", done: false },
      { label: "真实桌面截图验收", done: false },
    ],
  },
];
