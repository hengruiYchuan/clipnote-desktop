import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Copy,
  Dices,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { desktopBridge } from "../../bridge/desktopBridge";
import { IconButton } from "../../components/IconButton";
import type { VaultEntry, VaultEntryInput, VaultEntrySummary, VaultStatus } from "./types";

const emptyInput: VaultEntryInput = {
  title: "",
  username: "",
  password: "",
  url: "",
  note: "",
  tags: [],
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
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
    if (!needle) return entries;
    return entries.filter((entry) =>
      [entry.title, entry.username, entry.url, ...entry.tags]
        .join("\n")
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [entries, query]);

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
    <section className="vault" aria-labelledby="vault-title">
      <header className="vault__heading">
        <div>
          <span>本机加密存储</span>
          <h2 id="vault-title">密码本</h2>
        </div>
        <div className="vault__heading-actions">
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
                {entry.username && (
                  <IconButton
                    label={`复制 ${entry.title} 的账号`}
                    onClick={() => void run(() => desktopBridge.copyVaultUsername(entry.id), "账号已复制，30 秒后清除")}
                  >
                    <UserRound aria-hidden="true" />
                  </IconButton>
                )}
                <IconButton
                  label={`复制 ${entry.title} 的密码`}
                  onClick={() => void run(() => desktopBridge.copyVaultPassword(entry.id), "密码已复制，30 秒后清除")}
                >
                  <Copy aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={deleteId === entry.id ? `确认删除 ${entry.title}` : `删除 ${entry.title}`}
                  onClick={() => {
                    if (deleteId !== entry.id) {
                      setDeleteId(entry.id);
                      return;
                    }
                    void run(() => desktopBridge.deleteVaultEntry(entry.id), "密码条目已删除")
                      .then((success) => {
                        if (success) void refresh();
                        setDeleteId(null);
                      });
                  }}
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
  const setField = (field: keyof VaultEntryInput, value: string | string[]) =>
    setInput((current) => ({ ...current, [field]: value }));

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
          <IconButton label="关闭密码编辑器" onClick={onClose}><X aria-hidden="true" /></IconButton>
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
          <button type="button" onClick={onClose}>取消</button>
          <button type="submit" disabled={busy || !input.title.trim() || !input.password}>
            <ShieldCheck aria-hidden="true" />保存
          </button>
        </footer>
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
}: {
  autoLockSeconds: number;
  busy: boolean;
  onClose: () => void;
  onAutoLock: (seconds: number) => void;
  onPasswordChange: (currentPassword: string, newPassword: string) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
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
        <form onSubmit={(event) => { event.preventDefault(); onPasswordChange(currentPassword, newPassword); }}>
          <h3>修改主密码</h3>
          <label>当前主密码<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
          <label>新主密码<input type="password" autoComplete="new-password" minLength={10} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
          <button type="submit" disabled={busy || !currentPassword || newPassword.length < 10}>更新主密码</button>
        </form>
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
