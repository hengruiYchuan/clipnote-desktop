import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({
  expand: vi.fn(),
  collapse: vi.fn(),
  onModeChanged: vi.fn(),
  onClipsChanged: vi.fn(),
  onCaptureStateChanged: vi.fn(),
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
  copyVaultUsername: vi.fn(),
  copyVaultPassword: vi.fn(),
  onVaultLocked: vi.fn(),
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
  bridge.onModeChanged.mockResolvedValue(vi.fn());
  bridge.onClipsChanged.mockResolvedValue(vi.fn());
  bridge.onCaptureStateChanged.mockResolvedValue(vi.fn());
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
  bridge.onVaultLocked.mockResolvedValue(vi.fn());
});

describe("App", () => {
  it("keeps the collapsed entry to one icon-sized action", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "打开 ClipNote 工作台" })).toBeVisible();
    expect(screen.queryByText("随手收，随手找。")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "快速新建便签" })).not.toBeInTheDocument();
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
