import { failure, success, type Result } from "@/lib/result";

import {
  applicationSteps,
  type ApplicationDraft,
} from "./application.types";

export function createApplicationDraft(): ApplicationDraft {
  return { stepIndex: 0, answers: {} };
}

export function advanceApplication(
  draft: ApplicationDraft,
  rawAnswer: string,
): Result<ApplicationDraft, string> {
  const answer = rawAnswer.trim();
  if (!answer) return failure("请先写下一个具体回答。");

  const step = applicationSteps[draft.stepIndex];
  if (!step) return failure("这份选题访谈已经完成。");

  return success({
    stepIndex: draft.stepIndex + 1,
    answers: { ...draft.answers, [step.id]: answer },
  });
}
