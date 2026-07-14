import { diagnosisSchema, type Diagnosis } from "./diagnosis.schema";

const KEY = "wei-ding-gao:diagnosis:v1";

export function saveDiagnosis(diagnosis: Diagnosis) {
  sessionStorage.setItem(KEY, JSON.stringify(diagnosis));
}

export function loadDiagnosis(): Diagnosis | null {
  const value = sessionStorage.getItem(KEY);
  if (!value) return null;

  try {
    const parsed = diagnosisSchema.safeParse(JSON.parse(value));
    if (parsed.success) return parsed.data;
  } catch {
    // Invalid local data is cleared below.
  }

  sessionStorage.removeItem(KEY);
  return null;
}
