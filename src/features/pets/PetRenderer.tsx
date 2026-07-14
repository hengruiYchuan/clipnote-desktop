import { useEffect, useState, type CSSProperties } from "react";
import { ClipPet } from "../shell/ClipPet";
import type { PetDefinition, PetVisualState } from "./types";

type SpriteStyle = CSSProperties & {
  "--pet-aspect-ratio": string;
};

export function PetRenderer({
  pet,
  state,
  className,
}: {
  pet: PetDefinition | null;
  state: PetVisualState;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const animation = pet?.animations[state] ?? pet?.animations.idle;

  if (!pet || !animation) {
    return <ClipPet paused={state === "paused"} />;
  }

  return (
    <AnimatedPetSprite
      key={`${pet.id}:${state}`}
      pet={pet}
      state={state}
      className={className}
      reducedMotion={reducedMotion}
    />
  );
}

function AnimatedPetSprite({
  pet,
  state,
  className,
  reducedMotion,
}: {
  pet: PetDefinition;
  state: PetVisualState;
  className?: string;
  reducedMotion: boolean;
}) {
  const [frameIndex, setFrameIndex] = useState(0);
  const animation = pet.animations[state] ?? pet.animations.idle;

  useEffect(() => {
    if (reducedMotion || animation.frames.length < 2) return;
    let current = 0;
    let timer = 0;
    const advance = () => {
      timer = window.setTimeout(() => {
        const next = current + 1;
        if (next >= animation.frames.length) {
          if (!animation.loop) return;
          current = 0;
        } else {
          current = next;
        }
        setFrameIndex(current);
        advance();
      }, animation.frameDurationMs);
    };
    advance();
    return () => window.clearTimeout(timer);
  }, [animation, reducedMotion]);

  const column = animation.frames[Math.min(frameIndex, animation.frames.length - 1)] ?? 0;
  const x = pet.columns > 1 ? (column / (pet.columns - 1)) * 100 : 0;
  const y = pet.rows > 1 ? (animation.row / (pet.rows - 1)) * 100 : 0;
  const style: SpriteStyle = {
    "--pet-aspect-ratio": `${pet.cellWidth} / ${pet.cellHeight}`,
    backgroundImage: `url(${pet.spriteDataUrl})`,
    backgroundPosition: `${x}% ${y}%`,
    backgroundSize: `${pet.columns * 100}% ${pet.rows * 100}%`,
  };

  return (
    <span
      className={["pet-sprite", className].filter(Boolean).join(" ")}
      data-pet-state={state}
      data-testid="pet-sprite"
      style={style}
      aria-hidden="true"
    />
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}
