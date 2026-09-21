import { createApp } from "./app.js";
import { createMemoryKeyStore, runWithKeyStore } from "./keys.js";
import {
  createBucketSessionBackend,
  runWithSessionBackend,
  type SessionBucket,
} from "./session.js";
import { OpenReachStore } from "./store-do.js";

export { OpenReachStore };

export type WorkerEnv = {
  STORE: DurableObjectNamespace<OpenReachStore>;
  ASSETS?: Fetcher;
  SEMANTIC_SCHOLAR_API_KEY?: string;
  OPENALEX_MAILTO?: string;
};

const app = createApp();

function stub(env: WorkerEnv, name: string): DurableObjectStub<OpenReachStore> {
  return env.STORE.get(env.STORE.idFromName(name));
}

function sessionBucket(env: WorkerEnv): SessionBucket {
  return {
    get: (id) => stub(env, `session:${id}`).getValue(),
    put: (id, value, ttlMs) => stub(env, `session:${id}`).putValue(value, ttlMs),
    delete: (id) => stub(env, `session:${id}`).deleteValue(),
  };
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const sessions = createBucketSessionBackend(sessionBucket(env));
    return runWithKeyStore(createMemoryKeyStore(), () =>
      runWithSessionBackend(sessions, () => app.fetch(request)),
    );
  },
};
