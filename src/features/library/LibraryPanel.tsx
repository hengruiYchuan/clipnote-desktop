import type { ClipItem } from "../../types/content";
import { useShellStore } from "../shell/useShellStore";
import { ClipCard } from "./ClipCard";
import { SmartClipDialog } from "./SmartClipDialog";

export function LibraryPanel({
  items,
  onCopy,
  onFavorite,
  onDelete,
  onDeleteUnfavorited,
  onCreateNote,
  onCreateSmartNote,
  onMessage,
  busy,
  collapseLongClips = true,
  previewLines = 6,
}: {
  items: ClipItem[];
  onCopy: (item: ClipItem) => void;
  onFavorite: (item: ClipItem) => void;
  onDelete: (item: ClipItem) => void;
  onDeleteUnfavorited: () => void;
  onCreateNote: (items: ClipItem[]) => void;
  onCreateSmartNote: (item: ClipItem, result: string) => Promise<void>;
  onMessage: (message: string, error?: boolean) => void;
  busy: boolean;
  collapseLongClips?: boolean;
  previewLines?: 4 | 6 | 8;
}) {
  const [confirmingCleanup, setConfirmingCleanup] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [smartClip, setSmartClip] = useState<ClipItem | null>(null);
  const query = useShellStore((state) => state.query.trim().toLocaleLowerCase());
  const section = useShellStore((state) => state.section);
  const visible = items.filter((item) => {
    if (section === "favorites" && !item.favorite) return false;
    const haystack = `${item.title} ${item.preview} ${item.source}`.toLocaleLowerCase();
    return haystack.includes(query);
  });
  const unfavoritedCount = items.filter((item) => !item.favorite).length;

  return (
    <section className="library" aria-label="剪贴板资料库">
      <div className="library__toolbar">
        <p className="library__count">共 {visible.length} 条工作碎片</p>
        {selectedIds.size > 0 && (
          <button
            className="library__create-note"
            type="button"
            disabled={busy}
            onClick={() => {
              onCreateNote(items.filter((item) => selectedIds.has(item.id)));
              setSelectedIds(new Set());
            }}
          >
            <NotebookPen aria-hidden="true" />
            合并为便签（{selectedIds.size}）
          </button>
        )}
        {section === "recent" && unfavoritedCount > 0 && (
          confirmingCleanup ? (
            <span className="library__cleanup-confirm">
              <span>删除 {unfavoritedCount} 条？</span>
              <button
                type="button"
                aria-label={`确认删除 ${unfavoritedCount} 条未收藏记录`}
                title="确认删除"
                disabled={busy}
                onClick={() => {
                  setConfirmingCleanup(false);
                  onDeleteUnfavorited();
                }}
              >
                <Check aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="取消清理未收藏记录"
                title="取消"
                onClick={() => setConfirmingCleanup(false)}
              >
                <X aria-hidden="true" />
              </button>
            </span>
          ) : (
            <button
              className="library__cleanup"
              type="button"
              disabled={busy}
              onClick={() => setConfirmingCleanup(true)}
            >
              <Trash2 aria-hidden="true" />
              清理未收藏
            </button>
          )
        )}
      </div>
      <div className="library__grid">
        {visible.map((item) => (
          <ClipCard
            key={item.id}
            item={item}
            onCopy={onCopy}
            onFavorite={onFavorite}
            onDelete={onDelete}
            onCreateNote={() => onCreateNote([item])}
            onSmart={() => setSmartClip(item)}
            selected={selectedIds.has(item.id)}
            onToggleSelected={() => setSelectedIds((current) => {
              const next = new Set(current);
              if (next.has(item.id)) next.delete(item.id);
              else next.add(item.id);
              return next;
            })}
            busy={busy}
            collapseLongClips={collapseLongClips}
            previewLines={previewLines}
          />
        ))}
      </div>
      {visible.length === 0 && (
        <p className="empty-state">
          {section === "favorites" ? "还没有收藏内容" : "还没有剪贴板记录"}
        </p>
      )}
      {smartClip && (
        <SmartClipDialog
          clip={smartClip}
          onClose={() => setSmartClip(null)}
          onMessage={onMessage}
          onCreateNote={async (result) => {
            await onCreateSmartNote(smartClip, result);
            setSmartClip(null);
          }}
        />
      )}
    </section>
  );
}
import { Check, NotebookPen, Trash2, X } from "lucide-react";
import { useState } from "react";
