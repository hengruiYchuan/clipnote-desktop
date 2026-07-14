import { motion } from "motion/react";
import { useRef } from "react";
import { desktopBridge } from "../../bridge/desktopBridge";
import { StatusDot } from "../../components/StatusDot";
import { ClipPet } from "./ClipPet";
import { useShellStore } from "./useShellStore";

const DRAG_THRESHOLD = 5;

export function EdgeTab({ paused }: { paused: boolean }) {
  const expand = useShellStore((state) => state.expand);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

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
      <button
        className="edge-tab__open"
        type="button"
        title="单击打开 · 拖动移动 · 右键隐藏"
        aria-label="打开 ClipNote 工作台"
        onClick={(event) => {
          if (event.detail === 0) void open();
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          pointerStart.current = { x: event.clientX, y: event.clientY };
          dragging.current = false;
        }}
        onPointerMove={(event) => {
          if (!pointerStart.current || dragging.current) return;
          const distance = Math.hypot(
            event.clientX - pointerStart.current.x,
            event.clientY - pointerStart.current.y,
          );
          if (distance < DRAG_THRESHOLD) return;
          dragging.current = true;
          pointerStart.current = null;
          void desktopBridge.startDragging();
        }}
        onPointerUp={() => {
          const shouldOpen = pointerStart.current !== null && !dragging.current;
          pointerStart.current = null;
          dragging.current = false;
          if (shouldOpen) void open();
        }}
        onPointerCancel={() => {
          pointerStart.current = null;
          dragging.current = false;
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          void desktopBridge.hide();
        }}
      >
        <ClipPet paused={paused} />
        <StatusDot paused={paused} />
      </button>
    </motion.aside>
  );
}
