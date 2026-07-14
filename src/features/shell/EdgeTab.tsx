import { Archive, Plus } from "lucide-react";
import { motion } from "motion/react";
import { desktopBridge } from "../../bridge/desktopBridge";
import { AppMark } from "../../components/AppMark";
import { IconButton } from "../../components/IconButton";
import { StatusDot } from "../../components/StatusDot";
import { useShellStore } from "./useShellStore";

export function EdgeTab({
  paused,
  onQuickNote,
}: {
  paused: boolean;
  onQuickNote: () => void;
}) {
  const expand = useShellStore((state) => state.expand);

  const open = async () => {
    await desktopBridge.expand();
    expand();
  };

  return (
    <motion.aside
      className="edge-tab"
      initial={{ x: 18 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        className="edge-tab__open"
        type="button"
        onClick={open}
        aria-label="打开 ClipNote 工作台"
      >
        <Archive aria-hidden="true" />
        <AppMark />
        <span className="edge-tab__tagline">随手收，随手找。</span>
        <StatusDot paused={paused} />
      </button>
      <IconButton
        label="快速新建便签"
        className="edge-tab__new"
        onClick={onQuickNote}
      >
        <Plus aria-hidden="true" />
      </IconButton>
    </motion.aside>
  );
}
