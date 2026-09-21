import "dotenv/config";

import { serve } from "@hono/node-server";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createApp } from "./app.js";
import { loadLocalKey } from "./keys.js";
import { apiListenConfig } from "./listen.js";

const { port, hostname } = apiListenConfig();
const staticRoot = resolve(process.cwd(), "web/dist");
const serveUi =
  process.env.API_ONLY !== "1" && existsSync(join(staticRoot, "index.html"));

await loadLocalKey();

const app = createApp({
  staticRoot: serveUi ? staticRoot : undefined,
});

const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`OpenReach on http://${hostname}:${info.port}`);
  if (!serveUi) {
    console.log("API only — run `npm run dev` for the UI, or `npm run build` then restart.");
  }
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Stop the other process or set PORT.`);
  } else {
    console.error("API failed to listen:", err.message);
  }
  process.exit(1);
});
