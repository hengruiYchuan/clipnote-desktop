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

  it("exports a note from its card action", async () => {
    const onExport = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPanel({ onExport });

    await user.click(
      screen.getByRole("button", { name: `导出 Markdown：${sampleNote.title}` }),
    );

    expect(onExport).toHaveBeenCalledWith(sampleNote);
  });

  it("pins a note into an independent desktop window", async () => {
    const onDesktopPin = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPanel({ onDesktopPin });

    await user.click(screen.getByRole("button", { name: "固定到桌面" }));

    expect(onDesktopPin).toHaveBeenCalledWith(sampleNote);
  });

  it("offers a real retract action for an already pinned note", async () => {
    const onDesktopPin = vi.fn().mockResolvedValue(undefined);
    const pinnedNote = { ...sampleNote, desktopPinned: true };
    const user = userEvent.setup();
    renderPanel({ notes: [pinnedNote], onDesktopPin });

    await user.click(screen.getByRole("button", { name: "收回桌面便签" }));

    expect(onDesktopPin).toHaveBeenCalledWith(pinnedNote);
  });

  it("selects notes and exports them into one document", async () => {
    const onExportMany = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const secondNote = { ...sampleNote, id: 2, title: "发布结论" };
    renderPanel({ notes: [sampleNote, secondNote], onExportMany });

    await user.click(screen.getByRole("button", { name: "批量导出" }));
    await user.click(screen.getByRole("checkbox", { name: `选择便签：${sampleNote.title}` }));
    await user.click(screen.getByRole("button", { name: "合并导出（1）" }));

    expect(onExportMany).toHaveBeenCalledWith([sampleNote]);
    expect(screen.getByRole("button", { name: "批量导出" })).toBeVisible();
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
      images: [],
    });
  });

  it("inserts multiple pasted screenshots into the note body", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPanel({ notes: [], editorOpen: true, onSave });
    const first = new File(["first"], "first.png", { type: "image/png" });
    const second = new File(["second"], "second.png", { type: "image/png" });

    fireEvent.paste(screen.getByLabelText("内容"), {
      clipboardData: {
        items: [
          {
            kind: "file",
            type: "image/png",
            getAsFile: () => first,
          },
          {
            kind: "file",
            type: "image/png",
            getAsFile: () => second,
          },
        ],
      },
    });

    expect(await screen.findAllByRole("img", { name: "便签截图预览" })).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "保存便签" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({
      title: "",
      body: expect.stringMatching(/^{{clipnote-image:[\w-]+}}\n\n{{clipnote-image:[\w-]+}}$/),
      tone: "paper",
      images: [
        expect.objectContaining({ dataUrl: expect.stringMatching(/^data:image\/png;base64,/) }),
        expect.objectContaining({ dataUrl: expect.stringMatching(/^data:image\/png;base64,/) }),
      ],
    });
  });

  it("removes one inline screenshot and its body marker", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const note = {
      ...sampleNote,
      body: "之前\n\n{{clipnote-image:first}}\n\n之后\n\n{{clipnote-image:second}}",
      images: [
        { id: "first", dataUrl: "data:image/png;base64,Zmlyc3Q=" },
        { id: "second", dataUrl: "data:image/png;base64,c2Vjb25k" },
      ],
    };
    renderPanel({ notes: [note], editorOpen: true, editingNote: note, onSave });

    await user.click(screen.getAllByRole("button", { name: "移除这张截图" })[0]);
    await user.click(screen.getByRole("button", { name: "保存便签" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.not.stringContaining("{{clipnote-image:first}}"),
      images: [expect.objectContaining({ id: "second" })],
    }));
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
      onExport={vi.fn().mockResolvedValue(undefined)}
      onExportMany={vi.fn().mockResolvedValue(undefined)}
      onDesktopPin={vi.fn().mockResolvedValue(undefined)}
      {...overrides}
    />,
  );
}
