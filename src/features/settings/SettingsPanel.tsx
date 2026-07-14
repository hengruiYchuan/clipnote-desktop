import { Database, Eye, Power, ScanText } from "lucide-react";
import type { ClipPreferences, PreviewLines } from "./preferences";

const lineOptions: PreviewLines[] = [4, 6, 8];

export function SettingsPanel({
  paused,
  autostartEnabled,
  busy,
  preferences,
  onToggleCapture,
  onToggleAutostart,
  onChangePreferences,
}: {
  paused: boolean;
  autostartEnabled: boolean;
  busy: boolean;
  preferences: ClipPreferences;
  onToggleCapture: () => void;
  onToggleAutostart: () => void;
  onChangePreferences: (preferences: ClipPreferences) => void;
}) {
  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <header className="settings-panel__heading">
        <span>PREFERENCES</span>
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
    </section>
  );
}
