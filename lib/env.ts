import { z } from "zod";

const envSchema = z.object({
  AI_PROVIDER: z.enum(["demo", "openai"]).default("demo"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_DIAGNOSIS_MODEL: z.string().min(1).default("gpt-5.6-terra"),
});

export const env = envSchema.parse({
  AI_PROVIDER: process.env.AI_PROVIDER,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
  OPENAI_DIAGNOSIS_MODEL: process.env.OPENAI_DIAGNOSIS_MODEL,
});
