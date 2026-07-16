import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArchiveRestore,
  BookOpen,
  Copy,
  Dices,
  Download,
  ExternalLink,
  FileUp,
  FolderOpen,
  Globe2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  LogOut,
  Pencil,
  Pin,
  Plus,
  Settings2,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { desktopBridge } from "../../bridge/desktopBridge";
import { IconButton } from "../../components/IconButton";
import type {
  VaultEntry,
  VaultEntryInput,
  VaultEntrySummary,
  VaultImportPreviewRow,
  VaultStatus,
} from "./types";

const emptyInput: VaultEntryInput = {
  title: "",
  username: "",
  password: "",
  url: "",
  note: "",
  tags: [],
  favorite: false,
  pinned: false,
  lastUsedAt: 0,
};

export function VaultPanel({
  query,
  onMessage,
}: {
  query: string;
  onMessage: (text: string, error?: boolean) => void;
}) {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [entries, setEntries] = useState<VaultEntrySummary[]>([]);
  const [editor, setEditor] = useState<VaultEntry | "new" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState<VaultEntrySummary | null>(null);
  const [selectedTag, setSelectedTag] = useState("");
  const [copyExpiry, setCopyExpiry] = useState<Record<string, number>>({});
  const [importPreview, setImportPreview] = useState<{
    source: string;
    rows: VaultImportPreviewRow[];
  } | null>(null);
  const [clock, setClock] = useState(() => Math.floor(Date.now() / 1000));
  const lastActivityPing = useRef(0);

  const refresh = useCallback(async () => {
    const nextStatus = await desktopBridge.vaultStatus();
    setStatus(nextStatus);
    setEntries(nextStatus.unlocked ? await desktopBridge.listVaultEntries() : []);
  }, []);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve()
      .then(refresh)
      .catch((error) => mounted && onMessage(toMessage(error), true));
    void desktopBridge.onVaultLocked(() => {
      if (!mounted) return;
      setStatus((current) => current && { ...current, unlocked: false });
      setEntries([]);
      setEditor(null);
      setSettingsOpen(false);
      onMessage("密码本已自动锁定");
    }).then((dispose) => {
      if (!mounted) dispose();
    });
    return () => {
      mounted = false;
    };
  }, [onMessage, refresh]);

  useEffect(() => {
    if (!Object.values(copyExpiry).some((expiry) => expiry > clock)) return;
    const timer = window.setInterval(() => setClock(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [clock, copyExpiry]);

  const run = async (action: () => Promise<void>, message?: string) => {
    setBusy(true);
    try {
      await action();
      if (message) onMessage(message);
      return true;
    } catch (error) {
      onMessage(toMessage(error), true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return entries.filter((entry) =>
      (!selectedTag || entry.tags.includes(selectedTag))
      && (!needle || [entry.title, entry.username, entry.url, ...entry.tags]
        .join("\n")
        .toLocaleLowerCase()
        .includes(needle)),
    );
  }, [entries, query, selectedTag]);
  const tags = useMemo(
    () => Array.from(new Set(entries.flatMap((entry) => entry.tags))).sort((a, b) => a.localeCompare(b, "zh-CN")),
    [entries],
  );

  const touchActivity = () => {
    const now = Date.now();
    if (now - lastActivityPing.current < 15_000) return;
    lastActivityPing.current = now;
    void desktopBridge.touchVaultActivity().catch(() => undefined);
  };

  const openCsvImport = () => {
    void run(async () => {
      const source = await desktopBridge.selectVaultCsv();
      if (!source) return;
      const rows = await desktopBridge.previewVaultCsv(source);
      setImportPreview({ source, rows });
    });
  };

  if (!status) return <p className="empty-state">正在检查本地密码本</p>;
  if (!status.initialized || !status.unlocked) {
    return (
      <VaultGate
        initialized={status.initialized}
        busy={busy}
        onSubmit={(password) => {
          void run(
            () => status.initialized
              ? desktopBridge.unlockVault(password)
              : desktopBridge.createVault(password),
          ).then((success) => {
            if (success) void refresh();
          });
        }}
      />
    );
  }

  return (
    <section
      className="vault"
      aria-labelledby="vault-title"
      onKeyDown={touchActivity}
      onPointerDown={touchActivity}
    >
      <header className="vault__heading">
        <div>
          <span>本机加密存储</span>
          <h2 id="vault-title">密码本</h2>
        </div>
        <div className="vault__heading-actions">
          <IconButton
            label="从 CSV 批量导入"
            onClick={openCsvImport}
          >
            <FileUp aria-hidden="true" />
          </IconButton>
          <IconButton label="密码本设置" onClick={() => setSettingsOpen(true)}>
            <Settings2 aria-hidden="true" />
          </IconButton>
          <IconButton
            label="锁定密码本"
            onClick={() => {
              void run(desktopBridge.lockVault, "密码本已锁定").then((success) => {
                if (success) void refresh();
              });
            }}
          >
            <LogOut aria-hidden="true" />
          </IconButton>
          <button className="vault__new" type="button" onClick={() => setEditor("new")}>
            <Plus aria-hidden="true" />
            新建
          </button>
        </div>
      </header>

      <div className="vault__summary">
        <ShieldCheck aria-hidden="true" />
        <span>{entries.length} 个条目</span>
        <span>闲置 {formatAutoLock(status.autoLockSeconds)} 后锁定</span>
      </div>

      {tags.length > 0 && (
        <div className="vault__tag-filter" aria-label="按标签筛选">
          <button
            type="button"
            data-active={!selectedTag || undefined}
            onClick={() => setSelectedTag("")}
          >
            全部
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              data-active={selectedTag === tag || undefined}
              onClick={() => setSelectedTag((current) => current === tag ? "" : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="empty-state">{query ? "没有匹配的密码条目" : "密码本还是空的"}</p>
      ) : (
        <div className="vault__list">
          {filtered.map((entry) => (
            <article className="vault-row" key={entry.id}>
              <button
                className="vault-row__main"
                type="button"
                onClick={() => {
                  void run(async () => setEditor(await desktopBridge.getVaultEntry(entry.id)));
                }}
              >
                <span className="vault-row__mark">{entry.title.slice(0, 1).toLocaleUpperCase()}</span>
                <span className="vault-row__copy">
                  <strong>{entry.title}</strong>
                  <small>{entry.username || entry.url || "未填写账号"}</small>
                </span>
                <Pencil aria-hidden="true" />
              </button>
              <div className="vault-row__actions">
                <IconButton
                  label={entry.pinned ? `取消置顶 ${entry.title}` : `置顶 ${entry.title}`}
                  aria-pressed={entry.pinned}
                  onClick={() => void run(
                    () => desktopBridge.setVaultEntryPinned(entry.id, !entry.pinned),
                  ).then((success) => success && void refresh())}
                >
                  <Pin aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={entry.favorite ? `取消收藏 ${entry.title}` : `收藏 ${entry.title}`}
                  aria-pressed={entry.favorite}
                  onClick={() => void run(
                    () => desktopBridge.setVaultEntryFavorite(entry.id, !entry.favorite),
                  ).then((success) => success && void refresh())}
                >
                  <Star aria-hidden="true" />
                </IconButton>
                {entry.url && (
                  <IconButton
                    label={`打开 ${entry.title} 的网站`}
                    onClick={() => void run(
                      () => desktopBridge.openVaultUrl(entry.id),
                      "已在浏览器打开网站",
                    ).then((success) => success && void refresh())}
                  >
                    <ExternalLink aria-hidden="true" />
                  </IconButton>
                )}
                {entry.username && (
                  <IconButton
                    label={`复制 ${entry.title} 的账号`}
                    onClick={() => void run(async () => {
                      const expiry = await desktopBridge.copyVaultUsername(entry.id);
                      setCopyExpiry((current) => ({ ...current, [entry.id]: expiry }));
                    }, "账号已复制，30 秒后清除")}
                  >
                    <UserRound aria-hidden="true" />
                  </IconButton>
                )}
                <IconButton
                  label={`复制 ${entry.title} 的密码`}
                  onClick={() => void run(async () => {
                    const expiry = await desktopBridge.copyVaultPassword(entry.id);
                    setCopyExpiry((current) => ({ ...current, [entry.id]: expiry }));
                  }, "密码已复制，30 秒后清除")}
                >
                  {copyExpiry[entry.id] > clock
                    ? <span className="vault-row__countdown">{copyExpiry[entry.id] - clock}</span>
                    : <Copy aria-hidden="true" />}
                </IconButton>
                <IconButton
                  label={`删除 ${entry.title}`}
                  onClick={() => setDeleteEntry(entry)}
                >
                  <Trash2 aria-hidden="true" />
                </IconButton>
              </div>
            </article>
          ))}
        </div>
      )}

      {editor && (
        <VaultEditor
          entry={editor === "new" ? null : editor}
          busy={busy}
          onClose={() => setEditor(null)}
          onSave={(input) => {
            void run(
              () => editor === "new"
                ? desktopBridge.createVaultEntry(input).then(() => undefined)
                : desktopBridge.updateVaultEntry(editor.id, input).then(() => undefined),
              editor === "new" ? "密码条目已保存" : "密码条目已更新",
            ).then((success) => {
              if (!success) return;
              setEditor(null);
              void refresh();
            });
          }}
        />
      )}
      {settingsOpen && (
        <VaultSettings
          autoLockSeconds={status.autoLockSeconds}
          busy={busy}
          onClose={() => setSettingsOpen(false)}
          onAutoLock={(seconds) => {
            void run(() => desktopBridge.setVaultAutoLock(seconds), "自动锁定时间已更新")
              .then((success) => {
                if (success) void refresh();
              });
          }}
          onPasswordChange={(currentPassword, newPassword) => {
            void run(
              () => desktopBridge.changeVaultPassword(currentPassword, newPassword),
              "主密码已更新",
            ).then((success) => {
              if (success) setSettingsOpen(false);
            });
          }}
          onBackup={() => {
            void run(async () => {
              const exported = await desktopBridge.exportVaultBackup();
              if (exported) onMessage("加密备份已导出");
            });
          }}
          onImport={openCsvImport}
          onRestore={(source, password, mode) => {
            void run(async () => {
              const result = await desktopBridge.restoreVaultBackup(source, password, mode);
              if (result.replaced) {
                onMessage("密码本已从备份替换，请使用备份主密码解锁");
              } else {
                onMessage(`已恢复 ${result.imported} 条，跳过 ${result.skipped} 条重复记录`);
              }
            }).then((success) => {
              if (!success) return;
              setSettingsOpen(false);
              void refresh();
            });
          }}
          onCopyPairing={() => {
            void run(async () => {
              const info = await desktopBridge.copyBrowserPairingToken();
              onMessage(`浏览器配对码已复制，服务端口 ${info.port}`);
            });
          }}
          onRotatePairing={() => {
            void run(async () => {
              const info = await desktopBridge.rotateBrowserPairingToken();
              onMessage(`已换新配对码，服务端口 ${info.port}`);
            });
          }}
        />
      )}
      {deleteEntry && (
        <VaultDeleteDialog
          entry={deleteEntry}
          busy={busy}
          onClose={() => setDeleteEntry(null)}
          onDelete={() => {
            void run(() => desktopBridge.deleteVaultEntry(deleteEntry.id), "密码条目已删除")
              .then((success) => {
                if (success) void refresh();
                setDeleteEntry(null);
              });
          }}
        />
      )}
      {importPreview && (
        <VaultImportDialog
          source={importPreview.source}
          rows={importPreview.rows}
          busy={busy}
          onClose={() => setImportPreview(null)}
          onImport={(selected) => {
            void run(async () => {
              const result = await desktopBridge.importVaultCsv(importPreview.source, selected);
              onMessage(`已导入 ${result.imported} 条，跳过 ${result.skipped} 条`);
            }).then((success) => {
              if (!success) return;
              setImportPreview(null);
              void refresh();
            });
          }}
        />
      )}
    </section>
  );
}

function VaultGate({
  initialized,
  busy,
  onSubmit,
}: {
  initialized: boolean;
  busy: boolean;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!initialized && password.length < 10) {
      setError("主密码至少需要 10 个字符");
      return;
    }
    if (!initialized && password !== confirmation) {
      setError("两次输入的主密码不一致");
      return;
    }
    setError("");
    onSubmit(password);
  };

  return (
    <section className="vault-gate" aria-labelledby="vault-gate-title">
      <div className="vault-gate__seal"><LockKeyhole aria-hidden="true" /></div>
      <span>{initialized ? "本地保险库已锁定" : "首次使用"}</span>
      <h2 id="vault-gate-title">{initialized ? "解锁密码本" : "创建密码本"}</h2>
      <p>{initialized ? "输入主密码继续。" : "设置一个只由你掌握的主密码。"}</p>
      <form onSubmit={submit}>
        <label>
          主密码
          <input
            autoFocus
            autoComplete={initialized ? "current-password" : "new-password"}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {!initialized && (
          <label>
            再输一次
            <input
              autoComplete="new-password"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
        )}
        {error && <p className="vault-form-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy || !password}>
          <KeyRound aria-hidden="true" />
          {initialized ? "解锁" : "创建并解锁"}
        </button>
      </form>
    </section>
  );
}

function VaultEditor({
  entry,
  busy,
  onClose,
  onSave,
}: {
  entry: VaultEntry | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: VaultEntryInput) => void;
}) {
  const [input, setInput] = useState<VaultEntryInput>(entry ?? emptyInput);
  const [revealed, setRevealed] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const setField = (field: keyof VaultEntryInput, value: string | string[]) =>
    setInput((current) => ({ ...current, [field]: value }));
  const dirty = JSON.stringify(input) !== JSON.stringify(entry ?? emptyInput);
  const requestClose = () => {
    if (dirty) setConfirmClose(true);
    else onClose();
  };

  useEffect(() => {
    if (!revealed) return;
    const hide = () => setRevealed(false);
    const timer = window.setTimeout(hide, 15_000);
    window.addEventListener("blur", hide);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("blur", hide);
    };
  }, [revealed]);

  return (
    <div className="vault-modal-backdrop" role="presentation">
      <form
        className="vault-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-editor-title"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(input);
        }}
      >
        <header>
          <div>
            <span>加密条目</span>
            <h2 id="vault-editor-title">{entry ? "编辑密码" : "新建密码"}</h2>
          </div>
          <IconButton label="关闭密码编辑器" onClick={requestClose}><X aria-hidden="true" /></IconButton>
        </header>
        <div className="vault-editor__grid">
          <label className="vault-editor__wide">名称<input autoFocus required value={input.title} onChange={(event) => setField("title", event.target.value)} /></label>
          <label>账号<input value={input.username} onChange={(event) => setField("username", event.target.value)} /></label>
          <label>网址<input inputMode="url" value={input.url} onChange={(event) => setField("url", event.target.value)} /></label>
          <label className="vault-editor__wide">
            密码
            <span className="vault-secret-input">
              <input
                required
                type={revealed ? "text" : "password"}
                value={input.password}
                onChange={(event) => setField("password", event.target.value)}
              />
              <IconButton label={revealed ? "隐藏密码" : "显示密码"} onClick={() => setRevealed(!revealed)}>
                {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </IconButton>
              <IconButton label="生成强密码" onClick={() => setField("password", generatePassword())}>
                <Dices aria-hidden="true" />
              </IconButton>
            </span>
          </label>
          <label className="vault-editor__wide">标签<input placeholder="工作, 邮箱" value={input.tags.join(", ")} onChange={(event) => setField("tags", event.target.value.split(/[,，]/))} /></label>
          <label className="vault-editor__wide">备注<textarea rows={4} value={input.note} onChange={(event) => setField("note", event.target.value)} /></label>
        </div>
        <footer>
          <button type="button" onClick={requestClose}>取消</button>
          <button type="submit" disabled={busy || !input.title.trim() || !input.password}>
            <ShieldCheck aria-hidden="true" />保存
          </button>
        </footer>
        {confirmClose && (
          <div className="vault-editor__discard" role="alertdialog" aria-modal="true" aria-labelledby="vault-discard-title">
            <h3 id="vault-discard-title">放弃未保存的修改？</h3>
            <p>当前编辑内容还没有保存。</p>
            <div>
              <button type="button" onClick={() => setConfirmClose(false)}>继续编辑</button>
              <button type="button" onClick={onClose}>放弃修改</button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

function VaultSettings({
  autoLockSeconds,
  busy,
  onClose,
  onAutoLock,
  onPasswordChange,
  onBackup,
  onImport,
  onRestore,
  onCopyPairing,
  onRotatePairing,
}: {
  autoLockSeconds: number;
  busy: boolean;
  onClose: () => void;
  onAutoLock: (seconds: number) => void;
  onPasswordChange: (currentPassword: string, newPassword: string) => void;
  onBackup: () => void;
  onImport: () => void;
  onRestore: (source: string, password: string, mode: "merge" | "replace") => void;
  onCopyPairing: () => void;
  onRotatePairing: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [restorePath, setRestorePath] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [tutorialOpen, setTutorialOpen] = useState<"export" | "import" | null>(null);
  const passwordsMatch = newPassword === confirmation;
  return (
    <div className="vault-modal-backdrop" role="presentation">
      <section className="vault-settings" role="dialog" aria-modal="true" aria-labelledby="vault-settings-title">
        <header><h2 id="vault-settings-title">密码本设置</h2><IconButton label="关闭密码本设置" onClick={onClose}><X aria-hidden="true" /></IconButton></header>
        <label>
          自动锁定
          <select value={autoLockSeconds} onChange={(event) => onAutoLock(Number(event.target.value))} disabled={busy}>
            <option value={30}>30 秒</option>
            <option value={60}>1 分钟</option>
            <option value={300}>5 分钟</option>
            <option value={900}>15 分钟</option>
            <option value={1800}>30 分钟</option>
            <option value={3600}>1 小时</option>
          </select>
        </label>
        <section className="vault-settings__backup" aria-labelledby="vault-backup-title">
          <h3 id="vault-backup-title">加密备份</h3>
          <div className="vault-settings__backup-actions">
            <button type="button" onClick={onBackup} disabled={busy}>
              <Download aria-hidden="true" />
              导出 .clipvault
            </button>
            <button type="button" onClick={() => setTutorialOpen("export")}>
              <BookOpen aria-hidden="true" />
              导出教程
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void desktopBridge.selectVaultBackup().then((path) => {
              if (path) setRestorePath(path);
            })}
          >
            <ArchiveRestore aria-hidden="true" />
            选择备份文件
          </button>
          {restorePath && (
            <form onSubmit={(event) => {
              event.preventDefault();
              onRestore(restorePath, restorePassword, restoreMode);
            }}>
              <p title={restorePath}>{restorePath.split(/[\\/]/).pop()}</p>
              <label>
                恢复方式
                <select value={restoreMode} onChange={(event) => setRestoreMode(event.target.value as "merge" | "replace")}>
                  <option value="merge">合并到当前密码本</option>
                  <option value="replace">替换当前密码本</option>
                </select>
              </label>
              <label>
                备份主密码
                <input type="password" autoComplete="current-password" value={restorePassword} onChange={(event) => setRestorePassword(event.target.value)} />
              </label>
              <button type="submit" disabled={busy || !restorePassword}>开始恢复</button>
            </form>
          )}
        </section>
        <section className="vault-settings__import" aria-labelledby="vault-import-settings-title">
          <h3 id="vault-import-settings-title">从浏览器导入</h3>
          <p>支持 Chrome、Edge 和常见密码管理器 CSV。</p>
          <div className="vault-settings__backup-actions">
            <button type="button" onClick={onImport} disabled={busy}>
              <FileUp aria-hidden="true" />
              导入 CSV
            </button>
            <button type="button" onClick={() => setTutorialOpen("import")}>
              <BookOpen aria-hidden="true" />
              导入教程
            </button>
          </div>
        </section>
        <section className="vault-settings__browser" aria-labelledby="vault-browser-title">
          <h3 id="vault-browser-title">浏览器自动填充</h3>
          <div>
            <button type="button" onClick={onCopyPairing} disabled={busy}>复制配对码</button>
            <button type="button" onClick={onRotatePairing} disabled={busy}>换新配对码</button>
          </div>
        </section>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (passwordsMatch) onPasswordChange(currentPassword, newPassword);
        }}>
          <h3>修改主密码</h3>
          <label>当前主密码<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
          <label>新主密码<input type="password" autoComplete="new-password" minLength={10} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
          <label>确认新主密码<input type="password" autoComplete="new-password" minLength={10} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          {confirmation && !passwordsMatch && <p className="vault-form-error" role="alert">两次输入的新主密码不一致</p>}
          <button type="submit" disabled={busy || !currentPassword || newPassword.length < 10 || !passwordsMatch}>更新主密码</button>
        </form>
        {tutorialOpen === "export" && <VaultExportTutorial onClose={() => setTutorialOpen(null)} />}
        {tutorialOpen === "import" && <VaultImportTutorial onClose={() => setTutorialOpen(null)} />}
      </section>
    </div>
  );
}

function VaultImportTutorial({ onClose }: { onClose: () => void }) {
  return (
    <div className="vault-tutorial-backdrop" role="presentation">
      <section className="vault-tutorial vault-import-tutorial" role="dialog" aria-modal="true" aria-labelledby="vault-import-tutorial-title">
        <header>
          <div>
            <span>Chrome + Edge</span>
            <h2 id="vault-import-tutorial-title">从浏览器导入密码</h2>
          </div>
          <IconButton label="关闭导入教程" onClick={onClose}><X aria-hidden="true" /></IconButton>
        </header>
        <p className="vault-tutorial__intro">先从浏览器导出密码 CSV，再交给 ClipNote 预览、去重并加密保存。</p>
        <ol className="vault-tutorial__steps">
          <li>
            <div className="vault-tutorial__figure vault-browser-guide" data-browser="chrome" aria-hidden="true">
              <div className="vault-browser-guide__bar"><Globe2 /><strong>Google 密码管理器</strong></div>
              <div className="vault-browser-guide__menu"><span>设置</span><b>导出密码</b></div>
            </div>
            <div><span>CHROME</span><strong>导出 Google Chrome 密码</strong><p>Chrome 右上角菜单 → 密码和自动填充 → Google 密码管理器 → 设置 → 导出密码。</p></div>
          </li>
          <li>
            <div className="vault-tutorial__figure vault-browser-guide" data-browser="edge" aria-hidden="true">
              <div className="vault-browser-guide__bar"><Globe2 /><strong>Microsoft Edge</strong></div>
              <div className="vault-browser-guide__menu"><span>密码设置</span><b>导出密码</b></div>
            </div>
            <div><span>EDGE</span><strong>导出 Microsoft Edge 密码</strong><p>Edge 右上角菜单 → 设置 → 密码 → 更多操作 → 导出密码。</p></div>
          </li>
          <li>
            <div className="vault-tutorial__figure vault-browser-guide vault-browser-guide--clipnote" aria-hidden="true">
              <FileUp />
              <div><b>导入 CSV</b><span>预览 → 去重 → 导入所选</span></div>
            </div>
            <div><span>CLIPNOTE</span><strong>选择 CSV 并确认</strong><p>点击“导入 CSV”，检查预览中的账号和重复提示，再导入所选条目。</p></div>
          </li>
        </ol>
        <footer>
          <p><KeyRound aria-hidden="true" />浏览器导出的 CSV 含明文密码。导入成功后，请从磁盘和回收站中妥善清理。</p>
          <button type="button" onClick={onClose}>知道了</button>
        </footer>
      </section>
    </div>
  );
}

function VaultExportTutorial({ onClose }: { onClose: () => void }) {
  return (
    <div className="vault-tutorial-backdrop" role="presentation">
      <section className="vault-tutorial" role="dialog" aria-modal="true" aria-labelledby="vault-tutorial-title">
        <header>
          <div>
            <span>3 步完成</span>
            <h2 id="vault-tutorial-title">如何导出加密备份</h2>
          </div>
          <IconButton label="关闭导出教程" onClick={onClose}><X aria-hidden="true" /></IconButton>
        </header>
        <p className="vault-tutorial__intro">导出的文件仍由当前主密码加密，适合保存到移动硬盘或可信云盘。</p>
        <ol className="vault-tutorial__steps">
          <li>
            <div className="vault-tutorial__figure vault-tutorial__figure--export" aria-hidden="true">
              <div className="vault-tutorial__window-bar"><i /><i /><i /></div>
              <div><Download /><span>导出 .clipvault</span></div>
            </div>
            <div><span>01</span><strong>点击导出</strong><p>在密码本设置中点击“导出 .clipvault”。</p></div>
          </li>
          <li>
            <div className="vault-tutorial__figure vault-tutorial__figure--file" aria-hidden="true">
              <FolderOpen />
              <div><strong>ClipNote-密码本备份</strong><span>.clipvault</span></div>
            </div>
            <div><span>02</span><strong>选择保存位置</strong><p>保留文件扩展名，放到你能长期找到的位置。</p></div>
          </li>
          <li>
            <div className="vault-tutorial__figure vault-tutorial__figure--restore" aria-hidden="true">
              <ArchiveRestore />
              <div><span>选择备份文件</span><i>••••••••••</i></div>
            </div>
            <div><span>03</span><strong>需要时恢复</strong><p>选择备份，输入导出时的主密码，再选择合并或替换。</p></div>
          </li>
        </ol>
        <footer>
          <p><KeyRound aria-hidden="true" />主密码不会写入备份，忘记后也不能找回。</p>
          <button type="button" onClick={onClose}>知道了</button>
        </footer>
      </section>
    </div>
  );
}

function VaultDeleteDialog({
  entry,
  busy,
  onClose,
  onDelete,
}: {
  entry: VaultEntrySummary;
  busy: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="vault-modal-backdrop" role="presentation">
      <section className="vault-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="vault-delete-title">
        <header>
          <h2 id="vault-delete-title">删除“{entry.title}”？</h2>
          <IconButton label="关闭删除确认" onClick={onClose}><X aria-hidden="true" /></IconButton>
        </header>
        <p>删除后需要通过备份才能恢复该条目。</p>
        <footer>
          <button type="button" onClick={onClose} disabled={busy}>取消</button>
          <button type="button" onClick={onDelete} disabled={busy}>确认删除</button>
        </footer>
      </section>
    </div>
  );
}

function VaultImportDialog({
  source,
  rows,
  busy,
  onClose,
  onImport,
}: {
  source: string;
  rows: VaultImportPreviewRow[];
  busy: boolean;
  onClose: () => void;
  onImport: (selected: number[]) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(
    rows.filter((row) => row.hasPassword && !row.duplicate).map((row) => row.index),
  ));
  const toggle = (index: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };
  return (
    <div className="vault-modal-backdrop" role="presentation">
      <section className="vault-import-dialog" role="dialog" aria-modal="true" aria-labelledby="vault-import-title">
        <header>
          <div>
            <span>CSV 预览</span>
            <h2 id="vault-import-title">批量导入密码</h2>
          </div>
          <IconButton label="关闭导入预览" onClick={onClose}><X aria-hidden="true" /></IconButton>
        </header>
        <p className="vault-import-dialog__source" title={source}>{source.split(/[\\/]/).pop()}</p>
        <div className="vault-import-dialog__list">
          {rows.map((row) => (
            <label key={row.index} data-disabled={row.duplicate || !row.hasPassword || undefined}>
              <input
                type="checkbox"
                checked={selected.has(row.index)}
                disabled={row.duplicate || !row.hasPassword}
                onChange={() => toggle(row.index)}
              />
              <span>
                <strong>{row.title}</strong>
                <small>{row.username || row.url || "未填写账号"}</small>
              </span>
              <em>{row.duplicate ? "重复" : row.hasPassword ? "可导入" : "缺少密码"}</em>
            </label>
          ))}
        </div>
        <footer>
          <span>已选择 {selected.size} / {rows.length}</span>
          <button type="button" onClick={onClose} disabled={busy}>取消</button>
          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => onImport(Array.from(selected))}
          >
            导入所选
          </button>
        </footer>
      </section>
    </div>
  );
}

function generatePassword(length = 22) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-=?";
  const values = new Uint32Array(length);
  globalThis.crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function formatAutoLock(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${seconds / 60} 分钟`;
  return `${seconds / 3600} 小时`;
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
