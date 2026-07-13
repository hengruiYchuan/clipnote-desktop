import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clipFixtures } from "../../app/fixtures";
import { useShellStore } from "../shell/useShellStore";
import { LibraryPanel } from "./LibraryPanel";

describe("LibraryPanel", () => {
  beforeEach(() => {
    useShellStore.setState({ query: "", section: "recent" });
  });

  it("filters by title, content, and source", () => {
    render(<LibraryPanel items={clipFixtures} onCopy={vi.fn()} />);

    act(() => useShellStore.getState().setQuery("Terminal"));

    expect(screen.getByText("启动 Tauri 开发环境")).toBeVisible();
    expect(screen.queryByText("MVP 产品决策")).not.toBeInTheDocument();
  });

  it("copies a selected fragment from its explicit action", async () => {
    const onCopy = vi.fn();
    const user = userEvent.setup();
    render(<LibraryPanel items={clipFixtures} onCopy={onCopy} />);

    await user.click(
      screen.getByRole("button", { name: "复制：启动 Tauri 开发环境" }),
    );

    expect(onCopy).toHaveBeenCalledWith(clipFixtures[0]);
  });
});
