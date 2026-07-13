import type { CompleteApplicationAnswers } from "@/features/application/application.schema";

import type { Diagnosis } from "./diagnosis.schema";

export interface DiagnosisProvider {
  diagnose(answers: CompleteApplicationAnswers): Promise<Diagnosis>;
}
