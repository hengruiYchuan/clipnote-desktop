export type PreviewLines = 4 | 6 | 8;

export type ClipPreferences = {
  collapseLongClips: boolean;
  previewLines: PreviewLines;
};

export const defaultClipPreferences: ClipPreferences = {
  collapseLongClips: true,
  previewLines: 6,
};

const STORAGE_KEY = "clipnote.preferences.v1";

export function readClipPreferences(): ClipPreferences {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as
      | Partial<ClipPreferences>
      | null;
    const previewLines = saved?.previewLines;
    return {
      collapseLongClips:
        typeof saved?.collapseLongClips === "boolean"
          ? saved.collapseLongClips
          : defaultClipPreferences.collapseLongClips,
      previewLines:
        previewLines === 4 || previewLines === 6 || previewLines === 8
          ? previewLines
          : defaultClipPreferences.previewLines,
    };
  } catch {
    return defaultClipPreferences;
  }
}

export function writeClipPreferences(preferences: ClipPreferences) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
