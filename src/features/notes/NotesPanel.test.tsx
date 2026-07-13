import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { noteFixtures } from "../../app/fixtures";
import { NotesPanel } from "./NotesPanel";

describe("NotesPanel", () => {
  it("renders editorial notes and checklist progress", () => {
    render(<NotesPanel notes={noteFixtures} />);

    expect(screen.getByRole("heading", { name: "MVP 边界" })).toBeVisible();
    expect(screen.getByLabelText("Tauri 编译探针：已完成")).toBeChecked();
    expect(screen.getByLabelText("真实桌面截图验收：未完成")).not.toBeChecked();
  });
});
