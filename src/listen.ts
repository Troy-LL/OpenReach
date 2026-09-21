export const API_HOSTNAME = "127.0.0.1" as const;

export function apiListenConfig(
  env: Record<string, string | undefined> = process.env,
): { port: number; hostname: typeof API_HOSTNAME } {
  return { port: Number(env.PORT ?? 3000), hostname: API_HOSTNAME };
}
