/** Strip OpenAlex wildcard chars and collapse whitespace for keyword APIs. */
export function sanitizeSearchQuery(query: string): string {
  return query
    .replace(/[?*]/g, " ")
    .replace(/[^\p{L}\p{N}\s\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  `a an the and or but if then else when how what why which who whom whose
   do does did done is are was were be been being to of in on for with from
   by at as into about over after before between through during without
   that this these those it its they them their we our you your i me my
   can could should would may might will shall not no nor so than too very
   just also only own same both each few more most other some
   help train paper papers research looking find`.split(/\s+/),
);

/** Shorter keyword string for OpenAlex topic search (full questions often match nothing). */
export function topicSearchQuery(query: string): string {
  const words = sanitizeSearchQuery(query)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  return words.slice(0, 6).join(" ") || sanitizeSearchQuery(query);
}
