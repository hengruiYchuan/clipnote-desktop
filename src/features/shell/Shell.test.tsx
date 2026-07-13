import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { desktopBridge } from "../../bridge/desktopBridge";
import { useShellStore } from "./useShellStore";

vi.mock("../../bridge/desktopBridge", () => ({
  desktopBridge: {
    expand: vi.fn(),
    collapse: vi.fn(),
    toggle: vi.fn(),
    onModeChanged: vi.fn().mockResolvedValue(vi.fn()),
  },
}));

beforeEach(() => {
  useShellStore.setState({ mode: "collapsed", section: "recent", query: "" });
  vi.mocked(desktopBridge.expand).mockResolvedValue();
  vi.mocked(desktopBridge.collapse).mockResolvedValue();
});

describe("desktop shell", () => {
  it("expands from the bookmark and focuses search", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole("button", { name: "打开 ClipNote 工作台" }),
    );

    expect(desktopBridge.expand).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("searchbox", { name: "搜索工作碎片" }),
    ).toHaveFocus();
  });

  it("collapses on Escape", async () => {
    useShellStore.setState({ mode: "expanded" });
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard("{Escape}");

    expect(desktopBridge.collapse).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "打开 ClipNote 工作台" }),
    ).toBeVisible();
  });
});
