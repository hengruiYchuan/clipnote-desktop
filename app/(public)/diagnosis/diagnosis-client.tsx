"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  applicationAnswersSchema,
  type CompleteApplicationAnswers,
} from "@/features/application/application.schema";
import { loadApplicationDraft } from "@/features/application/application-session";
import { applicationSteps } from "@/features/application/application.types";
import { saveDiagnosis } from "@/features/diagnosis/diagnosis-session";
import { DiagnosisSheet } from "@/features/diagnosis/diagnosis-sheet";
import { diagnosisSchema, type Diagnosis } from "@/features/diagnosis/diagnosis.schema";

import styles from "./diagnosis.module.css";

type DiagnosisState =
  | { status: "loading"; slow: boolean }
  | { status: "error"; message: string }
  | { status: "ready"; diagnosis: Diagnosis; isDemo: boolean };

export function DiagnosisClient() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!hydrated) return <DiagnosisLoading slow={false} />;
  return <HydratedDiagnosis />;
}

function HydratedDiagnosis() {
  const [answers] = useState<CompleteApplicationAnswers | null>(() => {
    const draft = loadApplicationDraft();
    const parsed = applicationAnswersSchema.safeParse(draft?.answers);
    return draft?.stepIndex === applicationSteps.length && parsed.success ? parsed.data : null;
  });

  if (!answers) {
    return (
      <section className={styles.statusPanel}>
        <p>APPLICATION MISSING / 未找到申请</p>
        <h1>先完成七页访谈。</h1>
        <Link href="/apply">返回提交选题 →</Link>
      </section>
    );
  }

  return <DiagnosisRequest answers={answers} />;
}

function DiagnosisRequest({ answers }: { answers: CompleteApplicationAnswers }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DiagnosisState>({ status: "loading", slow: false });

  useEffect(() => {
    const controller = new AbortController();
    const slowTimer = window.setTimeout(() => {
      setState((current) => current.status === "loading" ? { ...current, slow: true } : current);
    }, 20_000);

    async function requestDiagnosis() {
      try {
        const response = await fetch("/api/diagnosis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(answers),
          signal: controller.signal,
        });

        const payload: unknown = await response.json();
        if (!response.ok) {
          const code = typeof payload === "object" && payload && "code" in payload
            ? String(payload.code)
            : "DIAGNOSIS_UNAVAILABLE";
          const message = code === "AI_NOT_CONFIGURED"
            ? "OpenAI 尚未配置。请设置 OPENAI_API_KEY，或将 AI_PROVIDER 改为 demo。"
            : "这次校读没有完成。你的访谈仍然安全保存在当前会话中。";
          setState({ status: "error", message });
          return;
        }

        const diagnosis = diagnosisSchema.safeParse(payload);
        if (!diagnosis.success) {
          setState({ status: "error", message: "诊断格式不完整，请重新校读。" });
          return;
        }

        saveDiagnosis(diagnosis.data);
        setState({
          status: "ready",
          diagnosis: diagnosis.data,
          isDemo: response.headers.get("X-AI-Provider") !== "openai",
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "诊断请求失败。",
        });
      } finally {
        window.clearTimeout(slowTimer);
      }
    }

    void requestDiagnosis();
    return () => {
      controller.abort();
      window.clearTimeout(slowTimer);
    };
  }, [answers, attempt]);

  if (state.status === "ready") {
    return <DiagnosisSheet diagnosis={state.diagnosis} isDemo={state.isDemo} />;
  }

  if (state.status === "error") {
    return (
      <section className={styles.statusPanel}>
        <p>PROOFING PAUSED / 校读暂停</p>
        <h1>诊断暂时没有完成。</h1>
        <p>{state.message}</p>
        <button
          type="button"
          onClick={() => {
            setState({ status: "loading", slow: false });
            setAttempt((value) => value + 1);
          }}
        >
          重新校读 →
        </button>
      </section>
    );
  }

  return <DiagnosisLoading slow={state.slow} />;
}

function DiagnosisLoading({ slow }: { slow: boolean }) {
  return (
    <section className={styles.statusPanel} aria-live="polite">
      <p>PROOFING / 正在校读</p>
      <h1>{slow ? "校读比预期更久。" : "正在把七页回答整理成一张边界图。"}</h1>
      <p>{slow ? "稿件已经保存，可以继续等待。" : "正在核对读者、场景、素材与七日结果。"}</p>
    </section>
  );
}
