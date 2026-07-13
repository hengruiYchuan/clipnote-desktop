import { NextResponse } from "next/server";

import { applicationAnswersSchema } from "@/features/application/application.schema";
import { createDiagnosis } from "@/features/diagnosis/create-diagnosis";
import { DemoDiagnosisProvider } from "@/features/diagnosis/demo-diagnosis-provider";
import type { DiagnosisProvider } from "@/features/diagnosis/diagnosis-provider";
import { OpenAIDiagnosisProvider } from "@/features/diagnosis/openai-diagnosis-provider";
import { env } from "@/lib/env";

function getProvider(): DiagnosisProvider | null {
  if (env.AI_PROVIDER === "demo") return new DemoDiagnosisProvider();
  if (!env.OPENAI_API_KEY) return null;
  return new OpenAIDiagnosisProvider({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_DIAGNOSIS_MODEL,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = applicationAnswersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "INVALID_APPLICATION", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const provider = getProvider();
  if (!provider) {
    return NextResponse.json({ code: "AI_NOT_CONFIGURED" }, { status: 503 });
  }

  try {
    return NextResponse.json(await createDiagnosis(parsed.data, provider), {
      headers: { "X-AI-Provider": env.AI_PROVIDER },
    });
  } catch (error) {
    console.error("diagnosis failed", error);
    return NextResponse.json({ code: "DIAGNOSIS_UNAVAILABLE" }, { status: 502 });
  }
}
