import { useState } from "react";
import { ArchiveRestore, Crosshair, Database, Eye, PackageOpen, Power, ScanText, ShieldAlert } from "lucide-react";
import { PetSettings } from "../pets/PetSettings";
import type { PetSummary } from "../pets/types";
import type { ClipPreferences, PreviewLines } from "./preferences";
import type { WindowProcessTarget } from "./types";

const lineOptions: PreviewLines[] = [4, 6, 8];

export function SettingsPanel({
  paused,
  autostartEnabled,
  busy,
  preferences,
  pets,
  selectedPetId,
  onToggleCapture,
  onToggleAutostart,
  onChangePreferences,
  onSelectPet,
  onImportPet,
  onDeletePet,
  onGeneratedPet,
  onPickWindow,
  onTerminateWindowProcess,
  onMessage,
  onExportBackup,
  onRestoreBackup,
}: {
  paused: boolean;
  autostartEnabled: boolean;
  busy: boolean;
  preferences: ClipPreferences;
  pets: PetSummary[];
  selectedPetId: string;
  onToggleCapture: () => void;
  onToggleAutostart: () => void;
  onChangePreferences: (preferences: ClipPreferences) => void;
  onSelectPet: (id: string) => void;
  onImportPet: () => void;
  onDeletePet: (id: string) => void;
  onGeneratedPet: (pet: PetSummary) => void;
  onPickWindow: () => Promise<WindowProcessTarget | null>;
  onTerminateWindowProcess: (target: WindowProcessTarget) => Promise<boolean>;
  onMessage: (text: string, error?: boolean) => void;
  onExportBackup: () => void;
  onRestoreBackup: () => void;
}) {
  const [target, setTarget] = useState<WindowProcessTarget | null>(null);
  const [picking, setPicking] = useState(false);

  const pickWindow = async () => {
    setPicking(true);
    try {
      setTarget(await onPickWindow());
    } finally {
      setPicking(false);
    }
  };

  const terminateTarget = async () => {
    if (target && await onTerminateWindowProcess(target)) setTarget(null);
  };

  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <header className="settings-panel__heading">
        <span>偏好设置</span>
        <h2 id="settings-title">设置</h2>
      </header>

      <div className="settings-panel__section">
        <h3>剪贴板</h3>
        <label className="setting-row">
          <ScanText aria-hidden="true" />
          <span className="setting-row__copy">
            <strong>持续采集</strong>
            <small>自动收录新复制的文字、链接与路径</small>
          </span>
          <input
            className="setting-switch__input"
            type="checkbox"
            checked={!paused}
            disabled={busy}
            onChange={onToggleCapture}
          />
          <span className="setting-switch" aria-hidden="true" />
        </label>
      </div>

      <div className="settings-panel__section">
        <h3>数据备份</h3>
        <div className="setting-row setting-row--backup">
          <Database aria-hidden="true" />
          <span className="setting-row__copy">
            <strong>完整数据包</strong>
            <small>包含剪贴板、便签、加密密码本、偏好设置和自定义桌宠</small>
          </span>
          <div className="setting-row__actions">
            <button type="button" disabled={busy} onClick={onExportBackup}>
              <PackageOpen aria-hidden="true" />导出
            </button>
            <button type="button" disabled={busy} onClick={onRestoreBackup}>
              <ArchiveRestore aria-hidden="true" />恢复
            </button>
          </div>
        </div>
      </div>

      <div className="settings-panel__section">
        <h3>启动</h3>
        <label className="setting-row">
          <Power aria-hidden="true" />
          <span className="setting-row__copy">
            <strong>开机时启动 ClipNote</strong>
            <small>登录 Windows 后让桌宠在桌面边缘待命</small>
          </span>
          <input
            className="setting-switch__input"
            type="checkbox"
            checked={autostartEnabled}
            disabled={busy}
            onChange={onToggleAutostart}
          />
          <span className="setting-switch" aria-hidden="true" />
        </label>
      </div>

      <div className="settings-panel__section">
        <h3>系统工具</h3>
        <div className="setting-row setting-row--process">
          <Crosshair aria-hidden="true" />
          <span className="setting-row__copy">
            <strong>结束卡死窗口</strong>
            <small>隐藏 ClipNote 后，点击要关闭的白屏或卡死窗口</small>
          </span>
          <button
            type="button"
            disabled={busy || picking}
            onClick={() => void pickWindow()}
          >
            <Crosshair aria-hidden="true" />
            {picking ? "请点击目标窗口…" : "选择窗口"}
          </button>
        </div>
      </div>

      <div className="settings-panel__section">
        <h3>桌宠</h3>
        <PetSettings
          pets={pets}
          selectedPetId={selectedPetId}
          busy={busy}
          onSelect={onSelectPet}
          onImport={onImportPet}
          onDelete={onDeletePet}
          onGenerated={onGeneratedPet}
          onMessage={onMessage}
        />
      </div>

      <div className="settings-panel__section">
        <h3>卡片预览</h3>
        <label className="setting-row">
          <Eye aria-hidden="true" />
          <span className="setting-row__copy">
            <strong>长内容默认折叠</strong>
            <small>避免单条内容撑满整个工作台</small>
          </span>
          <input
            className="setting-switch__input"
            type="checkbox"
            checked={preferences.collapseLongClips}
            onChange={(event) =>
              onChangePreferences({
                ...preferences,
                collapseLongClips: event.target.checked,
              })
            }
          />
          <span className="setting-switch" aria-hidden="true" />
        </label>

        <div className="setting-row setting-row--lines">
          <Database aria-hidden="true" />
          <span className="setting-row__copy">
            <strong>折叠行数</strong>
            <small>长内容收起时保留的预览高度</small>
          </span>
          <div className="setting-segments" aria-label="折叠行数">
            {lineOptions.map((lines) => (
              <label key={lines}>
                <input
                  type="radio"
                  name="preview-lines"
                  value={lines}
                  checked={preferences.previewLines === lines}
                  disabled={!preferences.collapseLongClips}
                  onChange={() =>
                    onChangePreferences({ ...preferences, previewLines: lines })
                  }
                />
                <span>{lines} 行</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <p className="settings-panel__local-note">
        <Database aria-hidden="true" />
        剪贴板、便签和设置均保存在此设备
      </p>

      {target && (
        <div className="workspace-quit-backdrop">
          <section
            className="process-target-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="process-target-title"
          >
            <div className="process-target-dialog__icon">
              <ShieldAlert aria-hidden="true" />
            </div>
            <div>
              <span>已选中窗口</span>
              <h2 id="process-target-title">
                {target.closeWindowOnly ? "关闭这个白屏窗口？" : "结束这个进程？"}
              </h2>
              <p>
                {target.closeWindowOnly
                  ? "只关闭或隐藏选中的白屏窗口，不结束它所属的整个进程。"
                  : "结束后，属于该进程的窗口和未保存内容会立即关闭。"}
              </p>
            </div>
            <dl>
              <div><dt>程序</dt><dd>{target.processName}</dd></div>
              <div><dt>窗口</dt><dd>{target.windowTitle || "（无标题）"}</dd></div>
              <div><dt>PID</dt><dd>{target.pid}</dd></div>
              <div><dt>路径</dt><dd title={target.executablePath}>{target.executablePath}</dd></div>
              {target.closeWindowOnly && <div><dt>窗口类</dt><dd>{target.windowClass}</dd></div>}
            </dl>
            <footer>
              <button type="button" disabled={busy} onClick={() => setTarget(null)}>取消</button>
              <button type="button" disabled={busy} onClick={() => void terminateTarget()}>
                {target.closeWindowOnly ? "关闭此窗口" : "结束此进程"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
