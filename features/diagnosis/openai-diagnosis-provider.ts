import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type { CompleteApplicationAnswers } from "@/features/application/application.schema";

import type { DiagnosisProvider } from "./diagnosis-provider";
import { diagnosisSchema, type Diagnosis } from "./diagnosis.schema";

type OpenAIDiagnosisOptions = {
  apiKey: string;
  model: string;
};

export class OpenAIDiagnosisProvider implements DiagnosisProvider {
  private readonly client: OpenAI;

  constructor(private readonly options: OpenAIDiagnosisOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey });
  }

  async diagnose(answers: CompleteApplicationAnswers): Promise<Diagnosis> {
    const response = await this.client.responses.parse({
      model: this.options.model,
      store: false,
      reasoning: { effort: "low" },
      instructions: [
        "你是数字作品驻留计划的主编。",
        "根据申请人的七项真实回答，给出克制、具体、可在七天内执行的选题诊断。",
        "不要添加申请中不存在的事实，不要使用空泛鼓励，不要把作品扩成平台。",
        "核心流程必须正好三步，必须明确至少一项本期不做内容。",
      ].join("\n"),
      input: JSON.stringify(answers),
      text: {
        format: zodTextFormat(diagnosisSchema, "editorial_diagnosis"),
      },
    });

    if (!response.output_parsed) {
      throw new Error("OpenAI did not return a structured diagnosis.");
    }

    return response.output_parsed;
  }
}
