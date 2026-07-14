import { z } from "zod";

import { failure, success } from "@/lib/result";

const studioDraftSchema = z
  .object({
    audience: z.string().max(200),
    outcome: z.string().max(400),
    exclusions: z.array(z.string().max(80)).max(6),
  })
  .strict();

const boundarySchema = z
  .object({
    audience: z.string().trim().min(2).max(200),
    outcome: z.string().trim().min(8).max(400),
    exclusions: z.array(z.string().trim().min(2).max(80)).min(1).max(6),
  })
  .strict()
  .transform((draft) => ({
    ...draft,
    exclusions: [...new Set(draft.exclusions)],
  }));

const studioSessionSchema = z
  .object({
    draft: studioDraftSchema,
    confirmed: z.boolean(),
    version: z.literal("V0.0"),
  })
  .strict();

export type StudioDraft = z.infer<typeof studioDraftSchema>;
export type StudioSession = z.infer<typeof studioSessionSchema>;

const KEY = "wei-ding-gao:studio:v1";

export function createStudioDraft(
  seed: Partial<StudioDraft> = {},
): StudioDraft {
  return {
    audience: seed.audience ?? "",
    outcome: seed.outcome ?? "",
    exclusions: seed.exclusions ?? [],
  };
}

export function createStudioSession(
  draft = createStudioDraft(),
): StudioSession {
  return { draft, confirmed: false, version: "V0.0" };
}

export function confirmBoundary(draft: StudioDraft) {
  const result = boundarySchema.safeParse(draft);
  return result.success
    ? success(result.data)
    : failure("请确认一个使用者、一个可观察结果，以及至少一项本期不做内容。");
}

export function saveStudioSession(session: StudioSession) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function loadStudioSession(): StudioSession | null {
  const value = sessionStorage.getItem(KEY);
  if (!value) return null;

  try {
    const parsed = studioSessionSchema.safeParse(JSON.parse(value));
    if (parsed.success) return parsed.data;
  } catch {
    // Invalid local data is cleared below.
  }

  sessionStorage.removeItem(KEY);
  return null;
}
