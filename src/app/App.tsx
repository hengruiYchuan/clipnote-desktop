import { useCallback, useEffect, useRef, useState } from "react";
import { desktopBridge } from "../bridge/desktopBridge";
import { LibraryPanel } from "../features/library/LibraryPanel";
import { NotesPanel } from "../features/notes/NotesPanel";
import { SettingsPanel } from "../features/settings/SettingsPanel";
import {
  readClipPreferences,
  writeClipPreferences,
} from "../features/settings/preferences";
import { ContentTabs } from "../features/shell/ContentTabs";
import { EdgeTab } from "../features/shell/EdgeTab";
import { Workspace } from "../features/shell/Workspace";
import { useShellStore } from "../features/shell/useShellStore";
import type { ClipItem, Note, NoteInput } from "../types/content";

type Message = { text: string; error: boolean };

export function App() {
  const mode = useShellStore((state) => state.mode);
  const section = useShellStore((state) => state.section);
  const query = useShellStore((state) => state.query);
  const setMode = useShellStore((state) => state.setMode);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [paused, setPaused] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [preferences, setPreferences] = useState(readClipPreferences);
  const messageTimer = useRef<number | null>(null);

  const showMessage = useCallback((text: string, error = false) => {
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    setMessage({ text, error });
    messageTimer.current = window.setTimeout(
      () => setMessage(null),
      error ? 5000 : 2600,
    );
  }, []);

  const loadClips = useCallback(async () => {
    setClips(await desktopBridge.listClips());
  }, []);

  const loadNotes = useCallback(async () => {
    setNotes(await desktopBridge.listNotes());
  }, []);

  useEffect(() => {
    writeClipPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    let mounted = true;
    const disposers: (() => void)[] = [];
    const subscribe = async () => {
      const listeners = await Promise.all([
        desktopBridge.onModeChanged((nextMode) => {
          if (mounted) setMode(nextMode);
        }),
        desktopBridge.onClipsChanged(() => {
          if (mounted) void loadClips().catch((error) => showMessage(toMessage(error), true));
        }),
        desktopBridge.onCaptureStateChanged((capturePaused) => {
          if (mounted) setPaused(capturePaused);
        }),
      ]);
      if (mounted) disposers.push(...listeners);
      else listeners.forEach((dispose) => dispose());
    };

    void Promise.all([
      desktopBridge.listClips(),
      desktopBridge.listNotes(),
      desktopBridge.getCapturePaused(),
      desktopBridge.getAutostartEnabled(),
    ])
      .then(([nextClips, nextNotes, capturePaused, nextAutostartEnabled]) => {
        if (!mounted) return;
        setClips(nextClips);
        setNotes(nextNotes);
        setPaused(capturePaused);
        setAutostartEnabled(nextAutostartEnabled);
      })
      .catch((error) => showMessage(toMessage(error), true))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    void subscribe().catch((error) => showMessage(toMessage(error), true));

    return () => {
      mounted = false;
      disposers.forEach((dispose) => dispose());
      if (messageTimer.current) window.clearTimeout(messageTimer.current);
    };
  }, [loadClips, setMode, showMessage]);

  const run = async (
    action: () => Promise<void>,
    successMessage: string,
    refresh?: () => Promise<void>,
  ) => {
    setBusy(true);
    try {
      await action();
      await refresh?.();
      showMessage(successMessage);
      return true;
    } catch (error) {
      showMessage(toMessage(error), true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async (input: NoteInput) => {
    const saved = await run(
      async () => {
        if (editingNote) await desktopBridge.updateNote(editingNote.id, input);
        else await desktopBridge.createNote(input);
      },
      editingNote ? "便签已更新" : "便签已保存",
      loadNotes,
    );
    if (saved) {
      setEditorOpen(false);
      setEditingNote(null);
    }
  };

  if (mode === "collapsed") {
    return <EdgeTab paused={paused} />;
  }

  return (
    <Workspace
      paused={paused}
      message={message}
      onToggleCapture={() => {
        void run(
          () => desktopBridge.setCapturePaused(!paused),
          paused ? "剪贴板采集已恢复" : "剪贴板采集已暂停",
          async () => setPaused(!paused),
        );
      }}
    >
      <ContentTabs />
      {loading ? (
        <p className="empty-state" role="status">正在读取本地数据</p>
      ) : section === "notes" ? (
        <NotesPanel
          notes={notes}
          query={query}
          editorOpen={editorOpen}
          editingNote={editingNote}
          busy={busy}
          onNew={() => {
            setEditingNote(null);
            setEditorOpen(true);
          }}
          onEdit={(note) => {
            setEditingNote(note);
            setEditorOpen(true);
          }}
          onCloseEditor={() => {
            setEditorOpen(false);
            setEditingNote(null);
          }}
          onSave={saveNote}
          onDelete={async (note) => {
            await run(() => desktopBridge.deleteNote(note.id), "便签已删除", loadNotes);
          }}
        />
      ) : section === "settings" ? (
        <SettingsPanel
          paused={paused}
          autostartEnabled={autostartEnabled}
          busy={busy}
          preferences={preferences}
          onChangePreferences={setPreferences}
          onToggleAutostart={() => {
            const nextEnabled = !autostartEnabled;
            void run(
              () => desktopBridge.setAutostartEnabled(nextEnabled),
              nextEnabled ? "已开启开机启动" : "已关闭开机启动",
              async () => setAutostartEnabled(nextEnabled),
            );
          }}
          onToggleCapture={() => {
            void run(
              () => desktopBridge.setCapturePaused(!paused),
              paused ? "剪贴板采集已恢复" : "剪贴板采集已暂停",
              async () => setPaused(!paused),
            );
          }}
        />
      ) : (
        <LibraryPanel
          items={clips}
          busy={busy}
          collapseLongClips={preferences.collapseLongClips}
          previewLines={preferences.previewLines}
          onCopy={(item) => {
            void run(() => desktopBridge.copyClip(item.id), "已复制到剪贴板", loadClips);
          }}
          onFavorite={(item) => {
            void run(
              () => desktopBridge.setClipFavorite(item.id, !item.favorite),
              item.favorite ? "已取消收藏" : "已加入收藏",
              loadClips,
            );
          }}
          onDelete={(item) => {
            void run(() => desktopBridge.deleteClip(item.id), "记录已删除", loadClips);
          }}
        />
      )}
    </Workspace>
  );
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
