import type { CompleteApplicationAnswers } from "@/features/application/application.schema";

import type { DiagnosisProvider } from "./diagnosis-provider";
import { diagnosisSchema } from "./diagnosis.schema";

export async function createDiagnosis(
  answers: CompleteApplicationAnswers,
  provider: DiagnosisProvider,
) {
  return diagnosisSchema.parse(await provider.diagnose(answers));
}
