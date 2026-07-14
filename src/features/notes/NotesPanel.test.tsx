import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { sampleNote } from "../../test/data";
import { NotesPanel } from "./NotesPanel";

describe("NotesPanel", () => {
  it("renders persisted notes and confirms deletion", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPanel({ onDelete });

    expect(screen.getByRole("heading", { name: sampleNote.title })).toBeVisible();
    await user.click(screen.getByRole("button", { name: `删除：${sampleNote.title}` }));
    expect(screen.getByText("删除这张便签？")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "删除" }));
    expect(onDelete).toHaveBeenCalledWith(sampleNote);
  });

  it("submits a new note from the editor", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPanel({ notes: [], editorOpen: true, onSave });

    await user.type(screen.getByLabelText("标题"), "发布检查");
    await user.type(screen.getByLabelText("内容"), "确认本地数据闭环");
    await user.click(screen.getByRole("radio", { name: "绿色" }));
    await user.click(screen.getByRole("button", { name: "保存便签" }));

    expect(onSave).toHaveBeenCalledWith({
      title: "发布检查",
      body: "确认本地数据闭环",
      tone: "mint",
      imageData: "",
    });
  });

  it("attaches a pasted screenshot to an image-only note", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPanel({ notes: [], editorOpen: true, onSave });
    const screenshot = new File(["screenshot"], "shot.png", { type: "image/png" });

    fireEvent.paste(screen.getByLabelText("内容"), {
      clipboardData: {
        items: [
          {
            kind: "file",
            type: "image/png",
            getAsFile: () => screenshot,
          },
        ],
      },
    });

    expect(await screen.findByRole("img", { name: "便签截图预览" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "保存便签" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({
      title: "",
      body: "",
      tone: "paper",
      imageData: expect.stringMatching(/^data:image\/png;base64,/),
    });
  });

  it("folds long note text and can expand it", async () => {
    const user = userEvent.setup();
    const longNote = {
      ...sampleNote,
      body: Array.from({ length: 9 }, (_, index) => `第 ${index + 1} 行便签内容`).join("\n"),
    };
    renderPanel({ notes: [longNote] });

    const toggle = screen.getByRole("button", { name: "展开全文" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(screen.getByRole("button", { name: "收起全文" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof NotesPanel>> = {},
) {
  return render(
    <NotesPanel
      notes={[sampleNote]}
      query=""
      editorOpen={false}
      editingNote={null}
      busy={false}
      onNew={vi.fn()}
      onEdit={vi.fn()}
      onCloseEditor={vi.fn()}
      onSave={vi.fn().mockResolvedValue(undefined)}
      onDelete={vi.fn().mockResolvedValue(undefined)}
      {...overrides}
    />,
  );
}
