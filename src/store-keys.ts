export const SESSION_SHARDS = 16;
export const RETRIEVE_SHARDS = 8;

export function shardName(
  prefix: string,
  key: string,
  shards: number,
): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return `${prefix}:${hash % shards}`;
}
