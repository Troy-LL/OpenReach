import { createApp } from "./app.js";
import { createMemoryKeyStore, runWithKeyStore } from "./keys.js";
import { runWithRetrieveBucket } from "./retrieve-cache.js";
import {
  createCachedBucketSessionBackend,
  runWithSessionBackend,
  type SessionBucket,
} from "./session.js";
import {
  RETRIEVE_SHARDS,
  SESSION_SHARDS,
  shardName,
} from "./store-keys.js";
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

function shardedBucket(
  env: WorkerEnv,
  prefix: string,
  shards: number,
): SessionBucket {
  return {
    get: (id) => stub(env, shardName(prefix, id, shards)).getValue(id),
    put: (id, value, ttlMs) =>
      stub(env, shardName(prefix, id, shards)).putValue(id, value, ttlMs),
    delete: (id) => stub(env, shardName(prefix, id, shards)).deleteValue(id),
  };
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const sessions = createCachedBucketSessionBackend(
      shardedBucket(env, "sess", SESSION_SHARDS),
    );
    const retrieves = shardedBucket(env, "ret", RETRIEVE_SHARDS);
    return runWithKeyStore(createMemoryKeyStore(), () =>
      runWithSessionBackend(sessions, () =>
        runWithRetrieveBucket(retrieves, () => app.fetch(request)),
      ),
    );
  },
};
