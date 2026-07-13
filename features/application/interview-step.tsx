import styles from "@/app/(public)/apply/apply.module.css";

type InterviewStepProps = {
  eyebrow: string;
  prompt: string;
  help: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

export function InterviewStep({
  eyebrow,
  prompt,
  help,
  value,
  error,
  onChange,
}: InterviewStepProps) {
  return (
    <fieldset className={styles.question}>
      <legend id="application-question">
        <span>{eyebrow}</span>
        {prompt}
      </legend>
      <p className={styles.help}>{help}</p>
      <label htmlFor="application-answer">你的回答</label>
      <textarea
        id="application-answer"
        autoFocus
        maxLength={800}
        rows={8}
        value={value}
        aria-describedby={error ? "answer-error answer-count" : "answer-count"}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className={styles.answerMeta}>
        <p id="answer-error" className={styles.error} role={error ? "alert" : undefined}>
          {error ?? "\u00a0"}
        </p>
        <span id="answer-count">{value.length} / 800 字</span>
      </div>
    </fieldset>
  );
}
