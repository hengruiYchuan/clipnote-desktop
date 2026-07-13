import { clipFixtures } from "./fixtures";
import { LibraryPanel } from "../features/library/LibraryPanel";
import { EdgeTab } from "../features/shell/EdgeTab";
import { Workspace } from "../features/shell/Workspace";
import { useShellStore } from "../features/shell/useShellStore";

export function App() {
  const mode = useShellStore((state) => state.mode);

  return mode === "collapsed" ? (
    <EdgeTab />
  ) : (
    <Workspace>
      <LibraryPanel
        items={clipFixtures}
        onCopy={(item) => {
          void navigator.clipboard?.writeText(item.preview);
        }}
      />
    </Workspace>
  );
}
