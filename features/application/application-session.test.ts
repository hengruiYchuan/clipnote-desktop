import { beforeEach, describe, expect, it } from "vitest";

import {
  loadApplicationDraft,
  saveApplicationDraft,
} from "./application-session";

describe("application session", () => {
  beforeEach(() => sessionStorage.clear());

  it("loads a valid draft", () => {
    const draft = {
      stepIndex: 1,
      answers: { problem: "每周整理访谈记录时很难发现共性。" },
    };

    saveApplicationDraft(draft);

    expect(loadApplicationDraft()).toEqual(draft);
  });

  it("clears parseable but invalid local data", () => {
    sessionStorage.setItem(
      "wei-ding-gao:application:v1",
      JSON.stringify({ stepIndex: 6, answers: {} }),
    );

    expect(loadApplicationDraft()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("clears malformed JSON", () => {
    sessionStorage.setItem("wei-ding-gao:application:v1", "not-json");

    expect(loadApplicationDraft()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
