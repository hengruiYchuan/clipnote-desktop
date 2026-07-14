import Image from "next/image";

import type { PublishedWork } from "@/features/publication/issue-001";
import styles from "@/styles/publication.module.css";

export function WorkSpread({
  work,
  reverse = false,
}: {
  work: PublishedWork;
  reverse?: boolean;
}) {
  return (
    <article
      id={work.slug}
      className={styles.workSpread}
      data-reverse={reverse || undefined}
    >
      <figure>
        <Image
          src={work.image}
          alt={work.imageAlt}
          width={1280}
          height={900}
          sizes="(max-width: 760px) 100vw, 62vw"
        />
        <figcaption>{work.number} · 可交互校样节选</figcaption>
      </figure>
      <div className={styles.workCopy}>
        <p>{work.number}</p>
        <h2>{work.title}</h2>
        <p className={styles.creator}>创作者 · {work.creator}</p>
        <dl>
          <div>
            <dt>真实问题</dt>
            <dd>{work.problem}</dd>
          </div>
          <div>
            <dt>关键编辑决定</dt>
            <dd>{work.decision}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
