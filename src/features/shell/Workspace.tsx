import { useEffect, useRef, type ReactNode } from "react";
import { ChevronRight, Search } from "lucide-react";
import { motion } from "motion/react";
import { desktopBridge } from "../../bridge/desktopBridge";
import { AppMark } from "../../components/AppMark";
import { IconButton } from "../../components/IconButton";
import { StatusDot } from "../../components/StatusDot";
import { useShellStore } from "./useShellStore";

export function Workspace({
  children,
  paused,
  onToggleCapture,
  message,
}: {
  children: ReactNode;
  paused: boolean;
  onToggleCapture: () => void;
  message: { text: string; error: boolean } | null;
}) {
  const collapse = useShellStore((state) => state.collapse);
  const query = useShellStore((state) => state.query);
  const setQuery = useShellStore((state) => state.setQuery);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      await desktopBridge.collapse();
      collapse();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapse]);

  const close = async () => {
    await desktopBridge.collapse();
    collapse();
  };

  return (
    <motion.main
      className="workspace"
      aria-label="ClipNote 桌面工作台"
      initial={{ x: 32, opacity: 0, scale: 0.985 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="workspace__masthead" data-tauri-drag-region>
        <AppMark />
        <button
          className="capture-toggle"
          type="button"
          onClick={onToggleCapture}
          aria-label={paused ? "恢复剪贴板采集" : "暂停剪贴板采集"}
        >
          <StatusDot paused={paused} />
        </button>
        <IconButton label="收起工作台" onClick={close}>
          <ChevronRight aria-hidden="true" />
        </IconButton>
      </header>
      <label className="workspace__search">
        <Search aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          aria-label="搜索工作碎片"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索剪贴板和便签…"
        />
      </label>
      {message && (
        <div
          className="workspace__message"
          data-error={message.error || undefined}
          role={message.error ? "alert" : "status"}
        >
          {message.text}
        </div>
      )}
      <div className="workspace__content">{children}</div>
    </motion.main>
  );
}
