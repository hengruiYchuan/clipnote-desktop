import { CheckSquare2, PenLine } from "lucide-react";
import { motion } from "motion/react";
import type { NotePreview } from "../../types/content";

export function NotesPanel({ notes }: { notes: NotePreview[] }) {
  return (
    <section className="notes" aria-label="便签工作桌">
      <header className="notes__heading">
        <div>
          <span>NOTE DESK</span>
          <h2>把临时想法，钉在今天。</h2>
        </div>
        <button type="button">
          <PenLine aria-hidden="true" />
          新建便签
        </button>
      </header>
      <div className="notes__grid">
        {notes.map((note, index) => (
          <motion.article
            key={note.id}
            className="note-sheet"
            data-tone={note.tone}
            initial={{ rotate: index % 2 ? 1.2 : -1 }}
            animate={{ rotate: index % 2 ? 0.6 : -0.5 }}
          >
            <h3>{note.title}</h3>
            {note.body && <p>{note.body}</p>}
            {note.checklist && (
              <ul>
                {note.checklist.map((item) => (
                  <li key={item.label}>
                    <label>
                      <input
                        type="checkbox"
                        checked={item.done}
                        readOnly
                        aria-label={`${item.label}：${item.done ? "已完成" : "未完成"}`}
                      />
                      <CheckSquare2 aria-hidden="true" />
                      {item.label}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </motion.article>
        ))}
      </div>
    </section>
  );
}
