"use client";

import { useEffect, useState } from "react";

import { WorkSpread } from "@/components/publication/work-spread";
import { loadJourneySession, isPublicationReady } from "@/features/studio/journey-session";
import { loadStudioSession } from "@/features/studio/studio-session";
import styles from "@/styles/publication.module.css";

import { issue001 } from "./issue-001";

type AuthorizedWork = {
  title: string;
  audience: string;
  outcome: string;
  introduction: string;
  boundary: string;
  decision: string;
  learning: string;
};

function loadAuthorizedWork(): AuthorizedWork | null {
  const journey = loadJourneySession();
  const studio = loadStudioSession();
  if (!journey || !studio?.confirmed || !isPublicationReady(journey)) return null;

  return {
    title: journey.days[7].draft.title,
    audience: studio.draft.audience,
    outcome: studio.draft.outcome,
    introduction: journey.days[7].draft.introduction,
    boundary: journey.days[7].draft.aiDataBoundary,
    decision: journey.days[3].draft.changeSummary,
    learning: journey.days[4].draft.reflection,
  };
}

export function PublicationIssue() {
  const [authorizedWork, setAuthorizedWork] = useState<AuthorizedWork | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setAuthorizedWork(loadAuthorizedWork()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <nav className={styles.contents} aria-label="本期目录">
        <span>本期目录</span>
        <ol>
          {issue001.works.map((work) => (
            <li key={work.slug}>
              <a href={`#${work.slug}`}>
                <span>{work.number.replace("WORK ", "")}</span>
                {work.title}
              </a>
            </li>
          ))}
          {authorizedWork && (
            <li>
              <a href="#resident-release">
                <span>03</span>
                {authorizedWork.title}
              </a>
            </li>
          )}
        </ol>
      </nav>

      <section className={styles.works} aria-label="本期作品">
        {issue001.works.map((work, index) => (
          <WorkSpread key={work.slug} work={work} reverse={index % 2 === 1} />
        ))}

        {authorizedWork && (
          <article id="resident-release" className={styles.residentWork}>
            <div className={styles.residentProof} aria-hidden="true">
              <span>AUTHORIZED COPY</span>
              <strong>{authorizedWork.title}</strong>
              <small>ISSUE 001 · WORK 03</small>
            </div>
            <div className={styles.residentCopy}>
              <p>WORK 03 · 本地授权作品</p>
              <h2>{authorizedWork.title}</h2>
              <p className={styles.residentIntroduction}>{authorizedWork.introduction}</p>
              <dl>
                <div>
                  <dt>为谁而做</dt>
                  <dd>{authorizedWork.audience}</dd>
                </div>
                <div>
                  <dt>交付结果</dt>
                  <dd>{authorizedWork.outcome}</dd>
                </div>
                <div>
                  <dt>关键编辑决定</dt>
                  <dd>{authorizedWork.decision}</dd>
                </div>
                <div>
                  <dt>一次校样所得</dt>
                  <dd>{authorizedWork.learning}</dd>
                </div>
                <div>
                  <dt>AI 与数据边界</dt>
                  <dd>{authorizedWork.boundary}</dd>
                </div>
              </dl>
              <p className={styles.permissionNote}>
                此作品说明来自当前浏览器中完成并授权公开的七日稿件；反馈者姓名与过程原文未公开。
              </p>
            </div>
          </article>
        )}
      </section>
    </>
  );
}
