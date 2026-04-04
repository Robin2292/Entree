import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { URL } from "url";
import type { TreeManager } from "../tree.js";
import { getSessions, type Session } from "../registry.js";
import { getHTML } from "./html.js";

export function startWebServer(
  treeManager: TreeManager,
  port: number,
  session: Session
) {
  const token = session.token || "";
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  // --- Auth middleware ---

  function verifyToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    // Check Authorization header first, then query param
    const authHeader = req.headers.authorization;
    const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const queryToken = req.query.token as string | undefined;
    if (headerToken === token || queryToken === token) {
      next();
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  }

  // --- Routes ---

  // HTML page: token via query param (from browser URL bar)
  app.get("/", (req, res) => {
    if (req.query.token !== token) {
      res.status(401).send("Unauthorized — token required");
      return;
    }
    res.type("html")
      .set("Content-Security-Policy",
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*; img-src 'self' data:")
      .send(getHTML(session));
  });

  // All API routes require token
  app.use("/api", verifyToken);

  app.get("/api/tree", (_req, res) => {
    res.json(treeManager.getTree());
  });

  app.get("/api/sessions", (_req, res) => {
    res.json(getSessions());
  });

  app.use(express.json({ limit: "5mb" }));

  app.post("/api/tree/import", (req, res) => {
    try {
      const tree = treeManager.importTree(req.body);
      res.json({ ok: true, title: tree.title, nodeCount: Object.keys(tree.nodes).length });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post("/api/undo", (_req, res) => {
    const ok = treeManager.undo();
    res.json({ ok, canUndo: treeManager.canUndo(), canRedo: treeManager.canRedo() });
  });

  app.post("/api/redo", (_req, res) => {
    const ok = treeManager.redo();
    res.json({ ok, canUndo: treeManager.canUndo(), canRedo: treeManager.canRedo() });
  });

  app.post("/api/nodes/:id/delete", (req, res) => {
    try {
      const result = treeManager.deleteNode(req.params.id);
      res.json({ ok: true, deleted: result.deleted.length });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  // --- WebSocket: validate token on upgrade ---

  wss.on("connection", (ws, req) => {
    // Verify token from query string
    try {
      const url = new URL(req.url || "", `http://localhost:${port}`);
      if (url.searchParams.get("token") !== token) {
        ws.close(4001, "Unauthorized");
        return;
      }
    } catch {
      ws.close(4001, "Unauthorized");
      return;
    }

    ws.send(JSON.stringify({ type: "tree", data: treeManager.getTree() }));

    const unsub = treeManager.onChange((tree) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "tree", data: tree }));
      }
    });

    ws.on("close", unsub);
  });

  httpServer.listen(port, "127.0.0.1", () => {
    process.stderr.write(
      `🌳 Entree UI: http://localhost:${port}?token=${token}\n`
    );
  });
}
