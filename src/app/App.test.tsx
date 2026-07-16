import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({
  expand: vi.fn(),
  collapse: vi.fn(),
  quit: vi.fn(),
  pickWindowProcess: vi.fn(),
  terminateWindowProcess: vi.fn(),
  onModeChanged: vi.fn(),
  onClipsChanged: vi.fn(),
  onCaptureStateChanged: vi.fn(),
  onNotesChanged: vi.fn(),
  listClips: vi.fn(),
  listNotes: vi.fn(),
  getCapturePaused: vi.fn(),
  setCapturePaused: vi.fn(),
  getAutostartEnabled: vi.fn(),
  setAutostartEnabled: vi.fn(),
  listPets: vi.fn(),
  getSelectedPet: vi.fn(),
  selectPet: vi.fn(),
  importPet: vi.fn(),
  deletePet: vi.fn(),
  setClipFavorite: vi.fn(),
  copyClip: vi.fn(),
  deleteClip: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  openDesktopNote: vi.fn(),
  retractDesktopNote: vi.fn(),
  exportNoteMarkdown: vi.fn(),
  exportNotesMarkdown: vi.fn(),
  setVaultContentProtected: vi.fn(),
  vaultStatus: vi.fn(),
  createVault: vi.fn(),
  unlockVault: vi.fn(),
  lockVault: vi.fn(),
  listVaultEntries: vi.fn(),
  getVaultEntry: vi.fn(),
  createVaultEntry: vi.fn(),
  updateVaultEntry: vi.fn(),
  deleteVaultEntry: vi.fn(),
  changeVaultPassword: vi.fn(),
  setVaultAutoLock: vi.fn(),
  touchVaultActivity: vi.fn(),
  setVaultEntryFavorite: vi.fn(),
  setVaultEntryPinned: vi.fn(),
  openVaultUrl: vi.fn(),
  exportVaultBackup: vi.fn(),
  selectVaultBackup: vi.fn(),
  restoreVaultBackup: vi.fn(),
  selectVaultCsv: vi.fn(),
  previewVaultCsv: vi.fn(),
  importVaultCsv: vi.fn(),
  copyBrowserPairingToken: vi.fn(),
  rotateBrowserPairingToken: vi.fn(),
  copyVaultUsername: vi.fn(),
  copyVaultPassword: vi.fn(),
  onVaultLocked: vi.fn(),
  aiPetProviderStatus: vi.fn(),
  setAiPetProvider: vi.fn(),
  testAiPetProvider: vi.fn(),
  clearAiPetApiKey: vi.fn(),
  generateAiPet: vi.fn(),
}));

vi.mock("../bridge/desktopBridge", () => ({ desktopBridge: bridge }));

import { sampleClip, sampleNote } from "../test/data";
import { useShellStore } from "../features/shell/useShellStore";
import { App } from "./App";

beforeEach(() => {
  window.localStorage.clear();
  useShellStore.setState({ mode: "collapsed", section: "recent", query: "" });
  vi.clearAllMocks();
  bridge.expand.mockResolvedValue(undefined);
  bridge.collapse.mockResolvedValue(undefined);
  bridge.quit.mockResolvedValue(undefined);
  bridge.pickWindowProcess.mockResolvedValue(null);
  bridge.terminateWindowProcess.mockResolvedValue(undefined);
  bridge.onModeChanged.mockResolvedValue(vi.fn());
  bridge.onClipsChanged.mockResolvedValue(vi.fn());
  bridge.onCaptureStateChanged.mockResolvedValue(vi.fn());
  bridge.onNotesChanged.mockResolvedValue(vi.fn());
  bridge.listClips.mockResolvedValue([sampleClip]);
  bridge.listNotes.mockResolvedValue([sampleNote]);
  bridge.getCapturePaused.mockResolvedValue(false);
  bridge.setCapturePaused.mockResolvedValue(undefined);
  bridge.getAutostartEnabled.mockResolvedValue(false);
  bridge.setAutostartEnabled.mockResolvedValue(undefined);
  bridge.listPets.mockResolvedValue([
    {
      id: "clipnote",
      name: "纸片夹精灵",
      author: "ClipNote",
      description: "默认桌宠",
      previewDataUrl: "",
      builtIn: true,
    },
  ]);
  bridge.getSelectedPet.mockResolvedValue(null);
  bridge.selectPet.mockResolvedValue(undefined);
  bridge.importPet.mockResolvedValue(null);
  bridge.deletePet.mockResolvedValue(undefined);
  bridge.setVaultContentProtected.mockResolvedValue(undefined);
  bridge.vaultStatus.mockResolvedValue({
    initialized: false,
    unlocked: false,
    autoLockSeconds: 300,
  });
  bridge.listVaultEntries.mockResolvedValue([]);
  bridge.touchVaultActivity.mockResolvedValue(undefined);
  bridge.selectVaultCsv.mockResolvedValue(null);
  bridge.onVaultLocked.mockResolvedValue(vi.fn());
  bridge.aiPetProviderStatus.mockResolvedValue({
    provider: "openai-compatible",
    configured: false,
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-image-1.5",
  });
  bridge.setAiPetProvider.mockResolvedValue(undefined);
  bridge.testAiPetProvider.mockResolvedValue(undefined);
  bridge.openDesktopNote.mockResolvedValue(undefined);
  bridge.retractDesktopNote.mockResolvedValue(undefined);
});

describe("App", () => {
  it("retracts an already pinned desktop note", async () => {
    const pinnedNote = { ...sampleNote, desktopPinned: true };
    bridge.listNotes.mockResolvedValue([pinnedNote]);
    useShellStore.setState({ mode: "expanded", section: "notes" });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "收回桌面便签" }));

    await waitFor(() => expect(bridge.retractDesktopNote).toHaveBeenCalledWith(pinnedNote.id));
    expect(bridge.openDesktopNote).not.toHaveBeenCalled();
  });

  it("keeps the collapsed entry to one icon-sized action", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "打开 ClipNote 工作台" })).toBeVisible();
    expect(screen.queryByText("随手收，随手找。")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "快速新建便签" })).not.toBeInTheDocument();
  });

  it("requires confirmation before exiting the ClipNote process", async () => {
    useShellStore.setState({ mode: "expanded" });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "退出 ClipNote" }));
    expect(screen.getByRole("alertdialog", { name: "退出 ClipNote？" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(bridge.quit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "退出 ClipNote" }));
    await user.click(screen.getByRole("button", { name: "退出并结束进程" }));
    expect(bridge.quit).toHaveBeenCalledOnce();
  });

  it("keeps navigation available after entering notes", async () => {
    useShellStore.setState({ mode: "expanded" });
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(sampleClip.title);
    await user.click(screen.getByRole("button", { name: "便签" }));
    expect(screen.getByRole("heading", { name: sampleNote.title })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "最近" }));
    expect(screen.getByText(sampleClip.title)).toBeVisible();
  });

  it("opens settings and persists clipboard preview preferences", async () => {
    useShellStore.setState({ mode: "expanded" });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("heading", { name: "设置" })).toBeVisible();

    await user.click(screen.getByRole("radio", { name: "4 行" }));
    expect(window.localStorage.getItem("clipnote.preferences.v1")).toContain(
      '"previewLines":4',
    );
  });

  it("toggles native autostart from settings", async () => {
    useShellStore.setState({ mode: "expanded", section: "settings" });
    const user = userEvent.setup();
    render(<App />);

    const toggle = await screen.findByRole("checkbox", { name: /开机时启动 ClipNote/ });
    await user.click(toggle);

    await waitFor(() => expect(bridge.setAutostartEnabled).toHaveBeenCalledWith(true));
  });

  it("shows the pet gallery and keeps the built-in pet selected", async () => {
    useShellStore.setState({ mode: "expanded", section: "settings" });
    render(<App />);

    expect(await screen.findByRole("radiogroup", { name: "桌宠形象" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /纸片夹精灵/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("configures and tests an OpenAI-compatible pet provider through the native bridge", async () => {
    useShellStore.setState({ mode: "expanded", section: "settings" });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "AI 设计" }));
    expect(screen.getByRole("heading", { name: "设计桌宠" })).toBeVisible();
    await user.type(screen.getByLabelText("API Key"), "third-party-token");
    await user.click(screen.getByRole("button", { name: "测试连接" }));

    await waitFor(() => {
      expect(bridge.testAiPetProvider).toHaveBeenCalledWith({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "third-party-token",
        model: "gpt-image-1.5",
        textModel: "gpt-4.1-mini",
      });
    });
    await user.click(screen.getByRole("button", { name: "保存配置" }));

    await waitFor(() => {
      expect(bridge.setAiPetProvider).toHaveBeenCalledWith({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "third-party-token",
        model: "gpt-image-1.5",
        textModel: "gpt-4.1-mini",
      });
    });
    expect(window.localStorage.getItem("clipnote-ai-key")).toBeNull();
  });

  it("updates capture state through the native bridge", async () => {
    useShellStore.setState({ mode: "expanded" });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "暂停剪贴板采集" }));
    await waitFor(() => expect(bridge.setCapturePaused).toHaveBeenCalledWith(true));
  });

  it("creates a local vault without exposing it through browser storage", async () => {
    useShellStore.setState({ mode: "expanded" });
    bridge.createVault.mockResolvedValue(undefined);
    bridge.vaultStatus
      .mockResolvedValueOnce({ initialized: false, unlocked: false, autoLockSeconds: 300 })
      .mockResolvedValueOnce({ initialized: true, unlocked: true, autoLockSeconds: 300 });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "密码本" }));
    expect(await screen.findByRole("heading", { name: "创建密码本" })).toBeVisible();
    const passwordInputs = screen.getAllByLabelText(/主密码|再输一次/);
    await user.type(passwordInputs[0], "a strong master password");
    await user.type(passwordInputs[1], "a strong master password");
    await user.click(screen.getByRole("button", { name: "创建并解锁" }));

    await waitFor(() => expect(bridge.createVault).toHaveBeenCalledWith("a strong master password"));
    expect(window.localStorage.getItem("clipnote-browser-vault")).toBeNull();
    expect(bridge.setVaultContentProtected).toHaveBeenCalledWith(true);
  });

  it("selects another window and requires confirmation before ending its process", async () => {
    useShellStore.setState({ mode: "expanded", section: "settings" });
    const target = {
      pid: 7312,
      processName: "notepad.exe",
      windowTitle: "未响应的白色页面",
      executablePath: "C:\\Windows\\System32\\notepad.exe",
      windowHandle: 7312,
      windowClass: "Notepad",
      closeWindowOnly: false,
    };
    bridge.pickWindowProcess.mockResolvedValue(target);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "选择窗口" }));
    expect(await screen.findByRole("alertdialog", { name: "结束这个进程？" })).toBeVisible();
    expect(screen.getByText("notepad.exe")).toBeVisible();
    expect(screen.getByText("未响应的白色页面")).toBeVisible();
    expect(screen.getByText("7312")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(bridge.terminateWindowProcess).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "选择窗口" }));
    await user.click(await screen.findByRole("button", { name: "结束此进程" }));
    await waitFor(() => expect(bridge.terminateWindowProcess).toHaveBeenCalledWith(target));
  });

  it("closes an Explorer shell frame without terminating Explorer", async () => {
    useShellStore.setState({ mode: "expanded", section: "settings" });
    const target = {
      pid: 9316,
      processName: "explorer.exe",
      windowTitle: "",
      executablePath: "C:\\Windows\\Explorer.EXE",
      windowHandle: 14094670,
      windowClass: "ApplicationFrameWindow",
      closeWindowOnly: true,
    };
    bridge.pickWindowProcess.mockResolvedValue(target);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "选择窗口" }));
    expect(await screen.findByRole("alertdialog", { name: "关闭这个白屏窗口？" })).toBeVisible();
    expect(screen.getByText(/不结束它所属的整个进程/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "关闭此窗口" }));

    await waitFor(() => expect(bridge.terminateWindowProcess).toHaveBeenCalledWith(target));
  });

  it("opens the illustrated vault export tutorial beside the export action", async () => {
    useShellStore.setState({ mode: "expanded", section: "vault" });
    bridge.vaultStatus.mockResolvedValue({ initialized: true, unlocked: true, autoLockSeconds: 300 });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "密码本设置" }));
    await user.click(screen.getByRole("button", { name: "导出教程" }));

    expect(screen.getByRole("dialog", { name: "如何导出加密备份" })).toBeVisible();
    expect(screen.getByText("ClipNote-密码本备份")).toBeVisible();
    expect(screen.getByText("需要时恢复")).toBeVisible();
    expect(bridge.exportVaultBackup).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "知道了" }));
    expect(screen.queryByRole("dialog", { name: "如何导出加密备份" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "导入教程" }));
    expect(screen.getByRole("dialog", { name: "从浏览器导入密码" })).toBeVisible();
    expect(screen.getByText("Google 密码管理器")).toBeVisible();
    expect(screen.getByText("Microsoft Edge")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "知道了" }));

    await user.click(screen.getByRole("button", { name: "导入 CSV" }));
    expect(bridge.selectVaultCsv).toHaveBeenCalledOnce();
  });

  it("keeps note creation available after expanding", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "打开 ClipNote 工作台" }));
    await user.click(screen.getByRole("button", { name: "便签" }));
    await user.click(screen.getByRole("button", { name: "新建便签" }));

    await waitFor(() => expect(bridge.expand).toHaveBeenCalledOnce());
    expect(screen.getByRole("dialog", { name: "新建便签" })).toBeVisible();
    expect(screen.getByRole("button", { name: "最近" })).toBeVisible();
  });

  it("synchronizes a native mode event", async () => {
    let notify: (mode: "collapsed" | "expanded") => void = () => undefined;
    bridge.onModeChanged.mockImplementation(async (handler) => {
      notify = handler;
      return vi.fn();
    });
    render(<App />);

    await waitFor(() => expect(bridge.onModeChanged).toHaveBeenCalledOnce());
    act(() => notify("expanded"));

    expect(screen.getByRole("searchbox", { name: "搜索工作碎片" })).toHaveFocus();
  });
});
