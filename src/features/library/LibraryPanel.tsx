import type { ClipItem } from "../../types/content";
import { useShellStore } from "../shell/useShellStore";
import { ClipCard } from "./ClipCard";

export function LibraryPanel({
  items,
  onCopy,
  onFavorite,
  onDelete,
  onDeleteUnfavorited,
  busy,
  collapseLongClips = true,
  previewLines = 6,
}: {
  items: ClipItem[];
  onCopy: (item: ClipItem) => void;
  onFavorite: (item: ClipItem) => void;
  onDelete: (item: ClipItem) => void;
  onDeleteUnfavorited: () => void;
  busy: boolean;
  collapseLongClips?: boolean;
  previewLines?: 4 | 6 | 8;
}) {
  const [confirmingCleanup, setConfirmingCleanup] = useState(false);
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
    </section>
  );
}
import { Check, Trash2, X } from "lucide-react";
import { useState } from "react";
