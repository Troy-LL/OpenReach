export const TYPESAFE_KEY_HEADER = "X-Typesafe-Key";

export function normalizeTypeSafeKey(key: string): string {
  return key.trim();
}

export function requestTypeSafeKey(
  headerKey?: string | null,
  authorization?: string | null,
): string | undefined {
  const fromHeader = headerKey?.trim();
  if (fromHeader) return fromHeader;
  const auth = authorization?.trim();
  if (!auth) return undefined;
  const bearer = /^Bearer\s+(\S+)/i.exec(auth);
  return bearer?.[1];
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
