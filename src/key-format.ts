export const TYPESAFE_KEY_HEADER = "X-Typesafe-Key";

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
