import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Edit3, PenLine, Save, Trash2, X } from "lucide-react";
import { motion } from "motion/react";
import { IconButton } from "../../components/IconButton";
import type { Note, NoteInput, NoteTone } from "../../types/content";

type NotesPanelProps = {
  notes: Note[];
  query: string;
  editorOpen: boolean;
  editingNote: Note | null;
  busy: boolean;
  onNew: () => void;
  onEdit: (note: Note) => void;
  onCloseEditor: () => void;
  onSave: (input: NoteInput) => Promise<void>;
  onDelete: (note: Note) => Promise<void>;
};

export function NotesPanel({
  notes,
  query,
  editorOpen,
  editingNote,
  busy,
  onNew,
  onEdit,
  onCloseEditor,
  onSave,
  onDelete,
}: NotesPanelProps) {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = notes.filter((note) =>
    `${note.title} ${note.body}`.toLocaleLowerCase().includes(normalizedQuery),
  );

  return (
    <section className="notes" aria-label="便签工作桌">
      <header className="notes__heading">
        <div>
          <span>NOTE DESK</span>
          <h2>把临时想法，钉在今天。</h2>
        </div>
        <button type="button" onClick={onNew} disabled={busy}>
          <PenLine aria-hidden="true" />
          新建便签
        </button>
      </header>
      <div className="notes__grid">
        {visible.map((note, index) => (
          <motion.article
            key={note.id}
            className="note-sheet"
            data-tone={note.tone}
            initial={{ rotate: index % 2 ? 1.2 : -1 }}
            animate={{ rotate: index % 2 ? 0.6 : -0.5 }}
          >
            <div className="note-sheet__heading">
              <h3>{note.title}</h3>
              <div className="note-sheet__actions">
                <IconButton label={`编辑：${note.title}`} onClick={() => onEdit(note)}>
                  <Edit3 aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={`删除：${note.title}`}
                  onClick={() => setPendingDelete(note.id)}
                >
                  <Trash2 aria-hidden="true" />
                </IconButton>
              </div>
            </div>
            {note.body && <p>{note.body}</p>}
            {pendingDelete === note.id && (
              <div className="note-sheet__confirm" role="alert">
                <span>删除这张便签？</span>
                <button type="button" onClick={() => setPendingDelete(null)}>
                  取消
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onDelete(note).then(() => setPendingDelete(null))}
                >
                  删除
                </button>
              </div>
            )}
          </motion.article>
        ))}
      </div>
      {visible.length === 0 && <p className="empty-state">还没有便签</p>}
      {editorOpen && (
        <NoteEditor
          note={editingNote}
          busy={busy}
          onClose={onCloseEditor}
          onSave={onSave}
        />
      )}
    </section>
  );
}

function NoteEditor({
  note,
  busy,
  onClose,
  onSave,
}: {
  note: Note | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: NoteInput) => Promise<void>;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [tone, setTone] = useState<NoteTone>(note?.tone ?? "paper");
  const [validation, setValidation] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() && !body.trim()) {
      setValidation("便签内容不能为空");
      return;
    }
    setValidation("");
    await onSave({ title, body, tone });
  };

  return (
    <div className="note-editor-backdrop" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <form
        className="note-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-editor-title"
        onSubmit={(event) => void submit(event)}
      >
        <header>
          <h2 id="note-editor-title">{note ? "编辑便签" : "新建便签"}</h2>
          <IconButton label="关闭便签编辑器" onClick={onClose} disabled={busy}>
            <X aria-hidden="true" />
          </IconButton>
        </header>
        <label>
          <span>标题</span>
          <input
            ref={titleRef}
            value={title}
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          <span>内容</span>
          <textarea
            value={body}
            rows={9}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <fieldset className="note-editor__tones">
          <legend>便签颜色</legend>
          {(["paper", "sun", "mint"] as const).map((value) => (
            <label key={value} data-tone={value}>
              <input
                type="radio"
                name="tone"
                value={value}
                checked={tone === value}
                onChange={() => setTone(value)}
              />
              <span aria-hidden="true">{tone === value && <Check />}</span>
              <span className="sr-only">
                {value === "paper" ? "白色" : value === "sun" ? "黄色" : "绿色"}
              </span>
            </label>
          ))}
        </fieldset>
        {validation && <p className="note-editor__error" role="alert">{validation}</p>}
        <footer>
          <button type="button" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="submit" disabled={busy}>
            <Save aria-hidden="true" />
            {busy ? "保存中" : "保存便签"}
          </button>
        </footer>
      </form>
    </div>
  );
}
