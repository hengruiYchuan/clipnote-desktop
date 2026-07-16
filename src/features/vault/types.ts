export type VaultStatus = {
  initialized: boolean;
  unlocked: boolean;
  autoLockSeconds: number;
};

export type VaultEntryInput = {
  title: string;
  username: string;
  password: string;
  url: string;
  note: string;
  tags: string[];
  favorite: boolean;
  pinned: boolean;
  lastUsedAt: number;
};

export type VaultEntrySummary = Omit<VaultEntryInput, "password" | "note"> & {
  id: string;
  updatedAt: number;
};

export type VaultEntry = VaultEntryInput & {
  id: string;
  createdAt: number;
  updatedAt: number;
};

export type VaultRestoreResult = {
  imported: number;
  skipped: number;
  replaced: boolean;
};

export type VaultImportPreviewRow = {
  index: number;
  title: string;
  username: string;
  url: string;
  tags: string[];
  duplicate: boolean;
  hasPassword: boolean;
};

export type VaultImportResult = {
  imported: number;
  skipped: number;
};

export type BrowserBridgeInfo = {
  port: number;
};
