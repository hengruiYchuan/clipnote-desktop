import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import type { ShellMode } from "../features/shell/useShellStore";
import type { WindowProcessTarget } from "../features/settings/types";
import {
  builtinPet,
  type AiPetProviderInput,
  type AiPetProviderStatus,
  type PetDefinition,
  type PetSummary,
} from "../features/pets/types";
import type { ClipItem, DesktopNoteStateInput, Note, NoteInput } from "../types/content";
import type {
  BrowserBridgeInfo,
  VaultEntry,
  VaultEntryInput,
  VaultEntrySummary,
  VaultImportPreviewRow,
  VaultImportResult,
  VaultRestoreResult,
  VaultStatus,
} from "../features/vault/types";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function call(command: string) {
  if (isTauri()) {
    await invoke(command);
  }
}

async function callWithArgs(command: string, args: Record<string, unknown>) {
  if (isTauri()) await invoke(command, args);
}

type BrowserState = {
  clips: ClipItem[];
  notes: Note[];
  paused: boolean;
};

const browserStorageKey = "clipnote-browser-data-v1";
const browserAutostartKey = "clipnote-browser-autostart-v1";
const browserSelectedPetKey = "clipnote-browser-selected-pet-v1";
const invalidWindowsFileNameChars = '<>:"/\\|?*';
const browserListeners = {
  clips: new Set<() => void>(),
  notes: new Set<() => void>(),
  capture: new Set<(paused: boolean) => void>(),
  vaultLock: new Set<() => void>(),
};

let browserVault: {
  initialized: boolean;
  unlocked: boolean;
  password: string;
  autoLockSeconds: number;
  entries: VaultEntry[];
} = {
  initialized: false,
  unlocked: false,
  password: "",
  autoLockSeconds: 300,
  entries: [],
};
let browserAiPetProvider: AiPetProviderStatus & { apiKey: string } = {
  provider: "openai-compatible",
  configured: false,
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-image-1.5",
  textModel: "gpt-4.1-mini",
  apiKey: "",
};

export type FullBackupRestoreResult = {
  preferencesJson: string;
  clips: number;
  notes: number;
};

function readBrowserState(): BrowserState {
  try {
    const stored = window.localStorage.getItem(browserStorageKey);
    if (stored) {
      const state = JSON.parse(stored) as BrowserState;
      state.notes = state.notes.map((note) => {
        const legacyImageData = (note as Note & { imageData?: string }).imageData ?? "";
        const images = Array.isArray(note.images)
          ? note.images
          : legacyImageData
            ? [{ id: "legacy", dataUrl: legacyImageData }]
            : [];
        const body = legacyImageData && !note.body.includes("{{clipnote-image:legacy}}")
          ? `{{clipnote-image:legacy}}${note.body ? `\n\n${note.body}` : ""}`
          : note.body;
        return {
          ...note,
          body,
          images,
          sourceClipIds: note.sourceClipIds ?? [],
          desktopPinned: note.desktopPinned ?? false,
          desktopX: note.desktopX ?? null,
          desktopY: note.desktopY ?? null,
          desktopWidth: note.desktopWidth ?? 320,
          desktopHeight: note.desktopHeight ?? 260,
          alwaysOnTop: note.alwaysOnTop ?? true,
        };
      });
      return state;
    }
  } catch {
    // Browser preview remains usable when storage is unavailable.
  }
  return { clips: [], notes: [], paused: false };
}

function writeBrowserState(state: BrowserState) {
  try {
    window.localStorage.setItem(browserStorageKey, JSON.stringify(state));
  } catch {
    // Storage can be disabled in embedded preview environments.
  }
}

function nextBrowserId(items: { id: number }[]) {
  return items.reduce((maximum, item) => Math.max(maximum, item.id), 0) + 1;
}

function browserNoteTitle(input: NoteInput) {
  if (input.title.trim()) return input.title.trim();
  const firstTextLine = input.body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("{{clipnote-image:"));
  return firstTextLine || (input.images.length ? "图片便签" : "未命名便签");
}

async function invokeOr<T>(
  command: string,
  args: Record<string, unknown> | undefined,
  browserFallback: () => T | Promise<T>,
): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : browserFallback();
}

function browserSubscription<T>(listeners: Set<(value: T) => void>, handler: (value: T) => void) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export const desktopBridge = {
  expand: () => call("expand_main_window"),
  collapse: () => call("collapse_main_window"),
  startDragging: () => call("start_drag_main_window"),
  hide: () => call("hide_main_window"),
  quit: () => call("exit_app"),
  openDesktopNote: (id: number) => callWithArgs("open_desktop_note", { id }),
  saveDesktopNoteGeometry: (id: number) => callWithArgs("save_desktop_note_geometry", { id }),
  setDesktopNoteAlwaysOnTop: (id: number, alwaysOnTop: boolean) =>
    callWithArgs("set_desktop_note_always_on_top", { id, alwaysOnTop }),
  startDragDesktopNote: (id: number) => callWithArgs("start_drag_desktop_note", { id }),
  retractDesktopNote: (id: number) => callWithArgs("retract_desktop_note", { id }),
  pickWindowProcess: () =>
    invokeOr<WindowProcessTarget | null>("pick_window_process", undefined, () => ({
      pid: 4242,
      processName: "preview.exe",
      windowTitle: "浏览器预览窗口",
      executablePath: "C:\\Program Files\\Preview\\preview.exe",
      windowHandle: 4242,
      windowClass: "PreviewWindow",
      closeWindowOnly: false,
    })),
  terminateWindowProcess: (target: WindowProcessTarget) =>
    invokeOr<void>("terminate_window_process", { target }, () => undefined),
  toggle: () => call("toggle_main_window"),
  getAutostartEnabled: () =>
    isTauri()
      ? isAutostartEnabled()
      : Promise.resolve(window.localStorage.getItem(browserAutostartKey) === "true"),
  setAutostartEnabled: async (enabled: boolean) => {
    if (isTauri()) {
      if (enabled) await enableAutostart();
      else await disableAutostart();
      return;
    }
    window.localStorage.setItem(browserAutostartKey, String(enabled));
  },
  listPets: () => invokeOr<PetSummary[]>("list_pets", undefined, () => [builtinPet]),
  getSelectedPet: () =>
    invokeOr<PetDefinition | null>("get_selected_pet", undefined, () => null),
  selectPet: (id: string) =>
    invokeOr<void>("select_pet", { id }, () => {
      if (id !== builtinPet.id) throw new Error("浏览器预览只提供默认桌宠");
      window.localStorage.setItem(browserSelectedPetKey, id);
    }),
  importPet: async () => {
    if (!isTauri()) return null;
    const manifestPath = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "ClipNote 宠物包", extensions: ["json"] }],
    });
    if (typeof manifestPath !== "string") return null;
    return invoke<PetSummary>("import_pet", { manifestPath });
  },
  deletePet: (id: string) => invokeOr<void>("delete_pet", { id }, () => undefined),
  onModeChanged: async (
    handler: (mode: ShellMode) => void,
  ): Promise<UnlistenFn> => {
    if (!isTauri()) return () => undefined;
    let receivedEvent = false;
    const unlisten = await listen<ShellMode>("shell-mode-changed", (event) => {
      receivedEvent = true;
      handler(event.payload);
    });
    try {
      const mode = await invoke<ShellMode>("get_main_window_mode");
      if (!receivedEvent) handler(mode);
    } catch {
      // Future mode events still keep the renderer synchronized.
    }
    return unlisten;
  },
  listClips: () =>
    invokeOr<ClipItem[]>("list_clips", undefined, () => readBrowserState().clips),
  setClipFavorite: (id: number, favorite: boolean) =>
    invokeOr<void>("set_clip_favorite", { id, favorite }, () => {
      const state = readBrowserState();
      state.clips = state.clips.map((item) =>
        item.id === id ? { ...item, favorite } : item,
      );
      writeBrowserState(state);
      browserListeners.clips.forEach((listener) => listener());
    }),
  copyClip: (id: number) =>
    invokeOr<void>("copy_clip", { id }, async () => {
      const state = readBrowserState();
      const item = state.clips.find((clip) => clip.id === id);
      if (!item) throw new Error("剪贴板记录不存在");
      await navigator.clipboard?.writeText(item.preview);
      item.useCount += 1;
      writeBrowserState(state);
      browserListeners.clips.forEach((listener) => listener());
    }),
  deleteClip: (id: number) =>
    invokeOr<void>("delete_clip", { id }, () => {
      const state = readBrowserState();
      state.clips = state.clips.filter((item) => item.id !== id);
      writeBrowserState(state);
      browserListeners.clips.forEach((listener) => listener());
    }),
  deleteUnfavoritedClips: () =>
    invokeOr<number>("delete_unfavorited_clips", undefined, () => {
      const state = readBrowserState();
      const previousCount = state.clips.length;
      state.clips = state.clips.filter((item) => item.favorite);
      const deleted = previousCount - state.clips.length;
      writeBrowserState(state);
      if (deleted > 0) browserListeners.clips.forEach((listener) => listener());
      return deleted;
    }),
  getCapturePaused: () =>
    invokeOr<boolean>("get_capture_paused", undefined, () => readBrowserState().paused),
  setCapturePaused: (paused: boolean) =>
    invokeOr<void>("set_capture_paused", { paused }, () => {
      const state = readBrowserState();
      state.paused = paused;
      writeBrowserState(state);
      browserListeners.capture.forEach((listener) => listener(paused));
    }),
  onClipsChanged: async (handler: () => void): Promise<UnlistenFn> => {
    if (!isTauri()) return browserSubscription(browserListeners.clips, handler);
    return listen("clips-changed", handler);
  },
  onCaptureStateChanged: async (
    handler: (paused: boolean) => void,
  ): Promise<UnlistenFn> => {
    if (!isTauri()) return browserSubscription(browserListeners.capture, handler);
    return listen<boolean>("capture-state-changed", (event) => handler(event.payload));
  },
  onNotesChanged: async (handler: () => void): Promise<UnlistenFn> => {
    if (!isTauri()) return browserSubscription(browserListeners.notes, handler);
    return listen("notes-changed", handler);
  },
  listNotes: () =>
    invokeOr<Note[]>("list_notes", undefined, () => readBrowserState().notes),
  createNote: (input: NoteInput) =>
    invokeOr<Note>("create_note", { input }, () => {
      const state = readBrowserState();
      const timestamp = Math.floor(Date.now() / 1000);
      const note: Note = {
        id: nextBrowserId(state.notes),
        title: browserNoteTitle(input),
        body: input.body.trim(),
        tone: input.tone,
        images: input.images,
        sourceClipIds: [],
        desktopPinned: false,
        desktopX: null,
        desktopY: null,
        desktopWidth: 320,
        desktopHeight: 260,
        alwaysOnTop: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.notes.unshift(note);
      writeBrowserState(state);
      browserListeners.notes.forEach((listener) => listener());
      return note;
    }),
  getNote: (id: number) =>
    invokeOr<Note>("get_note", { id }, () => {
      const note = readBrowserState().notes.find((candidate) => candidate.id === id);
      if (!note) throw new Error("便签不存在");
      return note;
    }),
  createNoteFromClips: (ids: number[]) =>
    invokeOr<Note>("create_note_from_clips", { ids }, () => {
      const state = readBrowserState();
      const selected = ids.map((id) => {
        const clip = state.clips.find((candidate) => candidate.id === id);
        if (!clip) throw new Error("有剪贴板记录已不存在");
        return clip;
      });
      if (!selected.length) throw new Error("请选择剪贴板记录");
      const timestamp = Math.floor(Date.now() / 1000);
      const note: Note = {
        id: nextBrowserId(state.notes),
        title: selected.length === 1 ? selected[0].title : `来自剪贴板的 ${selected.length} 条内容`,
        body: selected.map((clip) => clip.preview.trim()).join("\n\n---\n\n"),
        tone: "paper",
        images: [],
        sourceClipIds: ids,
        desktopPinned: false,
        desktopX: null,
        desktopY: null,
        desktopWidth: 320,
        desktopHeight: 260,
        alwaysOnTop: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.notes.unshift(note);
      writeBrowserState(state);
      browserListeners.notes.forEach((listener) => listener());
      return note;
    }),
  updateNoteDesktopState: (id: number, input: DesktopNoteStateInput) =>
    invokeOr<Note>("update_note_desktop_state", { id, input }, () => {
      const state = readBrowserState();
      const index = state.notes.findIndex((note) => note.id === id);
      if (index < 0) throw new Error("便签不存在");
      state.notes[index] = { ...state.notes[index], ...input };
      writeBrowserState(state);
      browserListeners.notes.forEach((listener) => listener());
      return state.notes[index];
    }),
  updateNote: (id: number, input: NoteInput) =>
    invokeOr<Note>("update_note", { id, input }, () => {
      const state = readBrowserState();
      const index = state.notes.findIndex((note) => note.id === id);
      if (index < 0) throw new Error("便签不存在");
      const note = {
        ...state.notes[index],
        ...input,
        title: browserNoteTitle(input),
        body: input.body.trim(),
        updatedAt: Math.floor(Date.now() / 1000),
      };
      state.notes[index] = note;
      writeBrowserState(state);
      browserListeners.notes.forEach((listener) => listener());
      return note;
    }),
  deleteNote: (id: number) =>
    invokeOr<void>("delete_note", { id }, () => {
      const state = readBrowserState();
      state.notes = state.notes.filter((note) => note.id !== id);
      writeBrowserState(state);
      browserListeners.notes.forEach((listener) => listener());
    }),
  exportNoteMarkdown: async (note: Note) => {
    if (!isTauri()) return false;
    const safeTitle = Array.from(note.title, (character) =>
      invalidWindowsFileNameChars.includes(character) || character.charCodeAt(0) < 32
        ? "_"
        : character,
    )
      .join("")
      .trim()
      .slice(0, 80) || `便签-${note.id}`;
    const destination = await save({
      defaultPath: `${safeTitle}.md`,
      filters: [{ name: "Markdown 文档", extensions: ["md"] }],
    });
    if (typeof destination !== "string") return false;
    await invoke<string>("export_note_markdown", { id: note.id, destination });
    return true;
  },
  exportNotesMarkdown: async (notes: Note[]) => {
    if (!isTauri() || notes.length === 0) return false;
    const destination = await save({
      defaultPath: "ClipNote-便签合集.md",
      filters: [{ name: "Markdown 文档", extensions: ["md"] }],
    });
    if (typeof destination !== "string") return false;
    await invoke<string>("export_notes_markdown", {
      ids: notes.map((note) => note.id),
      destination,
    });
    return true;
  },
  exportFullBackup: async (preferences: unknown) => {
    if (!isTauri()) return false;
    const destination = await save({
      defaultPath: `ClipNote-${new Date().toISOString().slice(0, 10)}.clipnote`,
      filters: [{ name: "ClipNote 完整备份", extensions: ["clipnote"] }],
    });
    if (typeof destination !== "string") return false;
    await invoke<string>("export_full_backup", {
      destination,
      preferencesJson: JSON.stringify(preferences),
    });
    return true;
  },
  restoreFullBackup: async () => {
    if (!isTauri()) return null;
    const source = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "ClipNote 完整备份", extensions: ["clipnote"] }],
    });
    if (typeof source !== "string") return null;
    return invoke<FullBackupRestoreResult>("restore_full_backup", { source });
  },
  vaultStatus: () =>
    invokeOr<VaultStatus>("vault_status", undefined, () => ({
      initialized: browserVault.initialized,
      unlocked: browserVault.unlocked,
      autoLockSeconds: browserVault.autoLockSeconds,
    })),
  createVault: (password: string) =>
    invokeOr<void>("create_vault", { password }, () => {
      if (browserVault.initialized) throw new Error("密码本已经初始化");
      browserVault = { ...browserVault, initialized: true, unlocked: true, password };
    }),
  unlockVault: (password: string) =>
    invokeOr<void>("unlock_vault", { password }, () => {
      if (password !== browserVault.password) throw new Error("主密码错误");
      browserVault.unlocked = true;
    }),
  lockVault: () =>
    invokeOr<void>("lock_vault", undefined, () => {
      browserVault.unlocked = false;
      browserListeners.vaultLock.forEach((listener) => listener());
    }),
  listVaultEntries: () =>
    invokeOr<VaultEntrySummary[]>("list_vault_entries", undefined, () =>
      browserVault.entries
        .map(({ id, title, username, url, tags, favorite, pinned, lastUsedAt, updatedAt }) => ({
          id,
          title,
          username,
          url,
          tags,
          favorite,
          pinned,
          lastUsedAt,
          updatedAt,
        }))
        .sort((left, right) =>
          Number(right.pinned) - Number(left.pinned)
          || Number(right.favorite) - Number(left.favorite)
          || right.lastUsedAt - left.lastUsedAt
          || right.updatedAt - left.updatedAt,
        ),
    ),
  getVaultEntry: (id: string) =>
    invokeOr<VaultEntry>("get_vault_entry", { id }, () => {
      const entry = browserVault.entries.find((item) => item.id === id);
      if (!entry) throw new Error("密码条目不存在");
      return { ...entry, tags: [...entry.tags] };
    }),
  createVaultEntry: (input: VaultEntryInput) =>
    invokeOr<VaultEntry>("create_vault_entry", { input }, () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const entry = {
        ...input,
        id: globalThis.crypto?.randomUUID?.() ?? `preview-${timestamp}`,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      browserVault.entries.unshift(entry);
      return entry;
    }),
  updateVaultEntry: (id: string, input: VaultEntryInput) =>
    invokeOr<VaultEntry>("update_vault_entry", { id, input }, () => {
      const index = browserVault.entries.findIndex((entry) => entry.id === id);
      if (index < 0) throw new Error("密码条目不存在");
      const entry = {
        ...browserVault.entries[index],
        ...input,
        updatedAt: Math.floor(Date.now() / 1000),
      };
      browserVault.entries[index] = entry;
      return entry;
    }),
  deleteVaultEntry: (id: string) =>
    invokeOr<void>("delete_vault_entry", { id }, () => {
      browserVault.entries = browserVault.entries.filter((entry) => entry.id !== id);
    }),
  changeVaultPassword: (currentPassword: string, newPassword: string) =>
    invokeOr<void>("change_vault_password", { currentPassword, newPassword }, () => {
      if (currentPassword !== browserVault.password) throw new Error("主密码错误");
      browserVault.password = newPassword;
    }),
  setVaultAutoLock: (seconds: number) =>
    invokeOr<void>("set_vault_auto_lock", { seconds }, () => {
      browserVault.autoLockSeconds = seconds;
    }),
  exportVaultBackup: async () => {
    if (!isTauri()) return false;
    const destination = await save({
      defaultPath: "ClipNote-密码本备份.clipvault",
      filters: [{ name: "ClipNote 加密备份", extensions: ["clipvault"] }],
    });
    if (typeof destination !== "string") return false;
    await invoke<string>("export_vault_backup", { destination });
    return true;
  },
  selectVaultBackup: async () => {
    if (!isTauri()) return null;
    const source = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "ClipNote 加密备份", extensions: ["clipvault"] }],
    });
    return typeof source === "string" ? source : null;
  },
  restoreVaultBackup: (source: string, password: string, mode: "merge" | "replace") =>
    invoke<VaultRestoreResult>("restore_vault_backup", { source, password, mode }),
  selectVaultCsv: async () => {
    if (!isTauri()) return null;
    const source = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "密码管理器 CSV", extensions: ["csv"] }],
    });
    return typeof source === "string" ? source : null;
  },
  previewVaultCsv: (source: string) =>
    invoke<VaultImportPreviewRow[]>("preview_vault_csv", { source }),
  importVaultCsv: (source: string, selected: number[]) =>
    invoke<VaultImportResult>("import_vault_csv", { source, selected }),
  copyBrowserPairingToken: () =>
    invoke<BrowserBridgeInfo>("copy_browser_pairing_token"),
  rotateBrowserPairingToken: () =>
    invoke<BrowserBridgeInfo>("rotate_browser_pairing_token"),
  touchVaultActivity: () => invokeOr<void>("touch_vault_activity", undefined, () => undefined),
  setVaultEntryFavorite: (id: string, favorite: boolean) =>
    invokeOr<void>("set_vault_entry_favorite", { id, favorite }, () => {
      const entry = browserVault.entries.find((item) => item.id === id);
      if (!entry) throw new Error("密码条目不存在");
      entry.favorite = favorite;
    }),
  setVaultEntryPinned: (id: string, pinned: boolean) =>
    invokeOr<void>("set_vault_entry_pinned", { id, pinned }, () => {
      const entry = browserVault.entries.find((item) => item.id === id);
      if (!entry) throw new Error("密码条目不存在");
      entry.pinned = pinned;
    }),
  openVaultUrl: (id: string) =>
    invokeOr<void>("open_vault_url", { id }, () => {
      const entry = browserVault.entries.find((item) => item.id === id);
      if (!entry?.url) throw new Error("网址格式无效");
      entry.lastUsedAt = Math.floor(Date.now() / 1000);
      window.open(entry.url, "_blank", "noopener,noreferrer");
    }),
  copyVaultUsername: (id: string) =>
    invokeOr<number>("copy_vault_username", { id }, async () => {
      const entry = browserVault.entries.find((item) => item.id === id);
      if (!entry) throw new Error("密码条目不存在");
      await navigator.clipboard?.writeText(entry.username);
      entry.lastUsedAt = Math.floor(Date.now() / 1000);
      return entry.lastUsedAt + 30;
    }),
  copyVaultPassword: (id: string) =>
    invokeOr<number>("copy_vault_password", { id }, async () => {
      const entry = browserVault.entries.find((item) => item.id === id);
      if (!entry) throw new Error("密码条目不存在");
      await navigator.clipboard?.writeText(entry.password);
      entry.lastUsedAt = Math.floor(Date.now() / 1000);
      return entry.lastUsedAt + 30;
    }),
  onVaultLocked: async (handler: () => void): Promise<UnlistenFn> => {
    if (!isTauri()) return browserSubscription(browserListeners.vaultLock, handler);
    return listen("vault-locked", handler);
  },
  setVaultContentProtected: (contentProtected: boolean) =>
    invokeOr<void>(
      "set_vault_content_protected",
      { protected: contentProtected },
      () => undefined,
    ),
  aiPetProviderStatus: () =>
    invokeOr<AiPetProviderStatus>(
      "ai_pet_provider_status",
      undefined,
      () => ({
        provider: browserAiPetProvider.provider,
        configured: browserAiPetProvider.configured,
        baseUrl: browserAiPetProvider.baseUrl,
        model: browserAiPetProvider.model,
        textModel: browserAiPetProvider.textModel,
      }),
    ),
  setAiPetProvider: (input: AiPetProviderInput) =>
    invokeOr<void>("set_ai_pet_provider", { input }, () => {
      browserAiPetProvider = {
        provider: "openai-compatible",
        configured: true,
        baseUrl: input.baseUrl,
        model: input.model,
        textModel: input.textModel || browserAiPetProvider.textModel,
        apiKey: input.apiKey || browserAiPetProvider.apiKey,
      };
    }),
  testAiPetProvider: (input: AiPetProviderInput) =>
    invokeOr<void>("test_ai_pet_provider", { input }, () => undefined),
  clearAiPetApiKey: () =>
    invokeOr<void>("clear_ai_pet_api_key", undefined, () => {
      browserAiPetProvider = {
        ...browserAiPetProvider,
        configured: false,
        apiKey: "",
      };
    }),
  generateAiPet: (input: {
    name: string;
    description: string;
    prompt: string;
    style: string;
    referenceDataUrl: string;
    mode: "light" | "full";
  }) =>
    invokeOr<PetSummary>("generate_ai_pet", { input }, () => {
      throw new Error("AI 桌宠生成需要在桌面版中运行");
    }),
  onAiPetGenerationProgress: async (
    handler: (progress: { completed: number; total: number; state: string }) => void,
  ): Promise<UnlistenFn> => {
    if (!isTauri()) return () => undefined;
    return listen("ai-pet-generation-progress", (event) =>
      handler(event.payload as { completed: number; total: number; state: string }),
    );
  },
  smartTextAction: (input: { action: string; content: string; instruction?: string }) =>
    invokeOr<string>("smart_text_action", { input }, () => browserSmartTextAction(input)),
};

function browserSmartTextAction(input: { action: string; content: string }) {
  switch (input.action) {
    case "format-json": return JSON.stringify(JSON.parse(input.content), null, 2);
    case "clean-whitespace": return input.content.split(/\r?\n/).map((line) => line.trim().replace(/\s+/g, " ")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    case "extract-urls": return Array.from(input.content.matchAll(/https?:\/\/[^\s<>"']+/g), (match) => match[0]).join("\n");
    case "base64-encode": return window.btoa(unescape(encodeURIComponent(input.content)));
    case "base64-decode": return decodeURIComponent(escape(window.atob(input.content.trim())));
    default: throw new Error("AI 文本处理需要在桌面版中运行");
  }
}
