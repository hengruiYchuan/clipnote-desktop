import { useCallback, useEffect, useRef, useState } from "react";
import { GripHorizontal, Pin, Save, Undo2 } from "lucide-react";
import { desktopBridge } from "../../bridge/desktopBridge";
import type { Note, NoteTone } from "../../types/content";

export function StickyNoteWindow({ id }: { id: number }) {
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<NoteTone>("paper");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("正在读取便签");
  const saving = useRef(false);

  useEffect(() => {
    void desktopBridge.getNote(id).then((next) => {
      setNote(next);
      setTitle(next.title);
      setBody(next.body);
      setTone(next.tone);
      setMessage("");
    }).catch((error) => setMessage(String(error)));
  }, [id]);

  const save = useCallback(async () => {
    if (!note || saving.current || !dirty) return;
    saving.current = true;
    try {
      const next = await desktopBridge.updateNote(note.id, {
        title,
        body,
        tone,
        images: note.images,
      });
      setNote(next);
      setDirty(false);
      setMessage("已保存");
      window.setTimeout(() => setMessage(""), 1200);
    } catch (error) {
      setMessage(String(error));
    } finally {
      saving.current = false;
    }
  }, [body, dirty, note, title, tone]);

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => void save(), 700);
    return () => window.clearTimeout(timer);
  }, [dirty, save]);

  useEffect(() => {
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void desktopBridge.saveDesktopNoteGeometry(id), 500);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, [id]);

  if (!note) return <main className="sticky-note sticky-note--loading">{message}</main>;

  const change = (callback: () => void) => {
    callback();
    setDirty(true);
  };

  return (
    <main className="sticky-note" data-tone={tone}>
      <header className="sticky-note__toolbar">
        <button
          type="button"
          title="拖动便签"
          aria-label="拖动便签"
          onMouseDown={() => void desktopBridge.startDragDesktopNote(id)}
          onMouseUp={() => window.setTimeout(() => void desktopBridge.saveDesktopNoteGeometry(id), 120)}
        >
          <GripHorizontal aria-hidden="true" />
        </button>
        <span>{message || (dirty ? "正在保存" : "桌面便签")}</span>
        <button type="button" title="保存" aria-label="保存桌面便签" onClick={() => void save()}>
          <Save aria-hidden="true" />
        </button>
        <button
          type="button"
          title={note.alwaysOnTop ? "取消置顶" : "置顶"}
          aria-label={note.alwaysOnTop ? "取消桌面便签置顶" : "置顶桌面便签"}
          aria-pressed={note.alwaysOnTop}
          onClick={() => {
            const alwaysOnTop = !note.alwaysOnTop;
            setNote({ ...note, alwaysOnTop });
            void desktopBridge.setDesktopNoteAlwaysOnTop(id, alwaysOnTop);
          }}
        >
          <Pin aria-hidden="true" fill={note.alwaysOnTop ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          title="收回到 ClipNote"
          aria-label="收回桌面便签"
          onClick={() => void save().then(() => desktopBridge.retractDesktopNote(id))}
        >
          <Undo2 aria-hidden="true" />
        </button>
      </header>
      <input
        className="sticky-note__title"
        value={title}
        maxLength={80}
        aria-label="便签标题"
        onChange={(event) => change(() => setTitle(event.target.value))}
      />
      <textarea
        className="sticky-note__body"
        value={body}
        aria-label="便签内容"
        onChange={(event) => change(() => setBody(event.target.value))}
      />
      {note.images.length > 0 && (
        <div className="sticky-note__images">
          {note.images.map((image) => <img key={image.id} src={image.dataUrl} alt="便签截图" />)}
        </div>
      )}
      <div className="sticky-note__tones" aria-label="便签颜色">
        {(["paper", "sun", "mint"] as const).map((value) => (
          <button
            key={value}
            type="button"
            data-tone={value}
            aria-label={value === "paper" ? "白色" : value === "sun" ? "黄色" : "绿色"}
            aria-pressed={tone === value}
            onClick={() => change(() => setTone(value))}
          />
        ))}
      </div>
    </main>
  );
}
