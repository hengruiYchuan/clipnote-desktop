import { describe, expect, it } from "vitest";
import { resolveStickyNoteId } from "./stickyWindowRoute";

describe("resolveStickyNoteId", () => {
  it("reads the note id from a production Tauri window label", () => {
    expect(resolveStickyNoteId("", "sticky-42")).toBe(42);
  });

  it("keeps the query route for browser previews", () => {
    expect(resolveStickyNoteId("?stickyNote=77", "main")).toBe(77);
    expect(resolveStickyNoteId("", "main")).toBe(0);
  });
});
