import { randomUUID } from "crypto";
import { exec } from "child_process";
import { TreeManager } from "./tree.js";
import { startWebServer } from "./web.js";
import { registerSession, unregisterSession, getTreesDir } from "./registry.js";
import { join } from "path";

const sessionId = randomUUID();
const port = parseInt(process.env.TREE_WEB_PORT || "3200");
const dataPath = join(getTreesDir(), `${sessionId}.json`);
const treeManager = new TreeManager(dataPath);

const session = {
  id: sessionId,
  name: "CLI Viewer",
  port,
  pid: process.pid,
  cwd: process.cwd(),
  startedAt: new Date().toISOString(),
};
registerSession(session);

const cleanup = () => unregisterSession(sessionId);
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });

startWebServer(treeManager, port, session);

// Open browser automatically
const url = `http://localhost:${port}`;
const openCmd =
  process.platform === "darwin"
    ? `open "${url}"`
    : process.platform === "win32"
      ? `start "${url}"`
      : `xdg-open "${url}"`;

exec(openCmd);

process.stderr.write(
  `\n🌳 Exploration Tree is running at ${url}\n` +
    `   Press Ctrl+C to stop.\n\n`
);
