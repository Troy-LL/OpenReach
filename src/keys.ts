import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const DEFAULT_FILE = join(process.cwd(), "data", "typesafe.key");

export interface KeyStore {
  load(): Promise<void>;
  saveLocalKey(key: string): Promise<void>;
  clearLocalKey(): Promise<void>;
  getApiKey(): string;
  hasApiKey(): boolean;
}

export function normalizeTypeSafeKey(key: string): string {
  return key.trim();
}

export function assertLooksLikeKey(key: string): string {
  const trimmed = normalizeTypeSafeKey(key);
  if (trimmed.length < 24) {
    throw new Error(
      "That does not look like a TypeSafe key. Paste the full key from the TypeSafe console.",
    );
  }
  return trimmed;
}

export function createKeyStore(filePath: string): KeyStore {
  let fileKey: string | null = null;
  let appliedEnv = false;

  return {
    async load() {
      try {
        const raw = await readFile(filePath, "utf8");
        fileKey = normalizeTypeSafeKey(raw);
        if (fileKey && !process.env.TYPESAFE_API_KEY?.trim()) {
          process.env.TYPESAFE_API_KEY = fileKey;
          appliedEnv = true;
        }
      } catch {
        fileKey = null;
      }
    },

    async saveLocalKey(key: string) {
      const trimmed = assertLooksLikeKey(key);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, `${trimmed}\n`, { encoding: "utf8" });
      fileKey = trimmed;
      if (!process.env.TYPESAFE_API_KEY?.trim()) {
        process.env.TYPESAFE_API_KEY = trimmed;
        appliedEnv = true;
      }
    },

    async clearLocalKey() {
      fileKey = null;
      try {
        await unlink(filePath);
      } catch {
      }
      if (appliedEnv) {
        delete process.env.TYPESAFE_API_KEY;
        appliedEnv = false;
      }
    },

    getApiKey() {
      return process.env.TYPESAFE_API_KEY?.trim() || fileKey || "";
    },

    hasApiKey() {
      return Boolean(this.getApiKey());
    },
  };
}

const defaultStore = createKeyStore(DEFAULT_FILE);

export const loadLocalKey = () => defaultStore.load();
export const saveLocalKey = (key: string) => defaultStore.saveLocalKey(key);
export const clearLocalKey = () => defaultStore.clearLocalKey();
export const getApiKey = () => defaultStore.getApiKey();
export const hasApiKey = () => defaultStore.hasApiKey();
