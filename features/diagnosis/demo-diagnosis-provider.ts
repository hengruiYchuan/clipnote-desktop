import type { CompleteApplicationAnswers } from "@/features/application/application.schema";

import type { DiagnosisProvider } from "./diagnosis-provider";
import type { Diagnosis } from "./diagnosis.schema";

function stripTerminalPunctuation(value: string) {
  return value.replace(/[。！？；，,.!?;]+$/u, "");
}

export class DemoDiagnosisProvider implements DiagnosisProvider {
  async diagnose(answers: CompleteApplicationAnswers): Promise<Diagnosis> {
    const audience = stripTerminalPunctuation(answers.audience);
    const painMoment = stripTerminalPunctuation(answers.painMoment);
    const outcome = stripTerminalPunctuation(answers.outcome);
    const materials = stripTerminalPunctuation(answers.materials);
    const firstReader = stripTerminalPunctuation(answers.firstReader);

    return {
      verdict: "ready",
      problemStatement: answers.problem,
      audience: answers.audience,
      coreScenario: `${audience}在“${painMoment}”时，需要更清楚的下一步。`,
      completionProbability: 78,
      coreFlow: [
        `收集：${materials}`,
        `整理：围绕“${outcome}”提炼证据`,
        `试读：交给${firstReader}`,
      ],
      aiCapability: "从真实素材中提炼有依据的模式，并指出仍需人工判断的缺口。",
      exclusions: ["账户与权限", "多人实时协作", "自动替用户做最终决定"],
      firstReaderPlan: `${firstReader}将用一份真实素材完成首次试读，并反馈最难理解的一步。`,
      editorNote: "这个选题已经有真实问题、明确读者和可获得素材。第一版只证明一条核心路径，不要扩成平台。",
    };
  }
}
