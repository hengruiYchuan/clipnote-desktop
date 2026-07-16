import { useState } from "react";
import { Copy, FileJson2, Languages, NotebookPen, Sparkles, WandSparkles, X } from "lucide-react";
import { desktopBridge } from "../../bridge/desktopBridge";
import type { ClipItem } from "../../types/content";

const actions = [
  ["clean-whitespace", "清理空白"],
  ["format-json", "美化 JSON"],
  ["extract-urls", "提取网址"],
  ["base64-encode", "Base64 编码"],
  ["base64-decode", "Base64 解码"],
  ["summarize", "AI 摘要"],
  ["translate-zh", "翻译中文"],
  ["polish", "AI 润色"],
  ["custom", "自定义 AI"],
] as const;

export function SmartClipDialog({
  clip,
  onClose,
  onCreateNote,
  onMessage,
}: {
  clip: ClipItem;
  onClose: () => void;
  onCreateNote: (result: string) => Promise<void>;
  onMessage: (message: string, error?: boolean) => void;
}) {
  const [action, setAction] = useState<(typeof actions)[number][0]>("clean-whitespace");
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      setResult(await desktopBridge.smartTextAction({ action, content: clip.preview, instruction }));
    } catch (error) {
      onMessage(String(error), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="smart-clip-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className="smart-clip-dialog" role="dialog" aria-modal="true" aria-labelledby="smart-clip-title">
        <header>
          <div><Sparkles aria-hidden="true" /><span><small>智能操作</small><h2 id="smart-clip-title">{clip.title}</h2></span></div>
          <button type="button" aria-label="关闭智能操作" onClick={onClose}><X aria-hidden="true" /></button>
        </header>
        <div className="smart-clip-dialog__actions" role="tablist" aria-label="处理方式">
          {actions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={action === value}
              onClick={() => { setAction(value); setResult(""); }}
            >
              {value === "format-json" ? <FileJson2 aria-hidden="true" /> : value === "translate-zh" ? <Languages aria-hidden="true" /> : <WandSparkles aria-hidden="true" />}
              {label}
            </button>
          ))}
        </div>
        {action === "custom" && (
          <label className="smart-clip-dialog__instruction">
            处理要求
            <input value={instruction} maxLength={500} onChange={(event) => setInstruction(event.target.value)} />
          </label>
        )}
        <pre className="smart-clip-dialog__source">{clip.preview}</pre>
        {result && <textarea className="smart-clip-dialog__result" aria-label="智能处理结果" value={result} onChange={(event) => setResult(event.target.value)} />}
        <footer>
          {result && <>
            <button type="button" onClick={() => void navigator.clipboard.writeText(result).then(() => onMessage("结果已复制"))}>
              <Copy aria-hidden="true" />复制结果
            </button>
            <button type="button" onClick={() => void onCreateNote(result)}>
              <NotebookPen aria-hidden="true" />保存为便签
            </button>
          </>}
          <button className="smart-clip-dialog__run" type="button" disabled={busy || (action === "custom" && !instruction.trim())} onClick={() => void run()}>
            <Sparkles aria-hidden="true" />{busy ? "处理中" : "开始处理"}
          </button>
        </footer>
      </section>
    </div>
  );
}
