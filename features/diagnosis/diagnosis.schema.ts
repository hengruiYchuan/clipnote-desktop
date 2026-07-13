import { z } from "zod";

export const diagnosisSchema = z.object({
  verdict: z.enum(["ready", "revise"]),
  problemStatement: z.string().min(1),
  audience: z.string().min(1),
  coreScenario: z.string().min(1),
  completionProbability: z.number().int().min(0).max(100),
  coreFlow: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  aiCapability: z.string().min(1),
  exclusions: z.array(z.string().min(1)).min(1).max(4),
  firstReaderPlan: z.string().min(1),
  editorNote: z.string().min(1),
}).strict();

export type Diagnosis = z.infer<typeof diagnosisSchema>;
