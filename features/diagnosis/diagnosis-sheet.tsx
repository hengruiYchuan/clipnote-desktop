import Link from "next/link";

import styles from "@/app/(public)/diagnosis/diagnosis.module.css";

import type { Diagnosis } from "./diagnosis.schema";

export function DiagnosisSheet({
  diagnosis,
  isDemo,
}: {
  diagnosis: Diagnosis;
  isDemo: boolean;
}) {
  return (
    <article className={styles.sheet}>
      <header className={styles.sheetHeader}>
        <div>
          <p>EDITORIAL DIAGNOSIS / 选题诊断单</p>
          <h1>选题诊断单</h1>
        </div>
        <div className={styles.verdict} data-verdict={diagnosis.verdict}>
          <span>{diagnosis.verdict === "ready" ? "可以立题" : "需要收窄"}</span>
          <strong>{diagnosis.completionProbability}%</strong>
          <small>七日完成概率</small>
        </div>
      </header>

      {isDemo && <p className={styles.demoNotice}>DEMO PROVIDER / 当前为可复现演示诊断</p>}

      <section className={styles.statement} aria-labelledby="problem-title">
        <span>01 / PROBLEM</span>
        <div>
          <h2 id="problem-title">问题陈述</h2>
          <p>{diagnosis.problemStatement}</p>
        </div>
      </section>

      <section className={styles.twoColumn}>
        <div>
          <span>02 / READER</span>
          <h2>唯一读者</h2>
          <p>{diagnosis.audience}</p>
        </div>
        <div>
          <span>03 / SCENE</span>
          <h2>核心场景</h2>
          <p>{diagnosis.coreScenario}</p>
        </div>
      </section>

      <section className={styles.flow} aria-labelledby="flow-title">
        <header>
          <span>04 / CORE FLOW</span>
          <h2 id="flow-title">只做三步</h2>
        </header>
        <ol>
          {diagnosis.coreFlow.map((item, index) => (
            <li key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.twoColumn}>
        <div className={styles.aiNote}>
          <span>05 / ONE AI CAPABILITY</span>
          <h2>唯一 AI 能力</h2>
          <p>{diagnosis.aiCapability}</p>
        </div>
        <div className={styles.cutList}>
          <span>06 / CUT</span>
          <h2>本期不做</h2>
          <ul>
            {diagnosis.exclusions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section className={styles.editorNote}>
        <span>EDITOR&apos;S NOTE / 主编便签</span>
        <blockquote>{diagnosis.editorNote}</blockquote>
        <p><strong>第一位试读者：</strong>{diagnosis.firstReaderPlan}</p>
      </section>

      <footer className={styles.sheetFooter}>
        <Link href="/apply">返回修改访谈</Link>
        <Link href="/studio/day-1">进入 Day 1 工作室 →</Link>
      </footer>
    </article>
  );
}
