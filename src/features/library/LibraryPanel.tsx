import type { ClipItem } from "../../types/content";
import { useShellStore, type ShellSection } from "../shell/useShellStore";
import { ClipCard } from "./ClipCard";

const tabs: { id: ShellSection; label: string }[] = [
  { id: "recent", label: "最近" },
  { id: "favorites", label: "收藏" },
  { id: "notes", label: "便签" },
];

export function LibraryPanel({
  items,
  onCopy,
}: {
  items: ClipItem[];
  onCopy: (item: ClipItem) => void;
}) {
  const query = useShellStore((state) => state.query.trim().toLocaleLowerCase());
  const section = useShellStore((state) => state.section);
  const setSection = useShellStore((state) => state.setSection);
  const visible = items.filter((item) => {
    if (section === "favorites" && !item.favorite) return false;
    const haystack = `${item.title} ${item.preview} ${item.source}`.toLocaleLowerCase();
    return haystack.includes(query);
  });

  return (
    <section className="library" aria-label="剪贴板资料库">
      <nav className="library__tabs" aria-label="内容分类">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={section === tab.id ? "page" : undefined}
            onClick={() => setSection(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <p className="library__count">今天收集了 {visible.length} 条工作碎片</p>
      <div className="library__grid">
        {visible.map((item) => (
          <ClipCard key={item.id} item={item} onCopy={onCopy} />
        ))}
      </div>
    </section>
  );
}
