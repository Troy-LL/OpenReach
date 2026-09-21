export function cleanAuthorNames(
  names: Array<string | null | undefined>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = (raw ?? "").replace(/\s+/g, " ").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function displayNameFromParts(
  given?: string | null,
  family?: string | null,
  name?: string | null,
): string {
  const g = (given ?? "").trim();
  const f = (family ?? "").trim();
  if (f && g) return `${g} ${f}`;
  return ((name ?? "").trim() || f || g).trim();
}

export function authorsFromStringList(value: unknown): string[] {
  if (typeof value === "string") {
    return cleanAuthorNames(value.split(/;|,/));
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return cleanAuthorNames(
    value.map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      const row = item as Record<string, unknown>;
      if (typeof row.display_name === "string") return row.display_name;
      if (typeof row.name === "string") return row.name;
      if (typeof row.fullName === "string") return row.fullName;
      if (typeof row.full_name === "string") return row.full_name;
      const given =
        typeof row.given === "string"
          ? row.given
          : typeof row.firstName === "string"
            ? row.firstName
            : typeof row.first_name === "string"
              ? row.first_name
              : typeof row.ForeName === "string"
                ? row.ForeName
                : null;
      const family =
        typeof row.family === "string"
          ? row.family
          : typeof row.lastName === "string"
            ? row.lastName
            : typeof row.last_name === "string"
              ? row.last_name
              : typeof row.LastName === "string"
                ? row.LastName
                : null;
      return displayNameFromParts(given, family, typeof row.$ === "string" ? row.$ : null);
    }),
  );
}
