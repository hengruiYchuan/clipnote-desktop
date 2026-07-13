import { z } from "zod";

const answer = z
  .string()
  .trim()
  .min(8, "请至少写下 8 个字，让编辑搭档理解你的真实场景。")
  .max(800, "单项回答请控制在 800 字以内。");

export const applicationAnswersSchema = z.object({
  problem: answer,
  audience: answer,
  currentMethod: answer,
  painMoment: answer,
  outcome: answer,
  materials: answer,
  firstReader: answer,
});

export type CompleteApplicationAnswers = z.infer<
  typeof applicationAnswersSchema
>;
