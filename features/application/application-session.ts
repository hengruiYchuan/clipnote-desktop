import { applicationDraftSchema } from "./application.schema";
import type { ApplicationDraft } from "./application.types";

const KEY = "wei-ding-gao:application:v1";

export function saveApplicationDraft(draft: ApplicationDraft) {
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function loadApplicationDraft(): ApplicationDraft | null {
  const value = sessionStorage.getItem(KEY);
  if (!value) return null;

  try {
    const parsed = applicationDraftSchema.safeParse(JSON.parse(value));
    if (parsed.success) return parsed.data;
  } catch {
    // Invalid local data is cleared below.
  }

  sessionStorage.removeItem(KEY);
  return null;
}

export function clearApplicationDraft() {
  sessionStorage.removeItem(KEY);
}
