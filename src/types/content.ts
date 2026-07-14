export type ClipKind = "code" | "link" | "text" | "path";

export type ClipItem = {
  id: number;
  kind: ClipKind;
  source: string;
  capturedAt: number;
  title: string;
  preview: string;
  favorite: boolean;
  useCount: number;
};

export type NoteTone = "sun" | "mint" | "paper";

export type Note = {
  id: number;
  title: string;
  body: string;
  tone: NoteTone;
  imageData: string;
  createdAt: number;
  updatedAt: number;
};

export type NoteInput = {
  title: string;
  body: string;
  tone: NoteTone;
  imageData: string;
};
