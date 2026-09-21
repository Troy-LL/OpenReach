import { DurableObject } from "cloudflare:workers";

type StoreEntry = { v: string; exp: number };

/** Short-lived search sessions and retrieve cache. Visitor TypeSafe keys are not stored here. */
export class OpenReachStore extends DurableObject {
  async getValue(key = "v"): Promise<string | null> {
    const row = await this.ctx.storage.get<StoreEntry>(key);
    if (!row) return null;
    if (typeof row.exp === "number" && row.exp <= Date.now()) {
      await this.ctx.storage.delete(key);
      return null;
    }
    return typeof row.v === "string" ? row.v : null;
  }

  async putValue(key: string, value: string, ttlMs?: number): Promise<void> {
    const exp =
      ttlMs && ttlMs > 0 ? Date.now() + ttlMs : Date.now() + 15 * 60 * 1000;
    await this.ctx.storage.put(key, { v: value, exp });
    const alarm = await this.ctx.storage.getAlarm();
    if (alarm === null || alarm > exp) {
      await this.ctx.storage.setAlarm(exp);
    }
  }

  async deleteValue(key = "v"): Promise<void> {
    await this.ctx.storage.delete(key);
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const all = await this.ctx.storage.list<StoreEntry>();
    let next = Number.POSITIVE_INFINITY;
    for (const [key, row] of all) {
      if (!row || typeof row !== "object" || typeof row.exp !== "number") {
        continue;
      }
      if (row.exp <= now) {
        await this.ctx.storage.delete(key);
      } else if (row.exp < next) {
        next = row.exp;
      }
    }
    if (Number.isFinite(next)) {
      await this.ctx.storage.setAlarm(next);
    }
  }
}
