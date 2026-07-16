import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const listen = vi.fn();
const enableAutostart = vi.fn();
const disableAutostart = vi.fn();
const isAutostartEnabled = vi.fn();
const openDialog = vi.fn();
const saveDialog = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));
vi.mock("@tauri-apps/plugin-autostart", () => ({
  enable: enableAutostart,
  disable: disableAutostart,
  isEnabled: isAutostartEnabled,
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: openDialog, save: saveDialog }));

describe("desktop bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    invoke.mockReset();
    listen.mockReset();
    enableAutostart.mockReset();
    disableAutostart.mockReset();
    isAutostartEnabled.mockReset();
    openDialog.mockReset();
    saveDialog.mockReset();
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

  it("passes the selected window target back to the native terminator", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    const target = {
      pid: 7312,
      processName: "notepad.exe",
      windowTitle: "无响应",
      executablePath: "C:\\Windows\\System32\\notepad.exe",
      windowHandle: 7312,
      windowClass: "Notepad",
      closeWindowOnly: false,
    };
    invoke.mockResolvedValueOnce(target).mockResolvedValueOnce(undefined);
    const { desktopBridge } = await import("./desktopBridge");

    await expect(desktopBridge.pickWindowProcess()).resolves.toEqual(target);
    await desktopBridge.terminateWindowProcess(target);

    expect(invoke).toHaveBeenNthCalledWith(1, "pick_window_process", undefined);
    expect(invoke).toHaveBeenNthCalledWith(2, "terminate_window_process", { target });
  });

  it("migrates legacy browser notes into inline images", async () => {
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
    window.localStorage.setItem("clipnote-browser-data-v1", JSON.stringify({
      clips: [],
      paused: false,
      notes: [{
        id: 1,
        title: "旧截图",
        body: "截图说明",
        tone: "paper",
        imageData: "data:image/png;base64,bGVnYWN5",
        createdAt: 1,
        updatedAt: 1,
      }],
    }));
    const { desktopBridge } = await import("./desktopBridge");

    const [note] = await desktopBridge.listNotes();

    expect(note.body).toBe("{{clipnote-image:legacy}}\n\n截图说明");
    expect(note.images).toEqual([
      { id: "legacy", dataUrl: "data:image/png;base64,bGVnYWN5" },
    ]);
    window.localStorage.removeItem("clipnote-browser-data-v1");
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

  it("passes an OpenAI-compatible image provider to the native bridge", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    invoke.mockResolvedValue(undefined);
    const { desktopBridge } = await import("./desktopBridge");
    const input = {
      baseUrl: "http://127.0.0.1:9999/v1",
      apiKey: "token",
      model: "gpt-image-2",
    };

    await desktopBridge.testAiPetProvider(input);
    await desktopBridge.setAiPetProvider(input);

    expect(invoke).toHaveBeenNthCalledWith(1, "test_ai_pet_provider", { input });
    expect(invoke).toHaveBeenNthCalledWith(2, "set_ai_pet_provider", { input });
  });

  it("exports a note to a selected Markdown path", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    saveDialog.mockResolvedValue("C:\\Notes\\发布记录.md");
    invoke.mockResolvedValue("C:\\Notes\\发布记录.md");
    const { desktopBridge } = await import("./desktopBridge");

    const exported = await desktopBridge.exportNoteMarkdown({
      id: 7,
      title: "发布:记录",
      body: "构建完成",
      tone: "paper",
      images: [],
      sourceClipIds: [], desktopPinned: false, desktopX: null, desktopY: null,
      desktopWidth: 320, desktopHeight: 260, alwaysOnTop: true,
      createdAt: 1,
      updatedAt: 1,
    });

    expect(exported).toBe(true);
    expect(saveDialog).toHaveBeenCalledWith({
      defaultPath: "发布_记录.md",
      filters: [{ name: "Markdown 文档", extensions: ["md"] }],
    });
    expect(invoke).toHaveBeenCalledWith("export_note_markdown", {
      id: 7,
      destination: "C:\\Notes\\发布记录.md",
    });
  });

  it("exports selected notes into one Markdown path", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    saveDialog.mockResolvedValue("C:\\Notes\\ClipNote-便签合集.md");
    invoke.mockResolvedValue("C:\\Notes\\ClipNote-便签合集.md");
    const { desktopBridge } = await import("./desktopBridge");
    const notes = [
      { id: 3, title: "三", body: "", tone: "paper" as const, images: [], sourceClipIds: [], desktopPinned: false, desktopX: null, desktopY: null, desktopWidth: 320, desktopHeight: 260, alwaysOnTop: true, createdAt: 1, updatedAt: 1 },
      { id: 8, title: "八", body: "", tone: "mint" as const, images: [], sourceClipIds: [], desktopPinned: false, desktopX: null, desktopY: null, desktopWidth: 320, desktopHeight: 260, alwaysOnTop: true, createdAt: 1, updatedAt: 1 },
    ];

    await expect(desktopBridge.exportNotesMarkdown(notes)).resolves.toBe(true);

    expect(saveDialog).toHaveBeenCalledWith({
      defaultPath: "ClipNote-便签合集.md",
      filters: [{ name: "Markdown 文档", extensions: ["md"] }],
    });
    expect(invoke).toHaveBeenCalledWith("export_notes_markdown", {
      ids: [3, 8],
      destination: "C:\\Notes\\ClipNote-便签合集.md",
    });
  });
});
