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
      busy={false}
      {...overrides}
    />,
  );
}
