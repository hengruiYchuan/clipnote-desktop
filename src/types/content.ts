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

export type NoteImage = {
  id: string;
  dataUrl: string;
};

export type Note = {
  id: number;
  title: string;
  body: string;
  tone: NoteTone;
  images: NoteImage[];
  sourceClipIds: number[];
  desktopPinned: boolean;
  desktopX: number | null;
  desktopY: number | null;
  desktopWidth: number;
  desktopHeight: number;
  alwaysOnTop: boolean;
  createdAt: number;
  updatedAt: number;
};

export type DesktopNoteStateInput = Pick<
  Note,
  | "desktopPinned"
  | "desktopX"
  | "desktopY"
  | "desktopWidth"
  | "desktopHeight"
  | "alwaysOnTop"
>;

export type NoteInput = {
  title: string;
  body: string;
  tone: NoteTone;
  images: NoteImage[];
};
