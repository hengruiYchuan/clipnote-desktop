import type { Metadata } from "next";

import { EditorialLink } from "@/components/brand/editorial-link";
import { IssueStrip } from "@/components/brand/issue-strip";
import { Masthead } from "@/components/brand/masthead";
import { issue001 } from "@/features/publication/issue-001";
import { PublicationIssue } from "@/features/publication/publication-issue";
import styles from "@/styles/publication.module.css";

export const metadata: Metadata = {
  title: "第 001 期",
  description: issue001.dek,
};

export default function Issue001Page() {
  return (
    <main className={styles.page}>
      <Masthead issue="ISSUE 001" />
      <section className={styles.cover} aria-labelledby="issue-title">
        <div className={styles.coverMeta}>
          <span>未定稿 · 数字特刊</span>
          <span>JUL 2026</span>
        </div>
        <div className={styles.coverCopy}>
          <p>第 001 期</p>
          <h1 id="issue-title">{issue001.title}</h1>
          <p>{issue001.dek}</p>
        </div>
        <p className={styles.coverIndex}>001</p>
      </section>
      <IssueStrip status="第 001 期 · 正式发行" date="7 DAY RESIDENCY" />

      <PublicationIssue />

      <section className={styles.editorNote} aria-labelledby="editor-note-title">
        <p>编者按</p>
        <div>
          <h2 id="editor-note-title">作品不是答案，是一种更清楚的提问。</h2>
          <p>
            本期先展示两件策展样例。完成七日流程并确认公开授权后，你的作品说明会在当前浏览器中进入本期，成为第三种回答。
          </p>
        </div>
      </section>

      <section className={styles.nextIssue} aria-labelledby="next-issue-title">
        <p>ISSUE 002 · OPEN CALL</p>
        <h2 id="next-issue-title">下一种回答，也许来自你。</h2>
        <EditorialLink href="/apply">申请下一期驻留</EditorialLink>
      </section>
    </main>
  );
}
