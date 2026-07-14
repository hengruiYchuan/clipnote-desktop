"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "@/styles/studio.module.css";

import { journeyDayMeta } from "./journey-content";
import { JourneyDayForm } from "./journey-day-form";
import {
  completeJourneyDay,
  createJourneySession,
  dayVersions,
  getHighestUnlockedDay,
  getStudioDayRoute,
  isJourneyDayComplete,
  loadJourneySession,
  reviseJourneyDay,
  saveJourneySession,
  type JourneyDay,
  type JourneyDayDraft,
  type JourneySession,
} from "./journey-session";
import { loadStudioSession } from "./studio-session";

const progressLabels = ["立题", "初稿", "编辑", "校样", "成形", "试读", "发行"];

function getCompletionSummary(session: JourneySession, day: JourneyDay) {
  switch (day) {
    case 2:
      return [
        ["一次输入", session.days[2].draft.mainInput],
        ["一个结果", session.days[2].draft.result],
      ];
    case 3:
      return [
        ["真实反馈者", session.days[3].draft.reviewer],
        ["你的编辑决定", session.days[3].draft.changeSummary],
      ];
    case 4:
      return [
        ["暴露的问题", session.days[4].draft.incident],
        ["留下的方法", session.days[4].draft.reflection],
      ];
    case 5:
      return [
        ["首要感受", session.days[5].draft.emotion],
        ["视觉重点", session.days[5].draft.keyInformation],
      ];
    case 6:
      return [
        ["真实试读者", session.days[6].draft.reader],
        ["最终结论", session.days[6].draft.finalChange],
      ];
    case 7:
      return [
        ["公开作品", session.days[7].draft.title],
        ["作品说明", session.days[7].draft.introduction],
      ];
  }
}

export function JourneyStudio({ day }: { day: JourneyDay }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!hydrated) {
    return (
      <p className={styles.loading} aria-live="polite">
        正在打开今天的编辑桌...
      </p>
    );
  }

  return <HydratedJourneyStudio day={day} />;
}

function HydratedJourneyStudio({ day }: { day: JourneyDay }) {
  const [dayOneConfirmed] = useState(
    () => loadStudioSession()?.confirmed ?? false,
  );
  const [session, setSession] = useState(
    () => loadJourneySession() ?? createJourneySession(),
  );
  const [error, setError] = useState<string>();
  const meta = journeyDayMeta[day];
  const highestUnlocked = getHighestUnlockedDay(dayOneConfirmed, session);
  const locked = day > highestUnlocked;
  const completed = isJourneyDayComplete(session, day);

  useEffect(() => saveJourneySession(session), [session]);

  function updateDay<D extends JourneyDay>(
    targetDay: D,
    draft: JourneyDayDraft<D>,
  ) {
    setSession((current) => reviseJourneyDay(current, targetDay, draft));
    setError(undefined);
  }

  function submitDay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = completeJourneyDay(session, day);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSession(result.value);
    setError(undefined);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reopenDay() {
    setSession((current) =>
      reviseJourneyDay(current, day, current.days[day].draft),
    );
  }

  return (
    <>
      <section className={styles.journeyHero} aria-labelledby="journey-title">
        <div className={styles.dayMeta}>
          <span>第 {day} 天 / 共 7 天</span>
          <span>{meta.duration}</span>
        </div>
        <div className={styles.journeyHeroCopy}>
          <p>{meta.eyebrow}</p>
          <h1 id="journey-title">{meta.title}</h1>
          <p>{meta.introduction}</p>
        </div>
        <div className={styles.outcomeStamp}>
          <span>今天完成后</span>
          <strong>{meta.outcome}</strong>
        </div>
      </section>

      <nav className={styles.journeyProgress} aria-label="七日创作进度">
        <ol>
          {progressLabels.map((label, index) => {
            const progressDay = index + 1;
            const progressComplete =
              progressDay === 1
                ? dayOneConfirmed
                : isJourneyDayComplete(session, progressDay as JourneyDay);
            const accessible = progressDay <= highestUnlocked;
            const status = progressComplete
              ? "complete"
              : progressDay === day
                ? "current"
                : accessible
                  ? "open"
                  : "locked";
            const content = (
              <>
                <span>{String(progressDay).padStart(2, "0")}</span>
                <strong>{label}</strong>
              </>
            );

            return (
              <li key={label} data-status={status}>
                {accessible ? (
                  <Link
                    href={getStudioDayRoute(progressDay as 1 | JourneyDay)}
                    aria-current={progressDay === day ? "step" : undefined}
                  >
                    {content}
                  </Link>
                ) : (
                  <span aria-disabled="true">{content}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {locked ? (
        <section className={styles.lockedDay} aria-labelledby="locked-title">
          <p>前一份稿件还没有完成</p>
          <h2 id="locked-title">先完成第 {highestUnlocked} 天。</h2>
          <p>七天按顺序推进，前一天的决定会成为今天的输入。</p>
          <Link href={getStudioDayRoute(highestUnlocked)}>
            回到第 {highestUnlocked} 天 →
          </Link>
        </section>
      ) : completed ? (
        <section className={styles.dayComplete} aria-labelledby="complete-title">
          <header>
            <p>{dayVersions[day]} 已保存</p>
            <h2 id="complete-title">{meta.completionTitle}</h2>
            <p>这份产物已经成为下一天的起点，你随时可以回来修订。</p>
          </header>
          <dl>
            {getCompletionSummary(session, day).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <footer>
            <button type="button" onClick={reopenDay}>
              返回修改
            </button>
            {day < 7 ? (
              <Link className={styles.primaryJourneyLink} href={getStudioDayRoute((day + 1) as JourneyDay)}>
                继续第 {day + 1} 天 →
              </Link>
            ) : (
              <Link className={styles.primaryJourneyLink} href="/publication/001">
                查看第 001 期特刊 →
              </Link>
            )}
          </footer>
        </section>
      ) : (
        <form className={styles.journeyEditor} onSubmit={submitDay}>
          <header className={styles.journeyEditorHeader}>
            <div>
              <p>DAY {day} · {meta.label}</p>
              <h2>按顺序完成今天的稿件</h2>
            </div>
            <p>草稿会自动保存在当前浏览器中。</p>
          </header>

          <JourneyDayForm day={day} session={session} onChange={updateDay} />

          {error && (
            <p className={styles.journeyError} role="alert">
              {error}
            </p>
          )}

          <footer className={styles.journeyAction}>
            <Link href={getStudioDayRoute((day - 1) as 1 | JourneyDay)}>
              ← 回看第 {day - 1} 天
            </Link>
            <div>
              <span>完成产物</span>
              <strong>{meta.outcome}</strong>
            </div>
            <button type="submit">完成今天 →</button>
          </footer>
        </form>
      )}

      <footer className={styles.sessionBar}>
        <span>已自动保存到当前浏览器</span>
        <strong>{completed ? `${dayVersions[day]} 已完成` : "草稿保存中"}</strong>
      </footer>
    </>
  );
}
