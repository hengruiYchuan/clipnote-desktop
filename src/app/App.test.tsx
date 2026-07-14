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
  setClipFavorite: vi.fn(),
  copyClip: vi.fn(),
  deleteClip: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

vi.mock("../bridge/desktopBridge", () => ({ desktopBridge: bridge }));

import { sampleClip, sampleNote } from "../test/data";
import { useShellStore } from "../features/shell/useShellStore";
import { App } from "./App";

beforeEach(() => {
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

  it("updates capture state through the native bridge", async () => {
    useShellStore.setState({ mode: "expanded" });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "暂停剪贴板采集" }));
    await waitFor(() => expect(bridge.setCapturePaused).toHaveBeenCalledWith(true));
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
