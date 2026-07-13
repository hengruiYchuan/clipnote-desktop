import styles from "@/styles/editorial.module.css";

export function IssueStrip({ status, date }: { status: string; date: string }) {
  return (
    <div className={styles.issueStrip}>
      <span>{status}</span>
      <time>{date}</time>
    </div>
  );
}
