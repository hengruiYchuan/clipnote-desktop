import { invoke } from "@tauri-apps/api/core";

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
};
