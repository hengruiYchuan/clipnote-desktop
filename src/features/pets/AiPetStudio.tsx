import { useEffect, useState, type FormEvent } from "react";
import { ImagePlus, KeyRound, Sparkles, Trash2, X } from "lucide-react";
import { desktopBridge } from "../../bridge/desktopBridge";
import { IconButton } from "../../components/IconButton";
import type { PetSummary } from "./types";

type ProviderStatus = {
  provider: string;
  configured: boolean;
  defaultModel: string;
};

export function AiPetStudio({
  onClose,
  onGenerated,
  onMessage,
}: {
  onClose: () => void;
  onGenerated: (pet: PetSummary) => void;
  onMessage: (text: string, error?: boolean) => void;
}) {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("简洁、圆润、表情鲜明的二维角色");
  const [referenceDataUrl, setReferenceDataUrl] = useState("");
  const [referenceName, setReferenceName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.resolve()
      .then(desktopBridge.aiPetProviderStatus)
      .then(setStatus)
      .catch((error) => onMessage(toMessage(error), true));
  }, [onMessage]);

  const saveKey = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await desktopBridge.setAiPetApiKey(apiKey);
      setApiKey("");
      setStatus(await desktopBridge.aiPetProviderStatus());
      onMessage("OpenAI API Key 已保存");
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
      });
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
        ) : !status.configured ? (
          <form className="pet-studio__key" onSubmit={saveKey}>
            <label>
              OpenAI API Key
              <input
                autoFocus
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-…"
              />
            </label>
            <button type="submit" disabled={busy || apiKey.trim().length < 20}>
              <KeyRound aria-hidden="true" />保存凭据
            </button>
          </form>
        ) : (
          <form className="pet-studio__form" onSubmit={generate}>
            <div className="pet-studio__provider">
              <span>OpenAI · {status.defaultModel}</span>
              <button
                type="button"
                onClick={() => {
                  void desktopBridge.clearAiPetApiKey().then(async () => {
                    setStatus(await desktopBridge.aiPetProviderStatus());
                    onMessage("API Key 已移除");
                  }).catch((error) => onMessage(toMessage(error), true));
                }}
                disabled={busy}
              >
                <Trash2 aria-hidden="true" />移除
              </button>
            </div>
            <div className="pet-studio__grid">
              <label>名称<input required maxLength={48} value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label>简介<input maxLength={160} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
              <label className="pet-studio__wide">形象描述<textarea required minLength={4} maxLength={1200} rows={4} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：戴黄色耳机、抱着纸飞机的小机器人" /></label>
              <label className="pet-studio__wide">画风<input required maxLength={120} value={style} onChange={(event) => setStyle(event.target.value)} /></label>
            </div>
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
                <Sparkles aria-hidden="true" />{busy ? "正在生成…" : "生成并启用"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
