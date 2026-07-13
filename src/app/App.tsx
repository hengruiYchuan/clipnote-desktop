import { clipFixtures, noteFixtures } from "./fixtures";
import { LibraryPanel } from "../features/library/LibraryPanel";
import { NotesPanel } from "../features/notes/NotesPanel";
import { EdgeTab } from "../features/shell/EdgeTab";
import { Workspace } from "../features/shell/Workspace";
import { useShellStore } from "../features/shell/useShellStore";

export function App() {
  const mode = useShellStore((state) => state.mode);
  const section = useShellStore((state) => state.section);

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
