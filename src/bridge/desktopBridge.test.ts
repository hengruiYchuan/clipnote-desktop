import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const listen = vi.fn();
const enableAutostart = vi.fn();
const disableAutostart = vi.fn();
const isAutostartEnabled = vi.fn();
const openDialog = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));
vi.mock("@tauri-apps/plugin-autostart", () => ({
  enable: enableAutostart,
  disable: disableAutostart,
  isEnabled: isAutostartEnabled,
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: openDialog }));

describe("desktop bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    invoke.mockReset();
    listen.mockReset();
    enableAutostart.mockReset();
    disableAutostart.mockReset();
    isAutostartEnabled.mockReset();
    openDialog.mockReset();
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

  it("subscribes before reading the current native shell mode", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    const order: string[] = [];
    listen.mockImplementation(async (_event, handler) => {
      order.push("listen");
      handler({ payload: "expanded" });
      return vi.fn();
    });
    invoke.mockImplementation(async () => {
      order.push("read");
      return "collapsed";
    });
    const { desktopBridge } = await import("./desktopBridge");
    const handler = vi.fn();

    await desktopBridge.onModeChanged(handler);

    expect(order).toEqual(["listen", "read"]);
    expect(listen).toHaveBeenCalledWith("shell-mode-changed", expect.any(Function));
    expect(invoke).toHaveBeenCalledWith("get_main_window_mode");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("expanded");
  });

  it("reports the current native mode when no event arrives during setup", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    listen.mockResolvedValue(vi.fn());
    invoke.mockResolvedValue("expanded");
    const { desktopBridge } = await import("./desktopBridge");
    const handler = vi.fn();

    await desktopBridge.onModeChanged(handler);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith("expanded");
  });

  it("keeps the native listener when the initial mode read fails", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    let notify: (event: { payload: "expanded" }) => void = () => undefined;
    const dispose = vi.fn();
    listen.mockImplementation(async (_event, handler) => {
      notify = handler;
      return dispose;
    });
    invoke.mockRejectedValue(new Error("mode unavailable"));
    const { desktopBridge } = await import("./desktopBridge");
    const handler = vi.fn();

    const unlisten = await desktopBridge.onModeChanged(handler);
    notify({ payload: "expanded" });

    expect(unlisten).toBe(dispose);
    expect(handler).toHaveBeenCalledWith("expanded");
  });

  it("does not throw in the browser preview", async () => {
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
    const { desktopBridge } = await import("./desktopBridge");

    await expect(desktopBridge.collapse()).resolves.toBeUndefined();
    await expect(desktopBridge.onModeChanged(vi.fn())).resolves.toBeTypeOf("function");
  });

  it("uses the native autostart plugin inside Tauri", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    isAutostartEnabled.mockResolvedValue(true);
    enableAutostart.mockResolvedValue(undefined);
    const { desktopBridge } = await import("./desktopBridge");

    await expect(desktopBridge.getAutostartEnabled()).resolves.toBe(true);
    await desktopBridge.setAutostartEnabled(true);

    expect(isAutostartEnabled).toHaveBeenCalledOnce();
    expect(enableAutostart).toHaveBeenCalledOnce();
  });

  it("imports a selected pet manifest through the native dialog", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    openDialog.mockResolvedValue("C:\\Pets\\mint-bot\\pet.json");
    invoke.mockResolvedValue({ id: "mint-bot" });
    const { desktopBridge } = await import("./desktopBridge");

    await desktopBridge.importPet();

    expect(invoke).toHaveBeenCalledWith("import_pet", {
      manifestPath: "C:\\Pets\\mint-bot\\pet.json",
    });
  });
});
