import { beforeEach, describe, expect, it } from "vitest";

import {
  confirmBoundary,
  createStudioDraft,
  createStudioSession,
  loadStudioSession,
  saveStudioSession,
} from "./studio-session";

describe("day one studio", () => {
  beforeEach(() => sessionStorage.clear());

  it("requires one audience, one outcome and at least one excluded feature", () => {
    expect(confirmBoundary(createStudioDraft()).ok).toBe(false);
  });

  it("confirms and normalizes a focused project boundary", () => {
    const result = confirmBoundary({
      audience: " 产品经理 ",
      outcome: " 从访谈记录得到三条有依据的洞察 ",
      exclusions: [" 登录 ", "登录", "团队协作"],
    });

    expect(result).toEqual({
      ok: true,
      value: {
        audience: "产品经理",
        outcome: "从访谈记录得到三条有依据的洞察",
        exclusions: ["登录", "团队协作"],
      },
    });
  });

  it("restores a signed boundary from the current browser session", () => {
    const session = {
      ...createStudioSession({
        audience: "产品经理",
        outcome: "从访谈记录得到三条有依据的洞察",
        exclusions: ["登录"],
      }),
      confirmed: true,
    };

    saveStudioSession(session);
    expect(loadStudioSession()).toEqual(session);
  });
});
