import { useEffect } from "react";
import { desktopBridge } from "../bridge/desktopBridge";
import { clipFixtures, noteFixtures } from "./fixtures";
import { LibraryPanel } from "../features/library/LibraryPanel";
import { NotesPanel } from "../features/notes/NotesPanel";
import { EdgeTab } from "../features/shell/EdgeTab";
import { Workspace } from "../features/shell/Workspace";
import { useShellStore } from "../features/shell/useShellStore";

export function App() {
  const mode = useShellStore((state) => state.mode);
  const section = useShellStore((state) => state.section);
  const setMode = useShellStore((state) => state.setMode);

  useEffect(() => {
    let mounted = true;
    let unlisten: () => void = () => undefined;
    void desktopBridge
      .onModeChanged((nextMode) => {
        if (mounted) setMode(nextMode);
      })
      .then((dispose) => {
        if (mounted) unlisten = dispose;
        else dispose();
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
      unlisten();
    };
  }, [setMode]);

  return mode === "collapsed" ? (
    <EdgeTab />
  ) : (
    <Workspace>
      {section === "notes" ? (
        <NotesPanel notes={noteFixtures} />
      ) : (
        <LibraryPanel
          items={clipFixtures}
          onCopy={(item) => {
            void navigator.clipboard?.writeText(item.preview);
          }}
        />
      )}
    </Workspace>
  );
}
