import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { TYPESAFE_KEY_HEADER } from "../src/key-format.js";
import {
  createMemoryKeyStore,
  runWithKeyStore,
} from "../src/keys.js";

describe("request TypeSafe key header", () => {
  beforeEach(() => {
    delete process.env.TYPESAFE_API_KEY;
  });

  afterEach(() => {
    delete process.env.TYPESAFE_API_KEY;
  });

  it("treats X-Typesafe-Key as request-only and does not keep it for the next call", async () => {
    const app = createApp();
    const key = "apikey_header_only_1234567890ab";
    await runWithKeyStore(createMemoryKeyStore(), async () => {
      const withKey = await app.request("/api/health", {
        headers: { [TYPESAFE_KEY_HEADER]: key },
      });
      expect(withKey.status).toBe(200);
      expect(((await withKey.json()) as { hasKey: boolean }).hasKey).toBe(true);

      const without = await app.request("/api/health");
      expect(((await without.json()) as { hasKey: boolean }).hasKey).toBe(false);
    });
  });

  it("does not persist a key saved into a memory store", async () => {
    const first = createMemoryKeyStore();
    await first.saveLocalKey("apikey_memory_only_1234567890ab");
    expect(first.hasApiKey()).toBe(true);

    const second = createMemoryKeyStore();
    await second.load();
    expect(second.hasApiKey()).toBe(false);

    const app = createApp();
    const store = createMemoryKeyStore();
    const res = await runWithKeyStore(store, () =>
      app.request("/api/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "apikey_memory_only_1234567890ab" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(store.hasApiKey()).toBe(true);

    const later = await runWithKeyStore(createMemoryKeyStore(), () =>
      app.request("/api/health"),
    );
    expect(((await later.json()) as { hasKey: boolean }).hasKey).toBe(false);
  });
});
