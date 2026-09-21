import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearLocalKey,
  createKeyStore,
  getApiKey,
  hasApiKey,
  saveLocalKey,
} from "../src/keys.js";

describe("local TypeSafe key store", () => {
  const dirs: string[] = [];

  beforeEach(() => {
    delete process.env.TYPESAFE_API_KEY;
  });

  afterEach(async () => {
    clearLocalKey();
    delete process.env.TYPESAFE_API_KEY;
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  async function store() {
    const dir = await mkdtemp(join(tmpdir(), "jev-key-"));
    dirs.push(dir);
    return createKeyStore(join(dir, "typesafe.key"));
  }

  it("rejects a short key and does not write a file", async () => {
    const ks = await store();
    await expect(ks.saveLocalKey("short")).rejects.toThrow(/does not look like/i);
    expect(ks.hasApiKey()).toBe(false);
  });

  it("saves to a local file and reads it back without exposing the raw value in hasApiKey", async () => {
    const ks = await store();
    const key = "apikey_test_local_only_1234567890";
    await ks.saveLocalKey(key);
    expect(ks.hasApiKey()).toBe(true);
    expect(ks.getApiKey()).toBe(key);
    const onDisk = await readFile(join(dirs[0], "typesafe.key"), "utf8");
    expect(onDisk.trim()).toBe(key);
  });

  it("prefers a deploy env var over the local file and clear only removes the file", async () => {
    const ks = await store();
    process.env.TYPESAFE_API_KEY = "apikey_from_deploy_environment_xx";
    await ks.saveLocalKey("apikey_from_local_file_should_not_win");
    expect(ks.getApiKey()).toBe("apikey_from_deploy_environment_xx");
    await ks.clearLocalKey();
    expect(ks.getApiKey()).toBe("apikey_from_deploy_environment_xx");
  });
});

describe("default key store helpers", () => {
  beforeEach(() => {
    delete process.env.TYPESAFE_API_KEY;
  });

  afterEach(() => {
    clearLocalKey();
    delete process.env.TYPESAFE_API_KEY;
  });

  it("reports no key when nothing is set", () => {
    expect(hasApiKey()).toBe(false);
    expect(getApiKey()).toBe("");
  });
});
