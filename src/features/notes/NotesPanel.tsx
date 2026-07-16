import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Download, Edit3, ImagePlus, Maximize2, PenLine, Pin, Save, Trash2, X } from "lucide-react";
import { motion } from "motion/react";
import { IconButton } from "../../components/IconButton";
import type { Note, NoteImage, NoteInput, NoteTone } from "../../types/content";

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
  onExport: (note: Note) => Promise<void>;
  onExportMany: (notes: Note[]) => Promise<void>;
  onDesktopPin: (note: Note) => Promise<void>;
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
  onExport,
  onExportMany,
  onDesktopPin,
}: NotesPanelProps) {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [previewingImage, setPreviewingImage] = useState<{ note: Note; image: NoteImage } | null>(null);
  const [expandedBodyIds, setExpandedBodyIds] = useState<Set<number>>(() => new Set());
  const [batchExportOpen, setBatchExportOpen] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<number>>(() => new Set());
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
  const closeBatchExport = () => {
    setBatchExportOpen(false);
    setSelectedNoteIds(new Set());
  };
  const toggleSelectedNote = (id: number) => {
    setSelectedNoteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
        <div className="notes__heading-actions">
          {batchExportOpen ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedNoteIds(new Set(visible.map((note) => note.id)))}
                disabled={busy || visible.length === 0}
              >
                <Check aria-hidden="true" />
                全选当前
              </button>
              <button type="button" onClick={closeBatchExport} disabled={busy}>
                <X aria-hidden="true" />
                取消
              </button>
              <button
                type="button"
                disabled={busy || selectedNoteIds.size === 0}
                onClick={() => void onExportMany(
                  notes.filter((note) => selectedNoteIds.has(note.id)),
                ).then(closeBatchExport)}
              >
                <Download aria-hidden="true" />
                合并导出（{selectedNoteIds.size}）
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setBatchExportOpen(true)}
                disabled={busy || notes.length === 0}
              >
                <Download aria-hidden="true" />
                批量导出
              </button>
              <button type="button" onClick={onNew} disabled={busy}>
                <PenLine aria-hidden="true" />
                新建便签
              </button>
            </>
          )}
        </div>
      </header>
      <div className="notes__grid">
        {visible.map((note, index) => (
          <motion.article
            key={note.id}
            className="note-sheet"
            data-tone={note.tone}
            data-selected={selectedNoteIds.has(note.id) || undefined}
            initial={{ rotate: index % 2 ? 1.2 : -1 }}
            animate={{ rotate: index % 2 ? 0.6 : -0.5 }}
          >
            <div className="note-sheet__heading" data-selecting={batchExportOpen || undefined}>
              {batchExportOpen && (
                <label className="note-sheet__selector">
                  <input
                    type="checkbox"
                    aria-label={`选择便签：${note.title}`}
                    checked={selectedNoteIds.has(note.id)}
                    onChange={() => toggleSelectedNote(note.id)}
                  />
                  <span aria-hidden="true">
                    {selectedNoteIds.has(note.id) && <Check />}
                  </span>
                </label>
              )}
              <h3>{note.title}</h3>
              {note.sourceClipIds.length > 0 && (
                <span className="note-sheet__source">来自 {note.sourceClipIds.length} 条剪贴板</span>
              )}
              {!batchExportOpen && <div className="note-sheet__actions">
                <IconButton
                  label={note.desktopPinned ? "收回桌面便签" : "固定到桌面"}
                  onClick={() => void onDesktopPin(note)}
                  disabled={busy}
                  aria-pressed={note.desktopPinned}
                >
                  <Pin aria-hidden="true" fill={note.desktopPinned ? "currentColor" : "none"} />
                </IconButton>
                <IconButton
                  label={`导出 Markdown：${note.title}`}
                  onClick={() => void onExport(note)}
                  disabled={busy}
                >
                  <Download aria-hidden="true" />
                </IconButton>
                <IconButton label={`编辑：${note.title}`} onClick={() => onEdit(note)}>
                  <Edit3 aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={`删除：${note.title}`}
                  onClick={() => setPendingDelete(note.id)}
                >
                  <Trash2 aria-hidden="true" />
                </IconButton>
              </div>}
            </div>
            {(note.body || note.images.length > 0) && (
              <NoteBody
                note={note}
                expanded={expandedBodyIds.has(note.id)}
                onToggle={() => toggleBody(note.id)}
                onViewImage={(image) => setPreviewingImage({ note, image })}
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
      {previewingImage && (
        <div
          className="note-image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={`截图：${previewingImage.note.title}`}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setPreviewingImage(null);
          }}
        >
          <header>
            <span>{previewingImage.note.title}</span>
            <IconButton label="关闭截图预览" onClick={() => setPreviewingImage(null)}>
              <X aria-hidden="true" />
            </IconButton>
          </header>
          <img
            src={previewingImage.image.dataUrl}
            alt={`便签截图：${previewingImage.note.title}`}
          />
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
  onViewImage,
}: {
  note: Note;
  expanded: boolean;
  onToggle: () => void;
  onViewImage: (image: NoteImage) => void;
}) {
  const collapsible = shouldCollapseBody(note.body);
  const bodyId = `note-body-${note.id}`;

  return (
    <div className="note-sheet__body">
      <div id={bodyId} className="note-sheet__content" data-expanded={expanded || undefined}>
        <NoteContent
          body={note.body}
          images={note.images}
          title={note.title}
          onViewImage={onViewImage}
        />
      </div>
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
const MAX_NOTE_IMAGES = 8;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const NOTE_IMAGE_PATTERN = /{{clipnote-image:([A-Za-z0-9_-]+)}}/g;

function noteImageToken(id: string) {
  return `{{clipnote-image:${id}}}`;
}

function createNoteImageIds(images: NoteImage[], count: number) {
  const usedIds = new Set(images.map((image) => image.id));
  let sequence = 1;
  return Array.from({ length: count }, () => {
    while (usedIds.has(`img-${sequence}`)) sequence += 1;
    const id = `img-${sequence}`;
    usedIds.add(id);
    sequence += 1;
    return id;
  });
}

function NoteContent({
  body,
  images,
  title,
  onViewImage,
  onRemoveImage,
}: {
  body: string;
  images: NoteImage[];
  title: string;
  onViewImage?: (image: NoteImage) => void;
  onRemoveImage?: (image: NoteImage) => void;
}) {
  const content: React.ReactNode[] = [];
  const renderedImageIds = new Set<string>();
  let cursor = 0;
  for (const match of body.matchAll(NOTE_IMAGE_PATTERN)) {
    if (match.index > cursor) {
      content.push(<p key={`text-${cursor}`}>{body.slice(cursor, match.index)}</p>);
    }
    const image = images.find((candidate) => candidate.id === match[1]);
    if (image) {
      renderedImageIds.add(image.id);
      content.push(
        <div className="note-content__image" key={image.id}>
          <button
            className="note-sheet__image"
            type="button"
            aria-label={`查看截图：${title}`}
            onClick={() => onViewImage?.(image)}
            disabled={!onViewImage}
          >
            <img src={image.dataUrl} alt={onRemoveImage ? "便签截图预览" : ""} />
            {onViewImage && <Maximize2 aria-hidden="true" />}
          </button>
          {onRemoveImage && (
            <IconButton label="移除这张截图" onClick={() => onRemoveImage(image)}>
              <Trash2 aria-hidden="true" />
            </IconButton>
          )}
        </div>,
      );
    } else {
      content.push(<p key={`missing-${cursor}`}>{match[0]}</p>);
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < body.length) content.push(<p key={`text-${cursor}`}>{body.slice(cursor)}</p>);
  for (const image of images.filter((candidate) => !renderedImageIds.has(candidate.id))) {
    content.push(
      <div className="note-content__image" key={`orphan-${image.id}`}>
        <button
          className="note-sheet__image"
          type="button"
          aria-label={`查看截图：${title}`}
          onClick={() => onViewImage?.(image)}
          disabled={!onViewImage}
        >
          <img src={image.dataUrl} alt={onRemoveImage ? "便签截图预览" : ""} />
          {onViewImage && <Maximize2 aria-hidden="true" />}
        </button>
        {onRemoveImage && (
          <IconButton label="移除这张截图" onClick={() => onRemoveImage(image)}>
            <Trash2 aria-hidden="true" />
          </IconButton>
        )}
      </div>,
    );
  }
  return content;
}

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
  const [images, setImages] = useState<NoteImage[]>(note?.images ?? []);
  const [validation, setValidation] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const attachImages = async (files: File[]) => {
    if (!files.length) return;
    if (images.length + files.length > MAX_NOTE_IMAGES) {
      setValidation(`每张便签最多添加 ${MAX_NOTE_IMAGES} 张图片`);
      return;
    }
    const selectionStart = bodyRef.current?.selectionStart ?? body.length;
    const selectionEnd = bodyRef.current?.selectionEnd ?? selectionStart;
    try {
      const imageIds = createNoteImageIds(images, files.length);
      const additions = await Promise.all(files.map(async (file, index) => ({
        id: imageIds[index],
        dataUrl: await readNoteImage(file),
      })));
      const inserted = additions.map((image) => noteImageToken(image.id)).join("\n\n");
      const before = body.slice(0, selectionStart);
      const after = body.slice(selectionEnd);
      const leading = before && !before.endsWith("\n") ? "\n\n" : "";
      const trailing = after && !after.startsWith("\n") ? "\n\n" : "";
      const nextBody = `${before}${leading}${inserted}${trailing}${after}`;
      const nextCaret = before.length + leading.length + inserted.length + trailing.length;
      setBody(nextBody);
      setImages((current) => [...current, ...additions]);
      setValidation("");
      requestAnimationFrame(() => {
        bodyRef.current?.focus();
        bodyRef.current?.setSelectionRange(nextCaret, nextCaret);
      });
    } catch (error) {
      setValidation(error instanceof Error ? error.message : String(error));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() && !body.trim() && images.length === 0) {
      setValidation("便签内容不能为空");
      return;
    }
    setValidation("");
    await onSave({ title, body, tone, images });
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
          const pastedImages = Array.from(event.clipboardData.items)
            .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
            .map((item) => item.getAsFile())
            .filter((file): file is File => Boolean(file));
          if (!pastedImages.length) return;
          event.preventDefault();
          void attachImages(pastedImages);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const droppedImages = Array.from(event.dataTransfer.files)
            .filter((file) => file.type.startsWith("image/"));
          void attachImages(droppedImages);
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
            ref={bodyRef}
            value={body}
            rows={6}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <section className="note-editor__attachment" aria-labelledby="note-attachment-title">
          <div className="note-editor__attachment-heading">
            <span id="note-attachment-title">截图</span>
            <button type="button" onClick={() => imageInputRef.current?.click()}>
              <ImagePlus aria-hidden="true" />
              插入图片{images.length ? `（${images.length}/${MAX_NOTE_IMAGES}）` : ""}
            </button>
          </div>
          <input
            ref={imageInputRef}
            className="sr-only"
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif"
            aria-label="选择截图文件"
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              void attachImages(files);
            }}
          />
          {images.length ? (
            <div className="note-editor__content-preview" aria-label="便签内容预览">
              <NoteContent
                body={body}
                images={images}
                title={title || "未命名便签"}
                onRemoveImage={(image) => {
                  setImages((current) => current.filter((candidate) => candidate.id !== image.id));
                  setBody((current) => current.split(noteImageToken(image.id)).join(""));
                }}
              />
            </div>
          ) : (
            <button
              className="note-editor__image-add"
              type="button"
              onClick={() => imageInputRef.current?.click()}
            >
              <ImagePlus aria-hidden="true" />
              在光标处插入图片
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
