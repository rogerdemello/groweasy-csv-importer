/**
 * Custom server: one Node process, one port, one URL.
 *
 *   /api/*  -> Express (the real backend)
 *   /*      -> Next.js (the UI)
 *
 * This satisfies both the explicit "Node.js + Express" backend requirement and
 * the single-hosted-URL deployment model (Render).
 */

import next from "next";
import { getConfig } from "./config";
import { buildApp } from "./app";

const config = getConfig();
const dev = process.env.NODE_ENV !== "production";

async function main() {
  const nextApp = next({ dev });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const app = buildApp();

  // Everything that isn't an /api route is handled by Next.js.
  app.use((req, res) => handle(req, res));

  app.listen(config.port, () => {
    const mode = config.useMock ? "MOCK (heuristic mapper)" : `AI (${config.model})`;
    // eslint-disable-next-line no-console
    console.log(`\n  GrowEasy CSV Importer`);
    console.log(`  ▸ http://localhost:${config.port}`);
    console.log(`  ▸ extraction mode: ${mode}`);
    console.log(`  ▸ dev: ${dev}\n`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err);
  process.exit(1);
});
