import { randomUUID } from "crypto";
import { TreeManager } from "./tree.js";
import { startWebServer } from "./web/index.js";
import { registerSession, unregisterSession, getTreesDir } from "./registry.js";
import { join } from "path";
import { findPort, openBrowser } from "./utils.js";

async function main() {
  const sessionId = randomUUID();
  const sessionToken = randomUUID();
  const basePort = parseInt(process.env.TREE_WEB_PORT || "3200");
  const port = await findPort(basePort);
  const dataPath = join(getTreesDir(), `${sessionId}.json`);
  const treeManager = new TreeManager(dataPath);

  const session = {
    id: sessionId,
    name: "CLI Viewer",
    port,
    pid: process.pid,
    cwd: process.cwd(),
    startedAt: new Date().toISOString(),
    token: sessionToken,
  };
  registerSession(session);

  const cleanup = () => { treeManager.flush(); unregisterSession(sessionId); };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });

  startWebServer(treeManager, port, session);

  const url = `http://localhost:${port}?token=${sessionToken}`;
  openBrowser(url);

  process.stderr.write(
    `\n🌳 Entree is running at ${url}\n` +
      `   Press Ctrl+C to stop.\n\n`
  );
}

main().catch(console.error);
