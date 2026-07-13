import { EdgeTab } from "../features/shell/EdgeTab";
import { Workspace } from "../features/shell/Workspace";
import { useShellStore } from "../features/shell/useShellStore";

export function App() {
  const mode = useShellStore((state) => state.mode);

  return mode === "collapsed" ? (
    <EdgeTab />
  ) : (
    <Workspace>
      <section aria-label="工作台内容" />
    </Workspace>
  );
}
