import Link from "next/link";

import styles from "@/styles/editorial.module.css";

export function Masthead({ issue }: { issue: string }) {
  return (
    <header className={styles.masthead}>
      <Link className={styles.brand} href="/" aria-label="未定稿，返回首页">
        未定稿
      </Link>
      <span className={styles.issue}>{issue}</span>
      <span className={styles.descriptor}>AI 产品驻留计划</span>
    </header>
  );
}
