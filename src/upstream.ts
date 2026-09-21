export const UPSTREAM_TIMEOUT_MS = 8_000;
export const USER_AGENT = "OpenReach/0.1 (mailto:openreach@localhost)";

export async function fetchUpstream(
  url: string,
  init: RequestInit = {},
): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: {
        "User-Agent": USER_AGENT,
        ...init.headers,
      },
    });
    if (res.status === 429 || !res.ok) {
      try {
        await res.body?.cancel();
      } catch {
        // Ignore cancel failures on already-closed streams.
      }
      return null;
    }
    return res;
  } catch {
    return null;
  }
}

export async function fetchUpstreamJson<T>(
  url: string,
  headers: Record<string, string> = {},
): Promise<T | null> {
  const res = await fetchUpstream(url, {
    headers: { Accept: "application/json", ...headers },
  });
  if (!res) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchUpstreamText(
  url: string,
  headers: Record<string, string> = {},
): Promise<string | null> {
  const res = await fetchUpstream(url, { headers });
  if (!res) return null;
  try {
    return await res.text();
  } catch {
    return null;
  }
}

export async function settleIndex<T>(
  work: Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await work;
  } catch {
    return fallback;
  }
}
