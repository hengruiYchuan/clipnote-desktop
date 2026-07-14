export type PetVisualState =
  | "idle"
  | "paused"
  | "captured"
  | "dragging"
  | "error";

export type PetAnimation = {
  row: number;
  frames: number[];
  frameDurationMs: number;
  loop: boolean;
};

export type PetSummary = {
  id: string;
  name: string;
  author: string;
  description: string;
  previewDataUrl: string;
  builtIn: boolean;
};

export type PetDefinition = Omit<PetSummary, "previewDataUrl" | "builtIn"> & {
  spriteDataUrl: string;
  cellWidth: number;
  cellHeight: number;
  columns: number;
  rows: number;
  animations: Record<PetVisualState, PetAnimation>;
};

export const builtinPet: PetSummary = {
  id: "clipnote",
  name: "纸片夹精灵",
  author: "ClipNote",
  description: "ClipNote 的原创轻量桌宠",
  previewDataUrl: "",
  builtIn: true,
};
