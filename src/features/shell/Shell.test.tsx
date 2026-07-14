import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleClip } from "../../test/data";
import { App } from "../../app/App";
import { desktopBridge } from "../../bridge/desktopBridge";
import { useShellStore } from "./useShellStore";

vi.mock("../../bridge/desktopBridge", () => ({
  desktopBridge: {
    expand: vi.fn(),
    collapse: vi.fn(),
    startDragging: vi.fn(),
    hide: vi.fn(),
    onModeChanged: vi.fn(),
    onClipsChanged: vi.fn(),
    onCaptureStateChanged: vi.fn(),
    listClips: vi.fn(),
    listNotes: vi.fn(),
    getCapturePaused: vi.fn(),
    setCapturePaused: vi.fn(),
  },
}));

beforeEach(() => {
  useShellStore.setState({ mode: "collapsed", section: "recent", query: "" });
  vi.mocked(desktopBridge.expand).mockResolvedValue();
  vi.mocked(desktopBridge.collapse).mockResolvedValue();
  vi.mocked(desktopBridge.startDragging).mockResolvedValue();
  vi.mocked(desktopBridge.hide).mockResolvedValue();
  vi.mocked(desktopBridge.onModeChanged).mockResolvedValue(vi.fn());
  vi.mocked(desktopBridge.onClipsChanged).mockResolvedValue(vi.fn());
  vi.mocked(desktopBridge.onCaptureStateChanged).mockResolvedValue(vi.fn());
  vi.mocked(desktopBridge.listClips).mockResolvedValue([sampleClip]);
  vi.mocked(desktopBridge.listNotes).mockResolvedValue([]);
  vi.mocked(desktopBridge.getCapturePaused).mockResolvedValue(false);
});

describe("desktop shell", () => {
  it("expands from the edge tab and focuses search", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "打开 ClipNote 工作台" }));

    expect(desktopBridge.expand).toHaveBeenCalledOnce();
    expect(screen.getByRole("searchbox", { name: "搜索工作碎片" })).toHaveFocus();
  });

  it("collapses on Escape", async () => {
    useShellStore.setState({ mode: "expanded" });
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard("{Escape}");

    expect(desktopBridge.collapse).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "打开 ClipNote 工作台" })).toBeVisible();
  });

  it("opens, drags, and hides from the single compact control", async () => {
    const user = userEvent.setup();
    vi.mocked(desktopBridge.expand).mockClear();
    render(<App />);
    const entry = screen.getByRole("button", { name: "打开 ClipNote 工作台" });

    fireEvent.pointerDown(entry, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(entry, { clientX: 20, clientY: 10 });
    fireEvent.pointerUp(entry, { button: 0, clientX: 20, clientY: 10 });
    fireEvent.contextMenu(entry);

    expect(desktopBridge.startDragging).toHaveBeenCalledOnce();
    expect(desktopBridge.hide).toHaveBeenCalledOnce();
    expect(desktopBridge.expand).not.toHaveBeenCalled();

    await user.click(entry);
    expect(desktopBridge.expand).toHaveBeenCalledOnce();
  });
});
