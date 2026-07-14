import { Check, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useState } from "react";
import { ClipPet } from "../shell/ClipPet";
import type { PetSummary } from "./types";
import { AiPetStudio } from "./AiPetStudio";

export function PetSettings({
  pets,
  selectedPetId,
  busy,
  onSelect,
  onImport,
  onDelete,
  onGenerated,
  onMessage,
}: {
  pets: PetSummary[];
  selectedPetId: string;
  busy: boolean;
  onSelect: (id: string) => void;
  onImport: () => void;
  onDelete: (id: string) => void;
  onGenerated: (pet: PetSummary) => void;
  onMessage: (text: string, error?: boolean) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);

  return (
    <div className="pet-settings">
      <div className="pet-settings__toolbar">
        <div>
          <strong>桌宠形象</strong>
          <small>选择内置形象或导入标准宠物包</small>
        </div>
        <span className="pet-settings__tools">
          <button type="button" onClick={() => setStudioOpen(true)} disabled={busy}>
            <Sparkles aria-hidden="true" />AI 设计
          </button>
          <button type="button" onClick={onImport} disabled={busy}>
            <Upload aria-hidden="true" />导入
          </button>
        </span>
      </div>
      <div className="pet-gallery" role="radiogroup" aria-label="桌宠形象">
        {pets.map((pet) => (
          <article
            className="pet-option"
            data-selected={selectedPetId === pet.id || undefined}
            key={pet.id}
          >
            <button
              className="pet-option__select"
              type="button"
              role="radio"
              aria-checked={selectedPetId === pet.id}
              onClick={() => onSelect(pet.id)}
              disabled={busy}
              title={pet.description}
            >
              <span className="pet-option__preview">
                {pet.builtIn ? (
                  <ClipPet paused={false} />
                ) : (
                  <img src={pet.previewDataUrl} alt="" />
                )}
              </span>
              <span>
                <strong>{pet.name}</strong>
                <small>{pet.author}</small>
              </span>
            </button>
            {!pet.builtIn && (
              <span className="pet-option__actions">
                {pendingDelete === pet.id ? (
                  <>
                    <button
                      type="button"
                      aria-label={`确认删除 ${pet.name}`}
                      title="确认删除"
                      onClick={() => {
                        setPendingDelete(null);
                        onDelete(pet.id);
                      }}
                    >
                      <Check aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`取消删除 ${pet.name}`}
                      title="取消"
                      onClick={() => setPendingDelete(null)}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    aria-label={`删除 ${pet.name}`}
                    title="删除"
                    onClick={() => setPendingDelete(pet.id)}
                    disabled={busy}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                )}
              </span>
            )}
          </article>
        ))}
      </div>
      {studioOpen && (
        <AiPetStudio
          onClose={() => setStudioOpen(false)}
          onGenerated={onGenerated}
          onMessage={onMessage}
        />
      )}
    </div>
  );
}
