import { beforeEach, describe, expect, it } from "vitest";
import { useShellStore } from "./useShellStore";

beforeEach(() => {
  useShellStore.setState({ mode: "collapsed", section: "recent", query: "" });
});

describe("shell store", () => {
  it("opens into recent items and can return to the edge tab", () => {
    useShellStore.getState().expand();
    expect(useShellStore.getState().mode).toBe("expanded");

    useShellStore.getState().collapse();
    expect(useShellStore.getState().mode).toBe("collapsed");
  });

  it("switches to notes without losing the shell mode", () => {
    useShellStore.getState().expand();
    useShellStore.getState().setSection("notes");

    expect(useShellStore.getState()).toMatchObject({
      mode: "expanded",
      section: "notes",
    });
  });
});
