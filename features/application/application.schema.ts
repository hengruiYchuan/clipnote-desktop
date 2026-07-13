import { z } from "zod";

import { applicationSteps } from "./application.types";

export const applicationAnswerSchema = z
  .string()
  .trim()
  .min(8, "请至少写下 8 个字，让编辑搭档理解你的真实场景。")
  .max(800, "单项回答请控制在 800 字以内。");

export const applicationAnswersSchema = z.object({
  problem: applicationAnswerSchema,
  audience: applicationAnswerSchema,
  currentMethod: applicationAnswerSchema,
  painMoment: applicationAnswerSchema,
  outcome: applicationAnswerSchema,
  materials: applicationAnswerSchema,
  firstReader: applicationAnswerSchema,
}).strict();

const draftAnswerSchema = z.string().max(800);

export const applicationDraftSchema = z
  .object({
    stepIndex: z.number().int().min(0).max(applicationSteps.length),
    answers: z
      .object({
        problem: draftAnswerSchema.optional(),
        audience: draftAnswerSchema.optional(),
        currentMethod: draftAnswerSchema.optional(),
        painMoment: draftAnswerSchema.optional(),
        outcome: draftAnswerSchema.optional(),
        materials: draftAnswerSchema.optional(),
        firstReader: draftAnswerSchema.optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((draft, context) => {
    for (let index = 0; index < draft.stepIndex; index += 1) {
      const step = applicationSteps[index];
      const parsed = applicationAnswerSchema.safeParse(draft.answers[step.id]);
      if (!parsed.success) {
        context.addIssue({
          code: "custom",
          message: "已完成的访谈回答无效。",
          path: ["answers", step.id],
        });
      }
    }
  });

export type CompleteApplicationAnswers = z.infer<
  typeof applicationAnswersSchema
>;
