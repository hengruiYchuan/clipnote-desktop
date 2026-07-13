import styles from "@/app/(public)/apply/apply.module.css";

import { applicationSteps } from "./application.types";

export function ProgressFolio({ current }: { current: number }) {
  return (
    <nav className={styles.progress} aria-label="选题访谈进度">
      <p>APPLICATION / 申请页</p>
      <ol>
        {applicationSteps.map((step, index) => (
          <li
            key={step.id}
            data-complete={index < current}
            aria-current={index === current ? "step" : undefined}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step.eyebrow.split(" / ")[1]}</strong>
          </li>
        ))}
      </ol>
      <small>{Math.min(current + 1, applicationSteps.length)} / {applicationSteps.length}</small>
    </nav>
  );
}
