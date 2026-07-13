"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import styles from "@/app/(public)/apply/apply.module.css";

import { advanceApplication, createApplicationDraft } from "./application-flow";
import {
  clearApplicationDraft,
  loadApplicationDraft,
  saveApplicationDraft,
} from "./application-session";
import { applicationSteps, type ApplicationDraft } from "./application.types";
import { InterviewStep } from "./interview-step";
import { ProgressFolio } from "./progress-folio";

export function ApplicationInterview() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!hydrated) {
    return <p className={styles.loading} aria-live="polite">正在展开上次保存的稿纸...</p>;
  }

  return <HydratedApplicationInterview />;
}

function HydratedApplicationInterview() {
  const router = useRouter();
  const [draft, setDraft] = useState<ApplicationDraft>(
    () => loadApplicationDraft() ?? createApplicationDraft(),
  );
  const [error, setError] = useState<string>();

  function commit(next: ApplicationDraft) {
    setDraft(next);
    saveApplicationDraft(next);
  }

  function changeAnswer(value: string) {
    const step = applicationSteps[draft.stepIndex];
    if (!step) return;

    commit({
      ...draft,
      answers: { ...draft.answers, [step.id]: value },
    });
    setError(undefined);
  }

  function submit() {
    const step = applicationSteps[draft.stepIndex];
    if (!step) return;

    const result = advanceApplication(draft, draft.answers[step.id] ?? "");
    if (!result.ok) {
      setError(result.error);
      return;
    }

    commit(result.value);
    setError(undefined);
    if (result.value.stepIndex === applicationSteps.length) {
      router.push("/diagnosis");
    }
  }

  function goBack() {
    if (draft.stepIndex === 0) return;
    commit({ ...draft, stepIndex: draft.stepIndex - 1 });
    setError(undefined);
  }

  function restart() {
    if (!window.confirm("重新开始会清除当前七页访谈，确定继续吗？")) return;
    clearApplicationDraft();
    setDraft(createApplicationDraft());
    setError(undefined);
  }

  const step = applicationSteps[draft.stepIndex];
  if (!step) {
    return (
      <section className={styles.complete} aria-labelledby="application-complete-title">
        <p>APPLICATION COMPLETE / 已保存</p>
        <h2 id="application-complete-title">七页访谈已经装订。</h2>
        <p>你的回答仍保存在这个浏览器会话中，可以继续查看诊断，或退回最后一页修改。</p>
        <div className={styles.completeActions}>
          <Link href="/diagnosis">查看选题诊断</Link>
          <button type="button" onClick={goBack}>返回最后一题</button>
          <button type="button" onClick={restart}>重新开始</button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.interview} aria-labelledby="application-question">
      <ProgressFolio current={draft.stepIndex} />
      <div className={styles.writingDesk}>
        <InterviewStep
          eyebrow={step.eyebrow}
          prompt={step.prompt}
          help={step.help}
          value={draft.answers[step.id] ?? ""}
          error={error}
          onChange={changeAnswer}
        />
        <div className={styles.controls}>
          <button type="button" disabled={draft.stepIndex === 0} onClick={goBack}>
            ← 上一题
          </button>
          <button className={styles.primaryAction} type="button" onClick={submit}>
            {draft.stepIndex === applicationSteps.length - 1 ? "完成访谈 →" : "继续编辑 →"}
          </button>
        </div>
      </div>
    </section>
  );
}
