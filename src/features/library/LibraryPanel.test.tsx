import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleClip } from "../../test/data";
import { useShellStore } from "../shell/useShellStore";
import { LibraryPanel } from "./LibraryPanel";

describe("LibraryPanel", () => {
  beforeEach(() => {
    useShellStore.setState({ query: "", section: "recent" });
  });

  it("filters by title, content, and source", () => {
    renderPanel();

    act(() => useShellStore.getState().setQuery("Terminal"));

    expect(screen.queryByText(sampleClip.title)).not.toBeInTheDocument();
    act(() => useShellStore.getState().setQuery("tauri"));
    expect(screen.getByText(sampleClip.title)).toBeVisible();
  });

  it("exposes copy and favorite actions", async () => {
    const onCopy = vi.fn();
    const onFavorite = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onCopy, onFavorite });

    await user.click(screen.getByRole("button", { name: `复制：${sampleClip.title}` }));
    await user.click(screen.getByRole("button", { name: `收藏：${sampleClip.title}` }));

    expect(onCopy).toHaveBeenCalledWith(sampleClip);
    expect(onFavorite).toHaveBeenCalledWith(sampleClip);
  });

  it("folds long clipboard text and can expand it", async () => {
    const user = userEvent.setup();
    const longClip = {
      ...sampleClip,
      id: 2,
      title: "长内容",
      preview: Array.from({ length: 12 }, (_, index) => `第 ${index + 1} 行内容`).join("\n"),
    };

    renderPanel({ items: [longClip] });

    const toggle = screen.getByRole("button", { name: "展开全文" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const preview = screen.getByText(
      (_, element) => element?.tagName === "PRE" && element.textContent === longClip.preview,
    );
    expect(preview).toHaveAttribute("data-collapsed", "true");

    await user.click(toggle);
    expect(screen.getByRole("button", { name: "收起全文" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(preview).not.toHaveAttribute("data-collapsed");
  });

  it("confirms before deleting every unfavorited clip", async () => {
    const onDeleteUnfavorited = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onDeleteUnfavorited });

    await user.click(screen.getByRole("button", { name: "清理未收藏" }));
    expect(onDeleteUnfavorited).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "确认删除 1 条未收藏记录" }));

    expect(onDeleteUnfavorited).toHaveBeenCalledOnce();
  });
});

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof LibraryPanel>> = {},
) {
  return render(
    <LibraryPanel
      items={[sampleClip]}
      onCopy={vi.fn()}
      onFavorite={vi.fn()}
      onDelete={vi.fn()}
      onDeleteUnfavorited={vi.fn()}
      busy={false}
      {...overrides}
    />,
  );
}
