import { DurableObject } from "cloudflare:workers";

/** Short-lived search sessions. Visitor TypeSafe keys are not stored here. */
export class OpenReachStore extends DurableObject {
  async getValue(): Promise<string | null> {
    return (await this.ctx.storage.get<string>("v")) ?? null;
  }

  async putValue(value: string, ttlMs?: number): Promise<void> {
    await this.ctx.storage.put("v", value);
    if (ttlMs && ttlMs > 0) {
      await this.ctx.storage.setAlarm(Date.now() + ttlMs);
    } else {
      await this.ctx.storage.deleteAlarm();
    }
  }

  async deleteValue(): Promise<void> {
    await this.ctx.storage.delete("v");
    await this.ctx.storage.deleteAlarm();
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.delete("v");
  }
}
