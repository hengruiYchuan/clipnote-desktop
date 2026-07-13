import { describe, expect, it } from "vitest";

import { advanceApplication, createApplicationDraft } from "./application-flow";

describe("application flow", () => {
  it("does not advance when the current answer is too short", () => {
    const draft = createApplicationDraft();
    const result = advanceApplication(draft, "太模糊");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("至少写下 8 个字");
  });

  it("does not advance when the current answer is too long", () => {
    const result = advanceApplication(createApplicationDraft(), "答".repeat(801));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("800 字以内");
  });

  it("records an answer and advances one step", () => {
    const draft = createApplicationDraft();
    const result = advanceApplication(
      draft,
      "每周整理访谈记录时，我很难快速发现共性。",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stepIndex).toBe(1);
      expect(result.value.answers.problem).toContain("访谈记录");
    }
  });

  it("replaces a saved answer when a previous step is edited", () => {
    const draft = {
      stepIndex: 0,
      answers: { problem: "原来的问题描述已经超过八个字。" },
    };
    const result = advanceApplication(draft, "修改后的问题描述同样足够具体。 ");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.answers.problem).toBe("修改后的问题描述同样足够具体。");
    }
  });
});
