import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import type { ShellMode } from "../features/shell/useShellStore";
import { builtinPet, type PetDefinition, type PetSummary } from "../features/pets/types";
import type { ClipItem, Note, NoteInput } from "../types/content";

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

type BrowserState = {
  clips: ClipItem[];
  notes: Note[];
  paused: boolean;
};

const browserStorageKey = "clipnote-browser-data-v1";
const browserAutostartKey = "clipnote-browser-autostart-v1";
const browserSelectedPetKey = "clipnote-browser-selected-pet-v1";
const browserListeners = {
  clips: new Set<() => void>(),
  capture: new Set<(paused: boolean) => void>(),
};

function readBrowserState(): BrowserState {
  try {
    const stored = window.localStorage.getItem(browserStorageKey);
    if (stored) {
      const state = JSON.parse(stored) as BrowserState;
      state.notes = state.notes.map((note) => ({
        ...note,
        imageData: note.imageData ?? "",
      }));
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
  listNotes: () =>
    invokeOr<Note[]>("list_notes", undefined, () => readBrowserState().notes),
  createNote: (input: NoteInput) =>
    invokeOr<Note>("create_note", { input }, () => {
      const state = readBrowserState();
      const timestamp = Math.floor(Date.now() / 1000);
      const note: Note = {
        id: nextBrowserId(state.notes),
        title:
          input.title.trim() ||
          input.body.trim().split(/\r?\n/, 1)[0] ||
          (input.imageData ? "图片便签" : "未命名便签"),
        body: input.body.trim(),
        tone: input.tone,
        imageData: input.imageData,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.notes.unshift(note);
      writeBrowserState(state);
      return note;
    }),
  updateNote: (id: number, input: NoteInput) =>
    invokeOr<Note>("update_note", { id, input }, () => {
      const state = readBrowserState();
      const index = state.notes.findIndex((note) => note.id === id);
      if (index < 0) throw new Error("便签不存在");
      const note = {
        ...state.notes[index],
        ...input,
        title:
          input.title.trim() ||
          input.body.trim().split(/\r?\n/, 1)[0] ||
          (input.imageData ? "图片便签" : "未命名便签"),
        body: input.body.trim(),
        updatedAt: Math.floor(Date.now() / 1000),
      };
      state.notes[index] = note;
      writeBrowserState(state);
      return note;
    }),
  deleteNote: (id: number) =>
    invokeOr<void>("delete_note", { id }, () => {
      const state = readBrowserState();
      state.notes = state.notes.filter((note) => note.id !== id);
      writeBrowserState(state);
    }),
};
