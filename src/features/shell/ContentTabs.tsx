import { Settings } from "lucide-react";
import { useShellStore, type ShellSection } from "./useShellStore";

const tabs: { id: ShellSection; label: string }[] = [
  { id: "recent", label: "最近" },
  { id: "favorites", label: "收藏" },
  { id: "notes", label: "便签" },
];

export function ContentTabs() {
  const section = useShellStore((state) => state.section);
  const setSection = useShellStore((state) => state.setSection);

  return (
    <nav className="content-tabs" aria-label="内容分类">
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
      <button
        className="content-tabs__settings"
        type="button"
        aria-label="设置"
        title="设置"
        aria-current={section === "settings" ? "page" : undefined}
        onClick={() => setSection("settings")}
      >
        <Settings aria-hidden="true" />
      </button>
    </nav>
  );
}
