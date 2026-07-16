import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ImagePlus, KeyRound, Settings2, Sparkles, Trash2, Wifi, X } from "lucide-react";
import { desktopBridge } from "../../bridge/desktopBridge";
import { IconButton } from "../../components/IconButton";
import type { AiPetProviderInput, AiPetProviderStatus, PetSummary } from "./types";

export function AiPetStudio({
  onClose,
  onGenerated,
  onMessage,
}: {
  onClose: () => void;
  onGenerated: (pet: PetSummary) => void;
  onMessage: (text: string, error?: boolean) => void;
}) {
  const [status, setStatus] = useState<AiPetProviderStatus | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("gpt-image-1.5");
  const [textModel, setTextModel] = useState("gpt-4.1-mini");
  const [apiKey, setApiKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("简洁、圆润、表情鲜明的二维角色");
  const [referenceDataUrl, setReferenceDataUrl] = useState("");
  const [referenceName, setReferenceName] = useState("");
  const [generationMode, setGenerationMode] = useState<"light" | "full">("full");
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    const nextStatus = await desktopBridge.aiPetProviderStatus();
    setStatus(nextStatus);
    setBaseUrl(nextStatus.baseUrl);
      setModel(nextStatus.model);
      setTextModel(nextStatus.textModel ?? "gpt-4.1-mini");
    setConfigOpen(!nextStatus.configured);
    return nextStatus;
  }, []);

  useEffect(() => {
    void Promise.resolve()
      .then(refreshStatus)
      .catch((error) => onMessage(toMessage(error), true));
  }, [onMessage, refreshStatus]);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    if (typeof desktopBridge.onAiPetGenerationProgress !== "function") return;
    void desktopBridge.onAiPetGenerationProgress((next) => {
      setProgress(`正在生成${stateLabel(next.state)}（${next.completed}/${next.total}）`);
    }).then((listener) => { dispose = listener; });
    return () => dispose?.();
  }, []);

  const providerInput = (): AiPetProviderInput => ({ baseUrl, model, textModel, apiKey });

  const saveProvider = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await desktopBridge.setAiPetProvider(providerInput());
      setApiKey("");
      await refreshStatus();
      setConfigOpen(false);
      onMessage("图片生成服务已保存");
    } catch (error) {
      onMessage(toMessage(error), true);
    } finally {
      setBusy(false);
    }
  };

  const testProvider = async () => {
    setBusy(true);
    try {
      await desktopBridge.testAiPetProvider(providerInput());
      onMessage("图片生成服务连接成功");
    } catch (error) {
      onMessage(toMessage(error), true);
    } finally {
      setBusy(false);
    }
  };

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const pet = await desktopBridge.generateAiPet({
        name,
        description,
        prompt,
        style,
        referenceDataUrl,
        mode: generationMode,
      });
      setProgress("");
      onGenerated(pet);
      onMessage("新桌宠已生成并启用");
      onClose();
    } catch (error) {
      onMessage(toMessage(error), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pet-studio-backdrop" role="presentation">
      <section className="pet-studio" role="dialog" aria-modal="true" aria-labelledby="pet-studio-title">
        <header>
          <div><span>AI 形象工坊</span><h2 id="pet-studio-title">设计桌宠</h2></div>
          <IconButton label="关闭桌宠工坊" onClick={onClose}><X aria-hidden="true" /></IconButton>
        </header>

        {!status ? (
          <p className="pet-studio__loading">正在读取生成服务</p>
        ) : (
          <>
            {configOpen && (
              <form className="pet-studio__config" onSubmit={saveProvider}>
                <div className="pet-studio__config-title">
                  <span><KeyRound aria-hidden="true" />生成服务</span>
                  <small>OpenAI 兼容接口</small>
                </div>
                <div className="pet-studio__config-grid">
                  <label className="pet-studio__wide">
                    接口地址
                    <input
                      autoFocus
                      required
                      type="url"
                      value={baseUrl}
                      onChange={(event) => setBaseUrl(event.target.value)}
                      placeholder="https://api.example.com/v1"
                    />
                  </label>
                  <label>
                    模型
                    <input
                      required
                      maxLength={160}
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      placeholder="gpt-image-1.5"
                    />
                  </label>
                  <label>
                    文本模型
                    <input
                      required
                      maxLength={160}
                      value={textModel}
                      onChange={(event) => setTextModel(event.target.value)}
                      placeholder="gpt-4.1-mini"
                    />
                  </label>
                  <label>
                    API Key
                    <input
                      type="password"
                      autoComplete="off"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder={status.configured ? "留空保持原 Key" : "可选"}
                    />
                  </label>
                </div>
                <div className="pet-studio__config-actions">
                  {status.configured && (
                    <button
                      type="button"
                      onClick={() => {
                        setBaseUrl(status.baseUrl);
                        setModel(status.model);
                        setTextModel(status.textModel ?? "gpt-4.1-mini");
                        setApiKey("");
                        setConfigOpen(false);
                      }}
                      disabled={busy}
                    >
                      取消
                    </button>
                  )}
                  <button type="button" onClick={testProvider} disabled={busy || !baseUrl.trim() || !model.trim()}>
                    <Wifi aria-hidden="true" />测试连接
                  </button>
                  <button type="submit" disabled={busy || !baseUrl.trim() || !model.trim()}>
                    <KeyRound aria-hidden="true" />保存配置
                  </button>
                </div>
              </form>
            )}

            {status.configured && !configOpen && (
              <form className="pet-studio__form" onSubmit={generate}>
                <div className="pet-studio__provider">
                  <span className="pet-studio__provider-copy">
                    <strong>{status.model}</strong>
                    <small>{providerHost(status.baseUrl)}</small>
                  </span>
                  <span className="pet-studio__provider-actions">
                    <button type="button" onClick={() => setConfigOpen(true)} disabled={busy}>
                      <Settings2 aria-hidden="true" />配置
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void desktopBridge.clearAiPetApiKey().then(async () => {
                          await refreshStatus();
                          onMessage("生成服务配置已移除");
                        }).catch((error) => onMessage(toMessage(error), true));
                      }}
                      disabled={busy}
                    >
                      <Trash2 aria-hidden="true" />移除
                    </button>
                  </span>
                </div>
                <div className="pet-studio__grid">
                  <label>名称<input required maxLength={48} value={name} onChange={(event) => setName(event.target.value)} /></label>
                  <label>简介<input maxLength={160} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
                  <label className="pet-studio__wide">形象描述<textarea required minLength={4} maxLength={1200} rows={4} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：戴黄色耳机、抱着纸飞机的小机器人" /></label>
                  <label className="pet-studio__wide">画风<input required maxLength={120} value={style} onChange={(event) => setStyle(event.target.value)} /></label>
                </div>
                <fieldset className="pet-studio__mode">
                  <legend>动画方式</legend>
                  <label>
                    <input type="radio" name="generation-mode" checked={generationMode === "full"} onChange={() => setGenerationMode("full")} />
                    <span>完整动画 · 5 张状态原画</span>
                  </label>
                  <label>
                    <input type="radio" name="generation-mode" checked={generationMode === "light"} onChange={() => setGenerationMode("light")} />
                    <span>轻量动画 · 1 张原画</span>
                  </label>
                </fieldset>
                <label className="pet-studio__reference">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (file.size > 8 * 1024 * 1024) {
                        onMessage("参考图不能超过 8 MB", true);
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        setReferenceDataUrl(String(reader.result));
                        setReferenceName(file.name);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <ImagePlus aria-hidden="true" />
                  <span>{referenceName || "添加参考图"}</span>
                  {referenceDataUrl && <img src={referenceDataUrl} alt="参考图预览" />}
                </label>
                <footer>
                  <button type="button" onClick={onClose}>取消</button>
                  <button type="submit" disabled={busy || !name.trim() || prompt.trim().length < 4}>
                    <Sparkles aria-hidden="true" />{busy ? (progress || "正在生成…") : "生成并启用"}
                  </button>
                </footer>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function providerHost(baseUrl: string) {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

function stateLabel(state: string) {
  return ({ idle: "待机", paused: "暂停", captured: "捕获", dragging: "拖动", error: "错误" } as Record<string, string>)[state] ?? state;
}
