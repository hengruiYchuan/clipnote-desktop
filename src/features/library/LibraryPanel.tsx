import type { ClipItem } from "../../types/content";
import { useShellStore } from "../shell/useShellStore";
import { ClipCard } from "./ClipCard";

export function LibraryPanel({
  items,
  onCopy,
  onFavorite,
  onDelete,
  busy,
}: {
  items: ClipItem[];
  onCopy: (item: ClipItem) => void;
  onFavorite: (item: ClipItem) => void;
  onDelete: (item: ClipItem) => void;
  busy: boolean;
}) {
  const query = useShellStore((state) => state.query.trim().toLocaleLowerCase());
  const section = useShellStore((state) => state.section);
  const visible = items.filter((item) => {
    if (section === "favorites" && !item.favorite) return false;
    const haystack = `${item.title} ${item.preview} ${item.source}`.toLocaleLowerCase();
    return haystack.includes(query);
  });

  return (
    <section className="library" aria-label="剪贴板资料库">
      <p className="library__count">共 {visible.length} 条工作碎片</p>
      <div className="library__grid">
        {visible.map((item) => (
          <ClipCard
            key={item.id}
            item={item}
            onCopy={onCopy}
            onFavorite={onFavorite}
            onDelete={onDelete}
            busy={busy}
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
