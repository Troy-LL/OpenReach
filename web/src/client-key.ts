import { assertLooksLikeKey } from "@shared/key-format";

const STORAGE_KEY = "openreach.typesafeKey";

export function loadClientKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function saveClientKey(key: string): string {
  const trimmed = assertLooksLikeKey(key);
  localStorage.setItem(STORAGE_KEY, trimmed);
  return trimmed;
}

export function clearClientKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
}

export function hasClientKey(): boolean {
  return loadClientKey().length >= 24;
}
