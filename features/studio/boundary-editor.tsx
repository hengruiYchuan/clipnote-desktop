"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { loadApplicationDraft } from "@/features/application/application-session";
import { applicationSteps } from "@/features/application/application.types";
import { loadDiagnosis } from "@/features/diagnosis/diagnosis-session";
import styles from "@/styles/studio.module.css";

import { dayOneBrief } from "./day-one-brief";
import { MarginNote } from "./margin-note";
import {
  confirmBoundary,
  createStudioDraft,
  createStudioSession,
  loadStudioSession,
  saveStudioSession,
  type StudioDraft,
  type StudioSession,
} from "./studio-session";

export function BoundaryEditor() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!hydrated) {
    return <p className={styles.loading} aria-live="polite">正在打开今天的计划...</p>;
  }

  return <HydratedBoundaryEditor />;
}

function getCurrentDiagnosis() {
  const application = loadApplicationDraft();
  return application?.stepIndex === applicationSteps.length
    ? loadDiagnosis()
    : null;
}

function createInitialSession(): StudioSession {
  const stored = loadStudioSession();
  if (stored) return stored;

  const application = loadApplicationDraft();
  const diagnosis = getCurrentDiagnosis();

  return createStudioSession(createStudioDraft({
    audience: diagnosis?.audience ?? application?.answers.audience,
    outcome: application?.answers.outcome ?? diagnosis?.problemStatement,
    exclusions: diagnosis?.exclusions,
  }));
}

function HydratedBoundaryEditor() {
  const [session, setSession] = useState<StudioSession>(createInitialSession);
  const [diagnosis] = useState(getCurrentDiagnosis);
  const [pendingExclusion, setPendingExclusion] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => saveStudioSession(session), [session]);

  function reviseDraft(draft: StudioDraft) {
    setSession({ draft, confirmed: false, version: "V0.0" });
    setError(undefined);
  }

  function updateField(field: "audience" | "outcome", value: string) {
    reviseDraft({ ...session.draft, [field]: value });
  }

  function addExclusion() {
    const value = pendingExclusion.trim();
    if (value.length < 2) {
      setError("暂时不做的内容至少需要 2 个字。");
      return;
    }
    if (session.draft.exclusions.includes(value)) {
      setError("这项内容已经在清单里。");
      return;
    }
    if (session.draft.exclusions.length >= 6) {
      setError("清单最多保留 6 项，请先合并或删除一项。");
      return;
    }

    reviseDraft({
      ...session.draft,
      exclusions: [...session.draft.exclusions, value],
    });
    setPendingExclusion("");
  }

  function removeExclusion(index: number) {
    reviseDraft({
      ...session.draft,
      exclusions: session.draft.exclusions.filter((_, itemIndex) => itemIndex !== index),
    });
  }

  function submitBoundary(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = confirmBoundary(session.draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSession({ draft: result.value, confirmed: true, version: "V0.0" });
    setError(undefined);
  }

  return (
    <>
      <section className={styles.orientation} aria-labelledby="day-one-title">
        <div className={styles.dayMeta}>
          <span>第 1 天 / 共 7 天</span>
          <span>{dayOneBrief.duration}</span>
        </div>
        <div className={styles.orientationCopy}>
          <p>今天只做一件事</p>
          <h1 id="day-one-title">今天先把作品说清楚</h1>
          <p>
            完成下面三步，你会得到一张清晰的 7 天计划。后面的制作、测试和发布，都从这里开始。
          </p>
        </div>
        <ol className={styles.roadmap} aria-label="今天的三个步骤">
          {dayOneBrief.steps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
      </section>

      {diagnosis && (
        <section className={styles.projectContext} aria-labelledby="project-context-title">
          <p>从你的选题诊断中带过来的方向</p>
          <div>
            <h2 id="project-context-title">{diagnosis.problemStatement}</h2>
            <dl>
              <div>
                <dt>主要服务</dt>
                <dd>{diagnosis.audience}</dd>
              </div>
              <div>
                <dt>真实场景</dt>
                <dd>{diagnosis.coreScenario}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {session.confirmed ? (
        <section className={styles.confirmation} aria-labelledby="confirmation-title">
          <header>
            <p>7 天计划已确认</p>
            <h2 id="confirmation-title">方向已经清楚了。</h2>
            <p>接下来，你只需要围绕这三件事开始制作。</p>
          </header>
          <dl className={styles.boundarySummary}>
            <div>
              <dt>先帮助谁</dt>
              <dd>{session.draft.audience}</dd>
            </div>
            <div>
              <dt>交付什么结果</dt>
              <dd>{session.draft.outcome}</dd>
            </div>
            <div>
              <dt>这次先不做</dt>
              <dd>{session.draft.exclusions.join("、")}</dd>
            </div>
          </dl>
          <footer>
            <span>第一版已保存</span>
            <div className={styles.confirmationLinks}>
              <button
                type="button"
                onClick={() => setSession({ ...session, confirmed: false })}
              >
                返回修改
              </button>
              <Link href="/studio/day-2">开始第 2 天：做出第一版 →</Link>
            </div>
          </footer>
        </section>
      ) : (
        <form className={styles.editor} onSubmit={submitBoundary}>
          <header className={styles.editorHeader}>
            <div>
              <p>{dayOneBrief.title}</p>
              <h2>把范围定下来</h2>
            </div>
            <p>{dayOneBrief.outcome}</p>
          </header>

          <section className={styles.step} aria-labelledby="audience-title">
            <div className={styles.stepHeading}>
              <span>1</span>
              <div>
                <h3 id="audience-title">这个作品先为谁服务？</h3>
                <p>先只写一种最需要它的人。</p>
              </div>
            </div>
            <label className={styles.field} htmlFor="studio-audience">
              <span>这个人是</span>
              <textarea
                id="studio-audience"
                value={session.draft.audience}
                maxLength={200}
                onChange={(event) => updateField("audience", event.target.value)}
              />
            </label>
            <MarginNote kind="question" anchorLabel="先选一个人">
              想象下周谁会真的打开它。写职位不够时，再加上他正在处理的事情。
            </MarginNote>
          </section>

          <section className={styles.step} aria-labelledby="outcome-title">
            <div className={styles.stepHeading}>
              <span>2</span>
              <div>
                <h3 id="outcome-title">七天后，他能看到什么结果？</h3>
                <p>写一个别人可以看见或实际用一次的结果。</p>
              </div>
            </div>
            <label className={styles.field} htmlFor="studio-outcome">
              <span>七天后可以</span>
              <textarea
                id="studio-outcome"
                value={session.draft.outcome}
                maxLength={400}
                onChange={(event) => updateField("outcome", event.target.value)}
              />
            </label>
            <MarginNote kind="recognition" anchorLabel="再写一个结果">
              “做出一个平台”很难判断；“上传记录后得到三条有依据的主题”就很清楚。
            </MarginNote>
          </section>

          <section className={styles.step} aria-labelledby="exclusion-title">
            <div className={styles.stepHeading}>
              <span>3</span>
              <div>
                <h3 id="exclusion-title">哪些内容这次先不做？</h3>
                <p>主动删掉非核心内容，七天才更有机会完成。</p>
              </div>
            </div>
            <div className={styles.exclusionEditor}>
              <label htmlFor="studio-exclusion">暂时不做</label>
              <div className={styles.exclusionInput}>
                <input
                  id="studio-exclusion"
                  value={pendingExclusion}
                  maxLength={80}
                  onChange={(event) => setPendingExclusion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addExclusion();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addExclusion}
                  aria-label="加入暂时不做清单"
                  title="添加"
                >
                  +
                </button>
              </div>
              <ul aria-label="暂时不做清单">
                {session.draft.exclusions.map((item, index) => (
                  <li key={`${item}-${index}`}>
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => removeExclusion(index)}
                      aria-label={`移除 ${item}`}
                      title="移除"
                    >
                      x
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <MarginNote kind="cut" anchorLabel="最后缩小范围">
              登录、团队协作、复杂设置通常都可以以后再做。现在先保住最核心的一次使用。
            </MarginNote>
          </section>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <footer className={styles.confirmationAction}>
            <div>
              <strong>完成后你会得到</strong>
              <span>{dayOneBrief.outcome}</span>
            </div>
            <button type="submit">确认这份 7 天计划 →</button>
          </footer>
        </form>
      )}

      <footer className={styles.sessionBar}>
        <span>已自动保存到当前浏览器</span>
        <strong>{session.confirmed ? "计划已确认" : "正在整理"}</strong>
      </footer>
    </>
  );
}
