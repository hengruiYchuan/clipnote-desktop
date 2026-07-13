export type ClipKind = "code" | "link" | "text" | "path";

export type ClipItem = {
  id: string;
  kind: ClipKind;
  source: string;
  capturedAt: string;
  title: string;
  preview: string;
  favorite: boolean;
  useCount: number;
};

export type NotePreview = {
  id: string;
  title: string;
  body: string;
  tone: "sun" | "mint" | "paper";
  checklist?: { label: string; done: boolean }[];
};
