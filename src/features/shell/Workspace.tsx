import { useEffect, useRef, type ReactNode } from "react";
import { ChevronRight, Search } from "lucide-react";
import { motion } from "motion/react";
import { desktopBridge } from "../../bridge/desktopBridge";
import { AppMark } from "../../components/AppMark";
import { IconButton } from "../../components/IconButton";
import { Kbd } from "../../components/Kbd";
import { StatusDot } from "../../components/StatusDot";
import { useShellStore } from "./useShellStore";

export function Workspace({ children }: { children: ReactNode }) {
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
        <StatusDot />
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
          placeholder="搜索剪贴板、便签与命令…"
        />
        <Kbd>Esc</Kbd>
      </label>
      <div className="workspace__content">{children}</div>
    </motion.main>
  );
}
