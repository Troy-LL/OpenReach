const SAFE_MESSAGES = new Set([
  "Question is required.",
  "Add a TypeSafe key first.",
  "Search session expired. Run the search again.",
]);

/** Client-facing error text. Never echo upstream URLs, bodies, or keys. */
export function publicErrorMessage(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message.trim() : "";
  if (SAFE_MESSAGES.has(message)) return message;
  if (/^Search session expired/i.test(message)) return message;
  return fallback;
}
