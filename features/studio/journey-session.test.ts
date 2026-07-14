import { beforeEach, describe, expect, it } from "vitest";

import {
  completeJourneyDay,
  createJourneySession,
  getHighestUnlockedDay,
  isPublicationReady,
  loadJourneySession,
  reviseJourneyDay,
  saveJourneySession,
} from "./journey-session";

describe("seven day journey session", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps later days locked until the previous artifact is complete", () => {
    const session = createJourneySession();

    expect(getHighestUnlockedDay(false, session)).toBe(1);
    expect(getHighestUnlockedDay(true, session)).toBe(2);

    const revised = reviseJourneyDay(session, 2, {
      entry: "打开作品首页",
      mainInput: "粘贴一段访谈记录",
      processing: "找出重复出现的主题，并保留原文依据",
      result: "显示三条主题、对应证据和一条行动建议",
      previewUrl: "https://example.com/preview",
    });
    const completed = completeJourneyDay(
      revised,
      2,
      "2026-07-14T08:00:00.000Z",
    );

    expect(completed.ok).toBe(true);
    if (completed.ok) {
      expect(getHighestUnlockedDay(true, completed.value)).toBe(3);
    }
  });

  it("rejects an incomplete Day 2 artifact", () => {
    const result = completeJourneyDay(createJourneySession(), 2);
    expect(result.ok).toBe(false);
  });

  it("requires every release check and explicit public permission", () => {
    const session = createJourneySession();
    const revised = reviseJourneyDay(session, 7, {
      checks: {
        link: true,
        coreFlow: true,
        errorState: true,
        mobile: true,
        aiBoundary: true,
        realFeedback: true,
      },
      title: "访谈透镜",
      introduction: "帮助产品经理从访谈记录中找到有依据的共性和下一步。",
      aiDataBoundary: "AI 只整理用户主动粘贴的文本，不保存内容，也不替代人的判断。",
      publicListing: false,
    });

    expect(completeJourneyDay(revised, 7).ok).toBe(false);
    expect(isPublicationReady(revised)).toBe(false);
  });

  it("restores valid progress and clears invalid local data", () => {
    const session = createJourneySession();
    saveJourneySession(session);
    expect(loadJourneySession()).toEqual(session);

    sessionStorage.setItem("wei-ding-gao:journey:v1", "{bad json");
    expect(loadJourneySession()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
