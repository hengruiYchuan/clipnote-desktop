import type { ClipItem, Note } from "../types/content";

export const sampleClip: ClipItem = {
  id: 1,
  kind: "code",
  source: "系统剪贴板",
  capturedAt: 1_700_000_000,
  title: "启动开发环境",
  preview: "pnpm tauri dev",
  favorite: false,
  useCount: 2,
};

export const sampleNote: Note = {
  id: 1,
  title: "MVP 边界",
  body: "剪贴板、便签、搜索、本地优先。",
  tone: "sun",
  createdAt: 1_700_000_000,
  updatedAt: 1_700_000_000,
};
