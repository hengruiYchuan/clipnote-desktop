import { Clipboard, GripVertical, PanelRightClose } from "lucide-react";
import { motion } from "motion/react";
import { desktopBridge } from "../../bridge/desktopBridge";
import { IconButton } from "../../components/IconButton";
import { StatusDot } from "../../components/StatusDot";
import { useShellStore } from "./useShellStore";

export function EdgeTab({ paused }: { paused: boolean }) {
  const expand = useShellStore((state) => state.expand);

  const open = async () => {
    await desktopBridge.expand();
    expand();
  };

  return (
    <motion.aside
      className="edge-tab"
      initial={{ x: 12 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      <IconButton
        label="拖动 ClipNote"
        className="edge-tab__drag"
        onPointerDown={(event) => {
          if (event.button === 0) void desktopBridge.startDragging();
        }}
      >
        <GripVertical aria-hidden="true" />
      </IconButton>
      <IconButton
        label="隐藏 ClipNote"
        className="edge-tab__hide"
        onClick={() => void desktopBridge.hide()}
      >
        <PanelRightClose aria-hidden="true" />
      </IconButton>
      <button
        className="edge-tab__open"
        type="button"
        onClick={open}
        aria-label="打开 ClipNote 工作台"
      >
        <Clipboard aria-hidden="true" />
        <StatusDot paused={paused} />
      </button>
    </motion.aside>
  );
}
