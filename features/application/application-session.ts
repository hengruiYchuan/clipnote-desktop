import type { ApplicationDraft } from "./application.types";

const KEY = "wei-ding-gao:application:v1";

export function saveApplicationDraft(draft: ApplicationDraft) {
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function loadApplicationDraft(): ApplicationDraft | null {
  const value = sessionStorage.getItem(KEY);
  if (!value) return null;

  try {
    return JSON.parse(value) as ApplicationDraft;
  } catch {
    sessionStorage.removeItem(KEY);
    return null;
  }
}

export function clearApplicationDraft() {
  sessionStorage.removeItem(KEY);
}
