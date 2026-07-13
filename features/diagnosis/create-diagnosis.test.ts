import { describe, expect, it } from "vitest";

import type { CompleteApplicationAnswers } from "@/features/application/application.schema";

import { createDiagnosis } from "./create-diagnosis";
import { DemoDiagnosisProvider } from "./demo-diagnosis-provider";

const answers: CompleteApplicationAnswers = {
  problem: "每周整理访谈记录时，很难快速发现共性。",
  audience: "需要定期处理用户反馈的产品经理。",
  currentMethod: "现在复制到表格，再手工分类和总结。",
  painMoment: "面对几十条记录时，不知道先看哪一条。",
  outcome: "上传记录后得到带依据的主题和下一步建议。",
  materials: "已有匿名化的访谈记录和分类表格。",
  firstReader: "同组的一位产品经理愿意试用。",
};

describe("create diagnosis", () => {
  it("returns a valid provider-neutral diagnosis", async () => {
    const diagnosis = await createDiagnosis(answers, new DemoDiagnosisProvider());

    expect(diagnosis.verdict).toBe("ready");
    expect(diagnosis.coreFlow).toHaveLength(3);
    expect(diagnosis.exclusions.length).toBeGreaterThan(0);
    expect(diagnosis.problemStatement).toBe(answers.problem);
    expect(diagnosis.coreScenario).not.toContain("。时");
  });

  it("rejects an invalid provider response", async () => {
    const provider = {
      diagnose: async () => ({ verdict: "ready" }) as never,
    };

    await expect(createDiagnosis(answers, provider)).rejects.toThrow();
  });
});
