import type { ReactNode } from "react";

import styles from "@/styles/studio.module.css";

type MarginNoteKind = "question" | "cut" | "risk" | "recognition";

const kindLabels: Record<MarginNoteKind, string> = {
  question: "帮助你聚焦",
  cut: "放心删掉",
  risk: "需要留意",
  recognition: "判断是否清楚",
};

export function MarginNote({
  kind,
  anchorLabel,
  children,
}: {
  kind: MarginNoteKind;
  anchorLabel: string;
  children: ReactNode;
}) {
  return (
    <aside
      className={styles.marginNote}
      data-kind={kind}
      aria-label={`填写提示：${kindLabels[kind]}，${anchorLabel}`}
    >
      <header>
        <span>{kindLabels[kind]}</span>
        <small>{anchorLabel}</small>
      </header>
      <p>{children}</p>
    </aside>
  );
}
