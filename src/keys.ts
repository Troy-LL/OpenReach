import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assertLooksLikeKey, normalizeTypeSafeKey } from "./key-format.js";

export {
  assertLooksLikeKey,
  normalizeTypeSafeKey,
  requestTypeSafeKey,
  TYPESAFE_KEY_HEADER,
} from "./key-format.js";

const DEFAULT_FILE = join(process.cwd(), "data", "typesafe.key");

const keyStoreAls = new AsyncLocalStorage<KeyStore>();

export interface KeyStore {
  load(): Promise<void>;
  saveLocalKey(key: string): Promise<void>;
  clearLocalKey(): Promise<void>;
  getApiKey(): string;
  hasApiKey(): boolean;
}

export function runWithKeyStore<T>(store: KeyStore, fn: () => T): T {
  return keyStoreAls.run(store, fn);
}

function activeStore(): KeyStore {
  return keyStoreAls.getStore() ?? defaultStore;
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

/** In-memory only. Used on Cloudflare so visitor keys never hit DO/KV/R2. */
export function createMemoryKeyStore(): KeyStore {
  let stored = "";

  return {
    async load() {},

    async saveLocalKey(key: string) {
      stored = assertLooksLikeKey(key);
    },

    async clearLocalKey() {
      stored = "";
    },

    getApiKey() {
      return stored;
    },

    hasApiKey() {
      return Boolean(this.getApiKey());
    },
  };
}

export function overlayRequestKey(
  base: KeyStore,
  requestKey: string | undefined,
): KeyStore {
  const extra = requestKey ? normalizeTypeSafeKey(requestKey) : "";
  return {
    load: () => base.load(),
    saveLocalKey: (key) => base.saveLocalKey(key),
    clearLocalKey: () => base.clearLocalKey(),
    getApiKey() {
      return extra || base.getApiKey();
    },
    hasApiKey() {
      return Boolean(this.getApiKey());
    },
  };
}

const defaultStore = createKeyStore(DEFAULT_FILE);

export const loadLocalKey = () => activeStore().load();
export const saveLocalKey = (key: string) => activeStore().saveLocalKey(key);
export const clearLocalKey = () => activeStore().clearLocalKey();
export const getApiKey = () => activeStore().getApiKey();
export const hasApiKey = () => activeStore().hasApiKey();
export const getActiveKeyStore = () => activeStore();
