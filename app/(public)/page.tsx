import { EditorialLink } from "@/components/brand/editorial-link";
import { IssueStrip } from "@/components/brand/issue-strip";
import { Masthead } from "@/components/brand/masthead";
import { Reveal } from "@/components/motion/reveal";

import styles from "./home.module.css";

const editorialCycle = ["立题", "初稿", "编辑", "校样", "成形", "试读", "发行"];

export default function HomePage() {
  return (
    <main>
      <Masthead issue="DRAFT 001" />
      <section className={styles.hero}>
        <Reveal>
          <p className={styles.kicker}>本期征稿中 · 12 个席位</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1>
            所有好作品，
            <em>都曾经是未定稿。</em>
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className={styles.lede}>
            带着一个真实问题入驻编辑部。七天里，在 AI
            编辑搭档、真人主编与同伴试读中，把它做成可以被使用、被分享、被正式发行的数字作品。
          </p>
        </Reveal>
        <Reveal delay={0.24}>
          <EditorialLink href="/apply">提交你的选题</EditorialLink>
        </Reveal>
        <span className={styles.proofStamp} aria-hidden="true">
          WORK IN
          <br />
          PROGRESS
        </span>
      </section>

      <IssueStrip status="第 001 期 · 开放申请" date="7 DAY RESIDENCY" />

      <section className={styles.facts} aria-label="驻留计划摘要">
        <article>
          <strong>12</strong>
          <span>12 位驻留创作者</span>
        </article>
        <article>
          <strong>07</strong>
          <span>7 天完成一次正式发行</span>
        </article>
        <article>
          <strong>01</strong>
          <span>1 件真实可访问作品</span>
        </article>
      </section>

      <section className={styles.manifesto}>
        <p>不是学完再做。</p>
        <h2>在做一件真实作品的过程中，学会下一次独立完成。</h2>
      </section>

      <section className={styles.selectedWork} aria-labelledby="selected-work-title">
        <header className={styles.workHeader}>
          <span className={styles.sectionNumber}>01 / SELECTED WORK</span>
          <div>
            <h2 id="selected-work-title">本期入选作品</h2>
            <p>从真实问题出发，而不是从模板出发。以下为第 001 期编辑样张。</p>
          </div>
        </header>
        <article className={styles.workSpread} aria-label="作品预览：会议之外">
          <div className={styles.workCover}>
            <div className={styles.coverMeta}>
              <span>DRAFT 001</span>
              <span>01 / 12</span>
            </div>
            <p className={styles.coverTitle}>
              会议
              <br />
              之外
            </p>
            <p className={styles.coverType}>团队决策工具 · 可交互原型</p>
          </div>
          <div className={styles.workNotes}>
            <span className={styles.proofMark} aria-hidden="true">
              ※
            </span>
            <p className={styles.noteLabel}>EDITOR&apos;S NOTE / 编辑批注</p>
            <blockquote>“把散落在会后的犹豫，重新编辑成每个人都能看见的下一步。”</blockquote>
            <dl>
              <div>
                <dt>创作命题</dt>
                <dd>让团队讨论留下可行动的决定</dd>
              </div>
              <div>
                <dt>作品形态</dt>
                <dd>轻量 Web 工具</dd>
              </div>
              <div>
                <dt>当前状态</dt>
                <dd>编辑中 / WIP</dd>
              </div>
            </dl>
          </div>
        </article>
      </section>

      <section className={styles.route} aria-labelledby="route-title">
        <div>
          <span className={styles.sectionNumber}>02 / EDITORIAL CYCLE</span>
          <h2 id="route-title">一份稿件的七日编辑周期</h2>
        </div>
        <ol>
          {editorialCycle.map((item, index) => (
            <li key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.finalCta}>
        <p>你的想法，值得一次正式发行。</p>
        <EditorialLink href="/apply">提交你的选题</EditorialLink>
      </section>
    </main>
  );
}
