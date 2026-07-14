import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Edit3, ImagePlus, Maximize2, PenLine, Save, Trash2, X } from "lucide-react";
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
  const [previewingNote, setPreviewingNote] = useState<Note | null>(null);
  const [expandedBodyIds, setExpandedBodyIds] = useState<Set<number>>(() => new Set());
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = notes.filter((note) =>
    `${note.title} ${note.body}`.toLocaleLowerCase().includes(normalizedQuery),
  );
  const toggleBody = (id: number) => {
    setExpandedBodyIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
            {note.imageData && (
              <button
                className="note-sheet__image"
                type="button"
                aria-label={`查看截图：${note.title}`}
                onClick={() => setPreviewingNote(note)}
              >
                <img src={note.imageData} alt="" />
                <Maximize2 aria-hidden="true" />
              </button>
            )}
            {note.body && (
              <NoteBody
                note={note}
                expanded={expandedBodyIds.has(note.id)}
                onToggle={() => toggleBody(note.id)}
              />
            )}
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
      {previewingNote && (
        <div
          className="note-image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={`截图：${previewingNote.title}`}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setPreviewingNote(null);
          }}
        >
          <header>
            <span>{previewingNote.title}</span>
            <IconButton label="关闭截图预览" onClick={() => setPreviewingNote(null)}>
              <X aria-hidden="true" />
            </IconButton>
          </header>
          <img src={previewingNote.imageData} alt={`便签截图：${previewingNote.title}`} />
        </div>
      )}
    </section>
  );
}

const COLLAPSIBLE_BODY_LENGTH = 180;
const COLLAPSIBLE_BODY_LINES = 6;

function shouldCollapseBody(body: string) {
  return (
    body.length > COLLAPSIBLE_BODY_LENGTH ||
    body.split(/\r?\n/).length > COLLAPSIBLE_BODY_LINES
  );
}

function NoteBody({
  note,
  expanded,
  onToggle,
}: {
  note: Note;
  expanded: boolean;
  onToggle: () => void;
}) {
  const collapsible = shouldCollapseBody(note.body);
  const bodyId = `note-body-${note.id}`;

  return (
    <div className="note-sheet__body">
      <p id={bodyId} data-expanded={expanded || undefined}>
        {note.body}
      </p>
      {collapsible && (
        <button
          className="note-sheet__body-toggle"
          type="button"
          aria-controls={bodyId}
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {expanded ? "收起全文" : "展开全文"}
        </button>
      )}
    </div>
  );
}

const MAX_IMAGE_FILE_BYTES = 4 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function readNoteImage(file: File) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return Promise.reject(new Error("仅支持 PNG、JPEG、WebP 或 GIF 图片"));
  }
  if (file.size > MAX_IMAGE_FILE_BYTES) {
    return Promise.reject(new Error("图片不能超过 4 MB"));
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(new Error("图片读取失败")));
    reader.readAsDataURL(file);
  });
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
  const [imageData, setImageData] = useState(note?.imageData ?? "");
  const [validation, setValidation] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const attachImage = async (file: File) => {
    try {
      setImageData(await readNoteImage(file));
      setValidation("");
    } catch (error) {
      setValidation(error instanceof Error ? error.message : String(error));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() && !body.trim() && !imageData) {
      setValidation("便签内容不能为空");
      return;
    }
    setValidation("");
    await onSave({ title, body, tone, imageData });
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
        onPaste={(event) => {
          const image = Array.from(event.clipboardData.items)
            .find((item) => item.kind === "file" && item.type.startsWith("image/"))
            ?.getAsFile();
          if (!image) return;
          event.preventDefault();
          void attachImage(image);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const image = Array.from(event.dataTransfer.files)
            .find((file) => file.type.startsWith("image/"));
          if (image) void attachImage(image);
        }}
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
        <section className="note-editor__attachment" aria-labelledby="note-attachment-title">
          <div className="note-editor__attachment-heading">
            <span id="note-attachment-title">截图</span>
            {imageData && (
              <button type="button" onClick={() => imageInputRef.current?.click()}>
                <ImagePlus aria-hidden="true" />
                更换图片
              </button>
            )}
          </div>
          <input
            ref={imageInputRef}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            aria-label="选择截图文件"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void attachImage(file);
            }}
          />
          {imageData ? (
            <div className="note-editor__image-preview">
              <img src={imageData} alt="便签截图预览" />
              <IconButton label="移除截图" onClick={() => setImageData("")}>
                <Trash2 aria-hidden="true" />
              </IconButton>
            </div>
          ) : (
            <button
              className="note-editor__image-add"
              type="button"
              onClick={() => imageInputRef.current?.click()}
            >
              <ImagePlus aria-hidden="true" />
              添加图片
            </button>
          )}
        </section>
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
