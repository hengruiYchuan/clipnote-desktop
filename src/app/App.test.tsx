import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({ onModeChanged: vi.fn() }));

vi.mock("../bridge/desktopBridge", () => ({ desktopBridge: bridge }));

import { App } from "./App";
import { useShellStore } from "../features/shell/useShellStore";

beforeEach(() => {
  useShellStore.setState({ mode: "collapsed", section: "recent", query: "" });
  bridge.onModeChanged.mockReset();
  bridge.onModeChanged.mockResolvedValue(vi.fn());
});

describe("App", () => {
  it("introduces the editorial workspace accessibly", () => {
    render(<App />);

    expect(
      screen.getByRole("button", { name: "打开 ClipNote 工作台" }),
    ).toBeVisible();
    expect(screen.getByText("你的工作碎片，随手归档。")).toBeVisible();
  });

  it("updates the shell for a native mode event", async () => {
    let notify: (mode: "collapsed" | "expanded") => void = () => undefined;
    bridge.onModeChanged.mockImplementation(async (handler) => {
      notify = handler;
      return vi.fn();
    });
    render(<App />);

    await waitFor(() => expect(bridge.onModeChanged).toHaveBeenCalledOnce());
    act(() => notify("expanded"));

    expect(useShellStore.getState().mode).toBe("expanded");
    expect(screen.getByRole("searchbox", { name: "搜索工作碎片" })).toHaveFocus();
  });

  it("disposes a late native listener after unmount", async () => {
    let resolveListener: (dispose: () => void) => void = () => undefined;
    const dispose = vi.fn();
    bridge.onModeChanged.mockReturnValue(
      new Promise((resolve) => {
        resolveListener = resolve;
      }),
    );
    const { unmount } = render(<App />);

    unmount();
    await act(async () => resolveListener(dispose));

    expect(dispose).toHaveBeenCalledOnce();
  });

  it("handles a rejected native listener registration", async () => {
    bridge.onModeChanged.mockRejectedValue(new Error("IPC unavailable"));

    render(<App />);

    await waitFor(() => expect(bridge.onModeChanged).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("button", { name: "打开 ClipNote 工作台" }),
    ).toBeVisible();
  });
});
