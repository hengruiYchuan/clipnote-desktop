import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

describe("desktop bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    invoke.mockReset();
  });

  it("invokes the native expand command inside Tauri", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    const { desktopBridge } = await import("./desktopBridge");

    await desktopBridge.expand();

    expect(invoke).toHaveBeenCalledWith("expand_main_window");
  });

  it("does not throw in the browser preview", async () => {
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
    const { desktopBridge } = await import("./desktopBridge");

    await expect(desktopBridge.collapse()).resolves.toBeUndefined();
  });
});
