import { describe, expect, it } from "vitest";

import { advanceApplication, createApplicationDraft } from "./application-flow";

describe("application flow", () => {
  it("does not advance when the current answer is empty", () => {
    const draft = createApplicationDraft();
    const result = advanceApplication(draft, "   ");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("请先写下一个具体回答。");
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
});
