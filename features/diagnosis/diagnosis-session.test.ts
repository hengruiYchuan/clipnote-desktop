import { beforeEach, describe, expect, it } from "vitest";

import { loadDiagnosis, saveDiagnosis } from "./diagnosis-session";
import type { Diagnosis } from "./diagnosis.schema";

const diagnosis: Diagnosis = {
  verdict: "ready",
  problemStatement: "帮助产品经理从访谈记录中找到有依据的共性。",
  audience: "需要定期整理用户反馈的产品经理",
  coreScenario: "每周整理访谈记录",
  completionProbability: 82,
  coreFlow: ["上传记录", "核对主题", "导出行动建议"],
  aiCapability: "从原始记录中提取带引用的主题",
  exclusions: ["登录", "团队协作"],
  firstReaderPlan: "邀请同组产品经理完成一次整理任务",
  editorNote: "先证明一次整理过程能节省判断时间。",
};

describe("diagnosis session", () => {
  beforeEach(() => sessionStorage.clear());

  it("restores a valid diagnosis", () => {
    saveDiagnosis(diagnosis);
    expect(loadDiagnosis()).toEqual(diagnosis);
  });

  it("clears malformed local data", () => {
    sessionStorage.setItem(
      "wei-ding-gao:diagnosis:v1",
      JSON.stringify({ verdict: "maybe" }),
    );
    expect(loadDiagnosis()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
