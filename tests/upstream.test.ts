import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchUpstreamJson, UPSTREAM_TIMEOUT_MS } from "../src/upstream.js";

describe("fetchUpstreamJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends an abort signal so hung indexes cannot hold the Worker", async () => {
    expect(UPSTREAM_TIMEOUT_MS).toBe(8_000);
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchUpstreamJson<{ ok: boolean }>(
      "https://example.test/works",
    );
    expect(data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns null on HTTP errors and network throws instead of failing the search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 })),
    );
    expect(await fetchUpstreamJson("https://example.test/down")).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("socket hang up");
      }),
    );
    expect(await fetchUpstreamJson("https://example.test/hang")).toBeNull();
  });
});
