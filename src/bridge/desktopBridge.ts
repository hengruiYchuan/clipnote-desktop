import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ShellMode } from "../features/shell/useShellStore";

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

export const desktopBridge = {
  expand: () => call("expand_main_window"),
  collapse: () => call("collapse_main_window"),
  toggle: () => call("toggle_main_window"),
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
};
