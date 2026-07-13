import { failure, success, type Result } from "@/lib/result";

import { applicationAnswerSchema } from "./application.schema";
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
  const step = applicationSteps[draft.stepIndex];
  if (!step) return failure("这份选题访谈已经完成。");

  const parsed = applicationAnswerSchema.safeParse(rawAnswer);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "请检查这项回答。");
  }

  return success({
    stepIndex: draft.stepIndex + 1,
    answers: { ...draft.answers, [step.id]: parsed.data },
  });
}
